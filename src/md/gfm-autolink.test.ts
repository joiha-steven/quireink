// A BARE URL INSIDE EMPHASIS, which is one text node to the author and was three to the parser.
//
// `linkifyAll` runs over text nodes after everything else has parsed, so a URL is only found as
// far as one node reaches. An underscore that opened no emphasis is left standing as a node of
// its own, and inside `*…*` or `**…**` that cut the address in half:
//
//     **https://vi.wikipedia.org/wiki/Trang_Chính**
//       → <a href="https://vi.wikipedia.org/wiki/Trang">…/Trang</a>_Chính
//
// A WRONG ADDRESS ON THE PUBLISHED PAGE, before any save and with nothing in the source to
// explain it. The same URL in plain prose is one node and always worked, which is why no
// fixture caught it: `golden/corpus/autolinks.md` writes them all in prose.
import { describe, expect, it } from 'bun:test'
import { parse, toHtml } from './index'
import { toMarkdown } from './to-markdown'

describe('a bare URL with an underscore in it', () => {
  const wiki = 'https://vi.wikipedia.org/wiki/Trang_Ch%C3%ADnh'
  const cases: ReadonlyArray<readonly [string, string]> = [
    ['in prose', 'https://vi.wikipedia.org/wiki/Trang_Chính\n'],
    ['in bold', '**https://vi.wikipedia.org/wiki/Trang_Chính**\n'],
    ['in italics', '*https://vi.wikipedia.org/wiki/Trang_Chính*\n'],
    ['struck through', '~~https://vi.wikipedia.org/wiki/Trang_Chính~~\n'],
    ['highlighted', '==https://vi.wikipedia.org/wiki/Trang_Chính==\n'],
    ['bold, inside a quote', '> **https://vi.wikipedia.org/wiki/Trang_Chính**\n'],
    ['bold, inside a list', '- **https://vi.wikipedia.org/wiki/Trang_Chính**\n'],
    ['bold, mid-sentence', 'Xem **https://vi.wikipedia.org/wiki/Trang_Chính** nhé.\n'],
  ]

  for (const [name, source] of cases) {
    it(`links the whole address: ${name}`, () => {
      expect(toHtml(source)).toContain(`href="${wiki}"`)
      // Not half of it with the rest printed as text.
      expect(toHtml(source)).not.toContain('href="https://vi.wikipedia.org/wiki/Trang"')
      // And a save writes back what the author wrote.
      expect(toMarkdown(parse(source))).toBe(source)
    })
  }

  it('leaves emphasis alone, which is what the underscore is for everywhere else', () => {
    // The repair merges adjacent text; it may not swallow a delimiter that did its job.
    expect(toHtml('*nhấn mạnh* và _nghiêng_\n')).toBe('<p><em>nhấn mạnh</em> và <em>nghiêng</em></p>\n')
    expect(toHtml('**a_b** không phải link\n')).toBe('<p><strong>a_b</strong> không phải link</p>\n')
    expect(toHtml('snake_case_name\n')).toBe('<p>snake_case_name</p>\n')
  })

  it('still ends a link where the sentence ends', () => {
    // Trailing punctuation belongs to the prose, merged text or not.
    expect(toHtml('Xem **https://e.com/a_b.** rồi.\n')).toContain('href="https://e.com/a_b"')
    expect(toHtml('Xem **https://e.com/a_b.** rồi.\n')).toContain('.</strong>')
  })
})
