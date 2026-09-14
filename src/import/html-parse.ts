// Enough HTML to read what a blog platform exports.
//
// Half of what `turndown` cost: it needs a DOM, so it ships one. This builds a tree of plain
// objects instead, and `html-to-md.ts` turns that into the Markdown syntax tree this product
// already owns.
//
// FORGIVING ON PURPOSE, AND IT NEVER THROWS. The input is ten years of somebody else's posts
// written through four editors and a dozen plugins: unclosed `<p>`, a `</div>` too many, an
// attribute with no quotes, a `<br>` that is sometimes `<br/>`. A parser that refused any of
// those would refuse the import, and an import that stops halfway is worse than one that reads
// a paragraph slightly wrong.
//
// WHAT IT IS NOT: a browser. There is no adoption agency, no table-scope repair, no foster
// parenting. Those exist because a browser must agree with every other browser on pages written
// to exploit exactly that; nothing here is rendering a page, it is reading one.
import { decodeEntities } from './convert'

export type HtmlNode =
  | { type: 'text'; value: string }
  | { type: 'element'; tag: string; attrs: Record<string, string>; children: HtmlNode[] }

/** Elements that never have children, whether or not the export bothered with a slash. */
const VOID = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
])

/** Their content is not text. A `<script>` in an exported post is tracking, not writing. */
const DROPPED = new Set(['script', 'style', 'noscript', 'template', 'iframe'])

/** Opening one of these closes an open `<p>`, which is how most exports spell a paragraph end. */
const BLOCK = new Set([
  'address', 'article', 'aside', 'blockquote', 'details', 'div', 'dl', 'dd', 'dt',
  'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'header', 'hr', 'li', 'main', 'nav', 'ol', 'p', 'pre', 'section', 'table', 'ul',
])

/** Opening the key closes any of its values that is still open. */
const CLOSES: Record<string, readonly string[]> = {
  li: ['li'],
  dt: ['dt', 'dd'],
  dd: ['dt', 'dd'],
  td: ['td', 'th'],
  th: ['td', 'th'],
  tr: ['td', 'th', 'tr'],
  thead: ['td', 'th', 'tr'],
  tbody: ['td', 'th', 'tr', 'thead'],
  tfoot: ['td', 'th', 'tr', 'thead', 'tbody'],
  option: ['option'],
}

/**
 * How far an implied close may reach before it gives up.
 *
 * `<li>` closes an open `<li>`, but only within the SAME list: without this barrier a nested
 * `<ul>` closes the item it is nested inside, and every sub-list in the import comes out as a
 * sibling of its parent. Same story for a cell inside a nested table.
 */
const SCOPE: Record<string, readonly string[]> = {
  li: ['ul', 'ol'],
  dt: ['dl'],
  dd: ['dl'],
  td: ['table'],
  th: ['table'],
  tr: ['table'],
  thead: ['table'],
  tbody: ['table'],
  tfoot: ['table'],
}

/** Deeper than any post; a guard against a file built to exhaust memory rather than to be read. */
const MAX_DEPTH = 200

const ATTR = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g

/** The index just past this tag's `>`, ignoring a `>` that sits inside a quoted attribute. */
function endOfTag(html: string, from: number): number {
  let quote = ''
  for (let i = from; i < html.length; i++) {
    const ch = html[i]!
    if (quote) {
      if (ch === quote) quote = ''
    } else if (ch === '"' || ch === "'") {
      quote = ch
    } else if (ch === '>') {
      return i + 1
    }
  }
  return html.length
}

type Frame = { tag: string; attrs: Record<string, string>; children: HtmlNode[] }

