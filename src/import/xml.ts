// Enough XML to read a WordPress export, and no more.
//
// This replaces `fast-xml-parser`, which had one caller: `wordpress.ts`, parsing WXR. The shape
// it returns is the one that caller already reads, so nothing downstream changed.
//
// TWO THINGS IT DELIBERATELY DOES NOT COPY:
//
//   1. Type coercion. `fast-xml-parser` turns `<wp:post_id>007</wp:post_id>` into the NUMBER 7
//      and `1e5` into 100000. Everything here is read back through `String()`, so the only
//      thing that guessing types can do to this importer is corrupt a slug that happens to
//      look like a number. Every value stays the text that was in the file.
//   2. Whitespace as content. With `trimValues: false` that library hangs the newlines between
//      tags off every parent as `#text`, so `channel` came back carrying a string of nothing.
//      Text is kept where an element actually has text, and dropped where it is only layout.
//
// NO DTD, BY CONSTRUCTION. A `<!DOCTYPE>` is skipped whole, internal subset included, and no
// entity it declares is ever defined or expanded. That is what makes the billion-laughs
// expansion and the external-entity read impossible here rather than merely disabled: there is
// no code path that could perform either. WXR does not use a DTD.

/** An element: child elements by name, `@_` for attributes, `#text` for its own text. */
export type XmlNode = { [name: string]: XmlValue }
export type XmlValue = string | XmlNode | (string | XmlNode)[]

/** Deeper than any real document; a guard against a file built to exhaust memory. */
const MAX_DEPTH = 100

const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
}

/**
 * The five entities XML defines, and only those.
 *
 * Numeric references are left alone on purpose: `content:encoded` carries HTML that is handed
 * to the Markdown converter with its entities intact, and `convert.ts` owns that decoding for
 * every importer at once. Doing it twice is how `&amp;lt;` becomes `<`.
 */
function decode(text: string): string {
  if (!text.includes('&')) return text
  return text.replace(/&([a-zA-Z]+);/g, (whole, name: string) => NAMED[name] ?? whole)
}

/** The index just past this tag's `>`, skipping any `>` that is inside an attribute value. */
function endOfTag(source: string, from: number): number {
  let quote = ''
  for (let i = from; i < source.length; i++) {
    const ch = source[i]!
    if (quote) {
      if (ch === quote) quote = ''
    } else if (ch === '"' || ch === "'") {
      quote = ch
    } else if (ch === '>') {
      return i + 1
    }
  }
  throw new Error('unterminated tag')
}

const ATTR = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g

type Building = {
  name: string
  attrs: Record<string, string>
  children: Map<string, (string | XmlNode)[]>
  text: string
  hasText: boolean
}

const open = (name: string): Building => ({
  name,
  attrs: {},
  children: new Map(),
  text: '',
  hasText: false,
})

/**
 * An element, as the value its parent stores.
 *
 * A leaf with no attributes is just its text, which is what makes `item.title` a string. Once
 * there are attributes or children it has to become an object, and then its own text moves to
 * `#text` — but only when it has some, so a parent full of newlines stays clean.
 */
function close(node: Building): string | XmlNode {
  const attrs = Object.entries(node.attrs)
  if (attrs.length === 0 && node.children.size === 0) return node.text
  const out: XmlNode = {}
  for (const [name, values] of node.children) out[name] = values.length === 1 ? values[0]! : values
  for (const [name, value] of attrs) out[`@_${name}`] = value
  if (node.children.size === 0 || node.hasText) out['#text'] = node.text
  return out
}

function addChild(parent: Building, name: string, value: string | XmlNode): void {
  const held = parent.children.get(name)
  if (held) held.push(value)
  else parent.children.set(name, [value])
}

/**
 * A document, as nested plain objects.
 *
 * The root wrapper is not an element: it holds whatever top-level elements the file has, which
 * for WXR is the single `rss`.
 */
export function parseXml(source: string): XmlNode {
  const root = open('#document')
  const stack: Building[] = [root]
  let at = 0

  const top = (): Building => stack[stack.length - 1]!

  while (at < source.length) {
    const lt = source.indexOf('<', at)
    if (lt < 0) {
      addText(top(), source.slice(at), true)
      break
    }
    if (lt > at) addText(top(), source.slice(at, lt), true)

    if (source.startsWith('<!--', lt)) {
      const end = source.indexOf('-->', lt + 4)
      at = end < 0 ? source.length : end + 3
      continue
    }
    if (source.startsWith('<![CDATA[', lt)) {
      const end = source.indexOf(']]>', lt + 9)
      const body = source.slice(lt + 9, end < 0 ? source.length : end)
      // CDATA is literal by definition: an `&amp;` inside it is those five characters, and
      // decoding it here would rewrite the HTML of every imported post.
      addText(top(), body, false)
      at = end < 0 ? source.length : end + 3
      continue
    }
    if (source.startsWith('<!', lt)) {
      at = skipDeclaration(source, lt)
      continue
    }
    if (source.startsWith('<?', lt)) {
      const end = source.indexOf('?>', lt + 2)
      at = end < 0 ? source.length : end + 2
      continue
    }

    const end = endOfTag(source, lt)
    const inner = source.slice(lt + 1, end - 1)

    if (inner.startsWith('/')) {
      const name = inner.slice(1).trim()
      // An unmatched close tag is ignored rather than fatal: an export truncated mid-file
      // should give back the posts it did contain.
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i]!.name !== name) continue
        while (stack.length > i) {
          const done = stack.pop()!
          addChild(stack[stack.length - 1]!, done.name, close(done))
        }
        break
      }
      at = end
      continue
    }

    const selfClosing = inner.endsWith('/')
    const body = selfClosing ? inner.slice(0, -1) : inner
    const name = (/^[^\s/>]+/.exec(body)?.[0] ?? '').trim()
    if (!name) {
      at = end
      continue
    }
    const node = open(name)
    ATTR.lastIndex = name.length
    for (let m = ATTR.exec(body); m; m = ATTR.exec(body)) {
      node.attrs[m[1]!] = decode(m[2] ?? m[3] ?? '')
    }

    if (selfClosing) {
      addChild(top(), name, close(node))
    } else {
      if (stack.length >= MAX_DEPTH) throw new Error(`XML nested deeper than ${MAX_DEPTH}`)
      stack.push(node)
    }
    at = end
  }

  // Anything still open at the end of the file is closed here, for the same reason as above.
  while (stack.length > 1) {
    const done = stack.pop()!
    addChild(stack[stack.length - 1]!, done.name, close(done))
  }
  return close(root) as XmlNode
}

function addText(node: Building, chunk: string, entities: boolean): void {
  if (chunk === '') return
  node.text += entities ? decode(chunk) : chunk
  if (chunk.trim() !== '') node.hasText = true
}

/** Past a `<!DOCTYPE …>` or any other `<!…>`, including a `[ … ]` internal subset. */
function skipDeclaration(source: string, from: number): number {
  let depth = 0
  let quote = ''
  for (let i = from + 2; i < source.length; i++) {
    const ch = source[i]!
    if (quote) {
      if (ch === quote) quote = ''
    } else if (ch === '"' || ch === "'") {
      quote = ch
    } else if (ch === '[') {
      depth++
    } else if (ch === ']') {
      depth--
    } else if (ch === '>' && depth <= 0) {
      return i + 1
    }
  }
  return source.length
}
