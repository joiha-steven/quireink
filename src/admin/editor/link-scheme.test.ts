// WHAT A PASTED LINK IS ALLOWED TO CARRY, tested on the real schema through the real parser.
//
// The editor and the published page each decide this, and until 2026-09-16 they decided it
// differently: the page ran `md/html-rules.ts`'s `safeHref`, which strips control characters
// and THEN matches a scheme, and this side ran `/^\s*javascript:/i`, which reads only the
// whitespace before the scheme. A browser ignores a tab or a newline inside `java<tab>script:`
// and runs it, so the narrower test called a live scheme clean and the mark survived into the
// post's source. The reader was never reachable — `safeHref` rewrote it to `#` on the way to
// the page — so this closes a disagreement between two layers rather than a hole, and it is
// worth closing because the disagreement is what a later change would inherit.
import { describe, expect, it, beforeAll, afterAll } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { DOMParser } from 'prosemirror-model'
import { schema } from './schema'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

const TAB = String.fromCharCode(9)
const NL = String.fromCharCode(10)

/** Paste this HTML, and answer with the href the link mark kept — or null for no mark. */
function pasted(html: string): string | null {
  const dom = document.createElement('div')
  dom.innerHTML = html
  const doc = DOMParser.fromSchema(schema).parse(dom)
  let href: string | null = null
  doc.descendants((node) => {
    for (const mark of node.marks) if (mark.type.name === 'link') href = mark.attrs.href as string
  })
  return href
}

describe('a pasted link', () => {
  it('keeps an ordinary address', () => {
    expect(pasted('<a href="https://example.com/a?b=1">x</a>')).toBe('https://example.com/a?b=1')
  })

  it('keeps a relative one and an anchor', () => {
    expect(pasted('<a href="/posts/hello">x</a>')).toBe('/posts/hello')
    expect(pasted('<a href="#notes">x</a>')).toBe('#notes')
    expect(pasted('<a href="#">x</a>')).toBe('#')
  })

  it('refuses the plain executing scheme', () => {
    expect(pasted('<a href="javascript:alert(1)">x</a>')).toBeNull()
    expect(pasted('<a href="JaVaScRiPt:alert(1)">x</a>')).toBeNull()
  })

  it('refuses one broken up by a control character, which is the fault this file exists for', () => {
    expect(pasted(`<a href="java${TAB}script:alert(1)">x</a>`)).toBeNull()
    expect(pasted(`<a href="java${NL}script:alert(1)">x</a>`)).toBeNull()
    expect(pasted(`<a href="${TAB}javascript:alert(1)">x</a>`)).toBeNull()
  })

  it('refuses the other two schemes the published page refuses', () => {
    // The page has rewritten all three to `#` since the port; only this side knew one.
    expect(pasted('<a href="vbscript:msgbox(1)">x</a>')).toBeNull()
    expect(pasted('<a href="data:text/html;base64,PHNjcmlwdD4=">x</a>')).toBeNull()
  })

  it('leaves the words on the page when it refuses the link', () => {
    // Refusing the MARK, not the text: a paste that loses a sentence is worse than one that
    // loses a link, and the writer can see what happened and retype the address.
    const dom = document.createElement('div')
    dom.innerHTML = '<p>before <a href="javascript:alert(1)">the words</a> after</p>'
    expect(DOMParser.fromSchema(schema).parse(dom).textContent).toBe('before the words after')
  })
})