/** An HTML fragment as a list of top-level nodes. */
export function parseHtml(html: string): HtmlNode[] {
  const root: Frame = { tag: '#root', attrs: {}, children: [] }
  const stack: Frame[] = [root]
  const top = (): Frame => stack[stack.length - 1]!
  const openTags = (): string[] => stack.map((f) => f.tag)

  /**
   * Pops frames until `tag` has been closed. Does nothing when it was never opened, or when a
   * barrier stands between here and it.
   *
   * An explicit `</li>` passes no barrier because the author said so. An IMPLIED close, the
   * kind a second `<li>` performs on the first, passes the list it belongs to.
   */
  const closeTo = (tag: string, barriers: readonly string[] = []): void => {
    let found = false
    for (let i = stack.length - 1; i > 0; i--) {
      const open = stack[i]!.tag
      if (open === tag) { found = true; break }
      if (barriers.includes(open)) return
    }
    if (!found) return
    while (stack.length > 1) {
      const done = stack.pop()!
      stack[stack.length - 1]!.children.push(element(done))
      if (done.tag === tag) return
    }
  }

  let at = 0
  while (at < html.length) {
    const lt = html.indexOf('<', at)
    if (lt < 0) {
      addText(top(), html.slice(at))
      break
    }
    if (lt > at) addText(top(), html.slice(at, lt))

    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt + 4)
      at = end < 0 ? html.length : end + 3
      continue
    }
    if (html.startsWith('<!', lt) || html.startsWith('<?', lt)) {
      at = endOfTag(html, lt)
      continue
    }

    const end = endOfTag(html, lt)
    const inner = html.slice(lt + 1, end - 1)

    if (inner.startsWith('/')) {
      const tag = inner.slice(1).trim().toLowerCase()
      if (tag) closeTo(tag)
      at = end
      continue
    }

    const selfClosed = inner.endsWith('/')
    const body = selfClosed ? inner.slice(0, -1) : inner
    const tag = (/^[a-zA-Z][^\s/>]*/.exec(body)?.[0] ?? '').toLowerCase()
    if (!tag) {
      // Not a tag at all, so it is the literal `<` an author wrote and nobody escaped.
      addText(top(), html.slice(lt, end))
      at = end
      continue
    }

    if (DROPPED.has(tag)) {
      // Skip to the matching close rather than parsing the contents: a `<style>` body is CSS,
      // and `a > b` inside it would otherwise be read as a tag.
      const close = html.toLowerCase().indexOf(`</${tag}`, end)
      at = close < 0 ? html.length : endOfTag(html, close)
      continue
    }

    for (const shut of CLOSES[tag] ?? []) closeTo(shut, SCOPE[tag] ?? [])
    if (BLOCK.has(tag) && openTags().includes('p')) closeTo('p')

    const frame: Frame = { tag, attrs: attributes(body, tag.length), children: [] }
    if (VOID.has(tag) || selfClosed) {
      top().children.push(element(frame))
    } else if (stack.length < MAX_DEPTH) {
      stack.push(frame)
    } else {
      // Past the cap the element is kept but not entered, so its text still arrives.
      top().children.push(element(frame))
    }
    at = end
  }

  // Whatever the export left open is closed here, in order, so nothing is lost.
  while (stack.length > 1) {
    const done = stack.pop()!
    stack[stack.length - 1]!.children.push(element(done))
  }
  return root.children
}

const element = (frame: Frame): HtmlNode => ({
  type: 'element',
  tag: frame.tag,
  attrs: frame.attrs,
  children: frame.children,
})

function addText(frame: Frame, chunk: string): void {
  if (chunk === '') return
  const last = frame.children[frame.children.length - 1]
  const value = decodeEntities(chunk)
  // Adjacent text is joined, because the tokeniser splits on every comment and dropped tag
  // and a word should not come out as two.
  if (last && last.type === 'text') last.value += value
  else frame.children.push({ type: 'text', value })
}

function attributes(body: string, from: number): Record<string, string> {
  const attrs: Record<string, string> = {}
  ATTR.lastIndex = from
  for (let m = ATTR.exec(body); m; m = ATTR.exec(body)) {
    const name = m[1]!.toLowerCase()
    // A bare attribute (`disabled`) is its own name, which is what the DOM reports too.
    attrs[name] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '')
  }
  return attrs
}

/** Every text node under `node`, joined. Used for a caption, a cell, an alt. */
export function textOf(nodes: readonly HtmlNode[]): string {
  let out = ''
  for (const node of nodes) {
    if (node.type === 'text') out += node.value
    else out += textOf(node.children)
  }
  return out
}
