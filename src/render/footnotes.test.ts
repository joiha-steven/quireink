import { describe, it, expect } from '@/test/vitest'
import { beforeAll, afterAll } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { prepareFootnotes, applyFootnotes } from '@/render/footnotes'
import { renderPostContent } from '@/render/post-content'

// A DOM, because the question below is what a BROWSER makes of the string, and the string is
// the one thing that looks innocent.
//
// Reached through `globalThis` and typed here rather than by `lib: dom`: this is the reader's
// half of the tree, which the root project compiles WITHOUT a DOM on purpose, and one test is
// not a reason to give every file in `src/render` a `document` it must never use.
beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

type Attr = { name: string }
type El = { tagName: string; attributes: Attr[] }
type Doc = { body: { innerHTML: string }; querySelectorAll: (sel: string) => El[] }
const dom = (): Doc => (globalThis as unknown as { document: Doc }).document

/** Every `on*` attribute a browser would end up honouring, whatever the string looked like. */
function handlersIn(html: string): string[] {
  dom().body.innerHTML = html
  return [...dom().querySelectorAll('*')]
    .flatMap((el) => [...el.attributes].filter((a) => /^on/i.test(a.name)).map((a) => `${el.tagName}.${a.name}`))
}

describe('prepareFootnotes', () => {
  it('extracts a definition and numbers its reference', () => {
    const fn = prepareFootnotes('A claim[^src].\n\n[^src]: The source.')
    expect(fn.refs.get('src')).toBe(1)
    expect(fn.defs.get('src')).toBe('The source.')
    expect(fn.markdown).not.toContain('[^src]: The source.') // definition line removed
    expect(fn.markdown).not.toContain('[^src]') // reference swapped for a placeholder
  })

  it('numbers by first reference appearance', () => {
    const fn = prepareFootnotes('X[^b] then Y[^a].\n\n[^a]: A\n[^b]: B')
    expect(fn.refs.get('b')).toBe(1)
    expect(fn.refs.get('a')).toBe(2)
  })

  it('leaves a reference with no definition as literal text', () => {
    const fn = prepareFootnotes('Dangling[^x] ref.')
    expect(fn.refs.size).toBe(0)
    expect(fn.markdown).toContain('[^x]')
  })

  it('drops a definition that is never referenced', () => {
    const fn = prepareFootnotes('No refs here.\n\n[^unused]: orphan')
    expect(fn.defs.size).toBe(0)
  })

  it('ignores a [^id] inside a fenced code block', () => {
    const fn = prepareFootnotes('```\narr[^0]\n```\n\n[^0]: def')
    expect(fn.refs.size).toBe(0) // the only [^0] is inside code
    expect(fn.markdown).toContain('arr[^0]') // code preserved verbatim
  })
})

describe('applyFootnotes', () => {
  it('is a no-op with no footnotes', () => {
    expect(applyFootnotes('<p>hi</p>', new Map(), new Map())).toBe('<p>hi</p>')
  })

  it('renders sup refs + a list, round-tripped through prepare', () => {
    const fn = prepareFootnotes('A[^s].\n\n[^s]: **bold** note')
    // marked would leave the placeholder in place inside a paragraph; simulate that.
    const html = applyFootnotes(`<p>A${fn.markdown.match(/A([\s\S]*?)\./)?.[1] ?? ''}.</p>`, fn.refs, fn.defs)
    expect(html).toContain('sup class="fnref" id="fnref-s"')
    expect(html).toContain('href="#fn-s"')
    expect(html).toContain('<li id="fn-s">')
    expect(html).toContain('<strong>bold</strong>') // definition markdown rendered
    expect(html).toContain('href="#fnref-s"') // back-reference
  })
})

/**
 * ⚠️ THE ID IS THE AUTHOR'S TEXT, AND IT GOES INTO FOUR ATTRIBUTES.
 *
 * `prepareFootnotes` accepts everything but a bracket and a space, quotes and slashes included,
 * so `[^n"/onmouseover="alert(1)]` closed the `id="` attribute and opened one of its own. Parsed
 * into a DOM, the `<li>` came back carrying a real `onmouseover` handler, on the reader's page
 * and on the owner's preview. The slash is what removes the need for a space: HTML5 reads a
 * slash after a quoted value as an attribute separator.
 *
 * This is the one rendering path that does not go through the engine, and it broke the sentence
 * `post-content.ts` opens with: raw HTML is escaped and shown, never rendered. Anything that can
 * write a post it did not author reaches it — the MCP door, the two importers, the assistant.
 *
 * ASSERTED AGAINST A PARSED DOM, not against the string. The string looks wrong in a way that is
 * easy to talk yourself out of: there is no space before `onmouseover`, so a regular expression
 * for ` on\w+=` says it is fine. Only a parser answers the question.
 */
describe('a footnote id cannot invent an attribute', () => {
  const HOSTILE = ['n"/onmouseover="alert(1)', 'p"><script>alert(1)</script>', "q'/onfocus='z", 'r"onload="s']
  // Ids a real blog writes. Narrowing the charset to `[\w-]` would have shut the hole and taken
  // these with it, which is why the fix escapes instead.
  const ORDINARY = ['ghi-chú', 'note_1', 'a&b', 'ссылка', '注']

  it('gives the page no handler and no script, whatever the id says', async () => {
    for (const id of [...HOSTILE, ...ORDINARY]) {
      const html = await renderPostContent({ markdown: `Claim[^${id}].\n\n[^${id}]: the note.\n` })
      const handlers = handlersIn(html)
      expect(`${id}: ${handlers.join(',')} scripts=${dom().querySelectorAll('script').length}`)
        .toBe(`${id}:  scripts=0`)
    }
  })

  it('still makes a footnote out of an id that is not English', async () => {
    for (const id of ORDINARY) {
      const html = await renderPostContent({ markdown: `Claim[^${id}].\n\n[^${id}]: the note.\n` })
      expect(`${id}: ${html.includes('class="fnref"') ? 'linked' : 'LOST'}`).toBe(`${id}: linked`)
    }
  })
})
