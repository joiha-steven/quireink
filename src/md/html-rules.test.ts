// THE FOUR THINGS THE SPEC DOES NOT SAY, and one of them is a hole that was open.
//
// `spec.test.ts` measures the engine against CommonMark and GFM, and passes 672 of 676
// examples without ever looking at these rules — because no Markdown spec has an opinion
// about them. That is exactly why they need a file: a rule no spec measures is a rule that
// disappears quietly, and the first of the four is what stands between a comment box and a
// working `javascript:` link.
//
// Each test below names the v1 behaviour it is holding, because `render/post-content.ts` is
// where all four have lived until now and the engine has to arrive carrying them.

import { describe, expect, it } from 'bun:test'
import { GFM, PAGE, SPEC, toHtml } from './index'

describe('safeLinks: the schemes that execute', () => {
  // ⚠️ THE REGRESSION THIS FILE EXISTS FOR. Found by rendering `golden/corpus` through the new
  // engine and diffing against the page v1 produces — the engine wrote the live scheme
  // straight into the href, because escaping a URL does not change a single character of
  // `javascript:alert(1)` and there was no check after it.
  for (const scheme of ['javascript:alert(1)', 'JavaScript:alert(1)', 'data:text/html,<script>x</script>', 'vbscript:msgbox']) {
    it(`disarms ${scheme.slice(0, 24)}`, () => {
      const html = toHtml(`[js](${scheme})\n`, PAGE)
      expect(html).toContain('href="#"')
      expect(html).not.toContain('javascript:')
      expect(html).not.toContain('vbscript:')
      expect(html).not.toContain('data:text/html')
    })
  }

  // THE SPELLINGS A SANITISER MISSES, each one a way of writing the same scheme that a naive
  // `/^javascript:/` does not recognise. Measured against v1 as well, which blocks all of
  // them too — by refusing to resolve the entities rather than by resolving and then
  // checking. Both arrive safe; this engine has to arrive safe the same number of times.
  const TAB = String.fromCharCode(9)
  const SPELLINGS: [string, string][] = [
    ['a tab inside an angle-bracket destination', `[x](<java${TAB}script:alert(1)>)`],
    ['the colon as a numeric entity', '[x](javascript&#58;alert(1))'],
    ['a tab as a numeric entity', `[x](java&#9;script:alert(1))`],
    ['the first letter as an entity', '[x](&#106;avascript:alert(1))'],
    ['leading whitespace', '[x](  javascript:alert(1))'],
    ['shouted', '[x](JAVASCRIPT:alert(1))'],
    ['hidden in a reference definition', '[x]: javascript:alert(1)\n\n[x]'],
  ]
  for (const [name, source] of SPELLINGS) {
    it(`disarms it when written as ${name}`, () => {
      const href = /href="([^"]*)"/.exec(toHtml(`${source}\n`, PAGE))?.[1] ?? ''
      // The ASSERTION IS ON THE href ALONE. `<javascript:alert(1)>` renders the scheme as the
      // link's visible TEXT, which is inert — a test that searched the whole page would call
      // that a failure and teach somebody to weaken the check.
      expect(href).not.toMatch(/^(?:javascript|data|vbscript):/i)
    })
  }

  it('leaves the scheme visible as text where it is only text', () => {
    // An autolink to a dangerous scheme loses its destination and keeps its words: a reader
    // can still see what somebody tried to post, and clicking it goes nowhere.
    const html = toHtml('<javascript:alert(1)>\n', PAGE)
    expect(html).toContain('href="#"')
    expect(html).toContain('>javascript:alert(1)<')
  })

  it('leaves an ordinary destination exactly as it was', () => {
    // The cost of a safety control is what it breaks, and this is the measurement of it.
    for (const url of ['https://example.com/a?b=1&c=2', '/uploads/x.png', '#section', 'mailto:a@b.co']) {
      expect(toHtml(`[t](${url})\n`, PAGE)).toBe(toHtml(`[t](${url})\n`, GFM))
    }
  })

  it('is off unless a host asks for it', () => {
    // CommonMark says nothing about schemes, and an engine that quietly rewrites a URL is not
    // a CommonMark engine. The default is the spec; the blog asks.
    expect(toHtml('[js](javascript:alert(1))\n', SPEC)).toContain('javascript:alert(1)')
  })
})

describe('demoteHeadings: one h1 on the page', () => {
  it('turns a body h1 into an h2', () => {
    // The page prints the post's TITLE as its only `<h1>`. A second one makes a screen reader
    // announce two documents, and splits the outline in every tool that reads one.
    expect(toHtml('# Body\n', PAGE)).toContain('<h2')
    expect(toHtml('# Body\n', PAGE)).not.toContain('<h1')
  })

  it('leaves every other level where the author put it', () => {
    for (const [hashes, tag] of [['##', 'h2'], ['###', 'h3'], ['######', 'h6']] as const) {
      expect(toHtml(`${hashes} T\n`, PAGE)).toContain(`<${tag}`)
    }
  })
})

describe('headingId: the anchors a table of contents links to', () => {
  it('gives h2 and h3 an id and nothing else one', () => {
    expect(toHtml('## Cách làm\n', PAGE)).toContain('id="cach-lam"')
    expect(toHtml('### Cách làm\n', PAGE)).toContain('id="cach-lam"')
    expect(toHtml('#### Cách làm\n', PAGE)).not.toContain('id=')
  })

  it('reads the heading\'s WORDS, not its source line', () => {
    // v1 slugified marked's raw text, so `## [Tài liệu](/docs)` anchored at `tai-lieudocs` —
    // the destination baked into the anchor. The tree knows which part is the words.
    expect(toHtml('## [Tài liệu](/docs)\n', PAGE)).toContain('id="tai-lieu"')
    expect(toHtml('## **Đậm** và *nghiêng*\n', PAGE)).toContain('id="dam-va-nghieng"')
  })

  it('gives no id to a heading that slugifies to nothing', () => {
    // `## !!!` has no anchorable name. v1 emitted no id and `extractHeadings` skipped it, and
    // the two staying in step is the whole point — an id nothing links to is worse than none.
    expect(toHtml('## !!!\n', PAGE)).not.toContain('id=')
  })
})

describe('tableScope: a column header that says it is one', () => {
  it('marks header cells and leaves body cells alone', () => {
    const html = toHtml('| A | B |\n| --- | ---: |\n| 1 | 2 |\n', PAGE)
    expect(html).toContain('<th scope="col">A</th>')
    // Alignment still follows the scope, and still only where the source asked for it.
    expect(html).toContain('<th scope="col" align="right">B</th>')
    expect(html).toContain('<td>1</td>')
  })
})

describe('rawHtml: the promise that a post is 100% Markdown', () => {
  const source = '<div class="x">hi</div>\n\nan <b>inline</b> tag\n'

  it('shows every tag as the characters somebody typed', () => {
    const html = toHtml(source, PAGE)
    expect(html).toContain('&lt;div class="x"&gt;')
    expect(html).toContain('&lt;b&gt;')
    expect(html).not.toContain('<div')
    expect(html).not.toContain('<b>')
  })

  it('escapes the ampersand before it escapes anything else', () => {
    // `&` last would eat the `&lt;` the previous replacement had just written, and the tag
    // would come back to life. The reader sees `<p>a &amp; b</p>` — every character typed.
    expect(toHtml('<p>a &amp; b</p>\n', PAGE)).toBe('&lt;p&gt;a &amp;amp; b&lt;/p&gt;\n')
  })

  it('still passes raw HTML through under the spec, and filters under GFM', () => {
    expect(toHtml(source, SPEC)).toContain('<div class="x">')
    expect(toHtml('<script>x</script>\n', GFM)).toContain('&lt;script')
    expect(toHtml('<div>ok</div>\n', GFM)).toContain('<div>')
  })
})

describe('the rules do not leak out of one render', () => {
  it('puts the host\'s rules back when it is done', () => {
    // The rules are module-level for the duration of a walk, which is only safe because the
    // walk is synchronous and `toHtml` restores them. If it ever stopped, a page rendered
    // after a PAGE render would silently inherit PAGE — including the heading demotion.
    toHtml('# x\n', PAGE)
    expect(toHtml('# x\n')).toContain('<h1')
  })
})
