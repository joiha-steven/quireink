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
//
// IT DRIVES A LOCAL BUNDLE RATHER THAN THIS BLOG'S. `render/page-rules.ts` is the blog's set
// and it holds two functions the engine may not own — a slug function that knows Vietnamese
// and a LaTeX engine — so a suite inside the engine that reached for it would be the one
// import standing between `src/md` and its own repository. What is measured here is the
// engine's half: that each rule does what it says when a host asks for it, and the spec's
// answer when nobody does. The blog's own answers are measured next door.

import { describe, expect, it } from 'bun:test'
import { GFM, SPEC, toHtml, type PageRules } from './index'

/** A host with an opinion about all six. The slug is ASCII-only on purpose: which words a
 *  heading is anchored by is the engine's business, and HOW they become a slug is the host's. */
const HOST: PageRules = {
  ...GFM,
  rawHtml: 'escape',
  softBreak: 'br',
  safeLinks: true,
  demoteHeadings: true,
  headingId: (text, level) =>
    (level === 2 || level === 3
      ? text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || null
      : null),
  tableScope: true,
  math: null,
}

describe('safeLinks: the schemes that execute', () => {
  // ⚠️ THE REGRESSION THIS FILE EXISTS FOR. Found by rendering `golden/corpus` through the new
  // engine and diffing against the page v1 produces — the engine wrote the live scheme
  // straight into the href, because escaping a URL does not change a single character of
  // `javascript:alert(1)` and there was no check after it.
  for (const scheme of ['javascript:alert(1)', 'JavaScript:alert(1)', 'data:text/html,<script>x</script>', 'vbscript:msgbox']) {
    it(`disarms ${scheme.slice(0, 24)}`, () => {
      const html = toHtml(`[js](${scheme})\n`, HOST)
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
      const href = /href="([^"]*)"/.exec(toHtml(`${source}\n`, HOST))?.[1] ?? ''
      // The ASSERTION IS ON THE href ALONE. `<javascript:alert(1)>` renders the scheme as the
      // link's visible TEXT, which is inert — a test that searched the whole page would call
      // that a failure and teach somebody to weaken the check.
      expect(href).not.toMatch(/^(?:javascript|data|vbscript):/i)
    })
  }

  it('leaves the scheme visible as text where it is only text', () => {
    // An autolink to a dangerous scheme loses its destination and keeps its words: a reader
    // can still see what somebody tried to post, and clicking it goes nowhere.
    const html = toHtml('<javascript:alert(1)>\n', HOST)
    expect(html).toContain('href="#"')
    expect(html).toContain('>javascript:alert(1)<')
  })

  it('leaves an ordinary destination exactly as it was', () => {
    // The cost of a safety control is what it breaks, and this is the measurement of it.
    for (const url of ['https://example.com/a?b=1&c=2', '/uploads/x.png', '#section', 'mailto:a@b.co']) {
      expect(toHtml(`[t](${url})\n`, HOST)).toBe(toHtml(`[t](${url})\n`, GFM))
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
    expect(toHtml('# Body\n', HOST)).toContain('<h2')
    expect(toHtml('# Body\n', HOST)).not.toContain('<h1')
  })

  it('leaves every other level where the author put it', () => {
    for (const [hashes, tag] of [['##', 'h2'], ['###', 'h3'], ['######', 'h6']] as const) {
      expect(toHtml(`${hashes} T\n`, HOST)).toContain(`<${tag}`)
    }
  })
})

describe('headingId: the anchors a table of contents links to', () => {
  it('gives h2 and h3 an id and nothing else one', () => {
    expect(toHtml('## Two words\n', HOST)).toContain('id="two-words"')
    expect(toHtml('### Two words\n', HOST)).toContain('id="two-words"')
    expect(toHtml('#### Two words\n', HOST)).not.toContain('id=')
  })

  it('hands the function the heading\'s WORDS, not its source line', () => {
    // v1 slugified marked's raw text, so `## [Tài liệu](/docs)` anchored at `tai-lieudocs` —
    // the destination baked into the anchor. The tree knows which part is the words, and what
    // is pinned here is the STRING the host is given: the slug itself is the host's business.
    const seen: [string, number][] = []
    const spy: PageRules = { ...HOST, headingId: (text, level) => { seen.push([text, level]); return 'x' } }
    toHtml('## [Tài liệu](/docs)\n', spy)
    toHtml('## **Đậm** và *nghiêng*\n', spy)
    expect(seen).toEqual([['Tài liệu', 2], ['Đậm và nghiêng', 2]])
  })

  it('gives no id where the function answers null', () => {
    // `## !!!` has no anchorable name. v1 emitted no id and `extractHeadings` skipped it, and
    // the two staying in step is the whole point — an id nothing links to is worse than none.
    expect(toHtml('## !!!\n', HOST)).not.toContain('id=')
  })
})

describe('math: a formula the host has no renderer for', () => {
  it('publishes the author\'s own TeX rather than a blank or a stack trace', () => {
    // The engine ships no LaTeX engine and must not: `PageRules.math` is the slot, and the
    // fallback is the source, escaped, so a formula on a host without one is still readable
    // and still correctable on the page it is wrong on.
    expect(toHtml('$a < b$\n', HOST)).toContain('<span class="math">a &lt; b</span>')
    expect(toHtml('$$a < b$$\n', HOST)).toContain('<div class="math">a &lt; b</div>')
  })

  it('hands the formula and its display flag to the one the host gives', () => {
    const seen: [string, boolean][] = []
    const rules: PageRules = { ...HOST, math: (tex, display) => { seen.push([tex, display]); return '<m/>' } }
    expect(toHtml('a $x^2$ b\n\n$$y$$\n', rules)).toContain('<m/>')
    expect(seen).toEqual([['x^2', false], ['y', true]])
  })
})

describe('tableScope: a column header that says it is one', () => {
  it('marks header cells and leaves body cells alone', () => {
    const html = toHtml('| A | B |\n| --- | ---: |\n| 1 | 2 |\n', HOST)
    expect(html).toContain('<th scope="col">A</th>')
    // Alignment still follows the scope, and still only where the source asked for it.
    expect(html).toContain('<th scope="col" align="right">B</th>')
    expect(html).toContain('<td>1</td>')
  })
})

describe('rawHtml: the promise that a post is 100% Markdown', () => {
  const source = '<div class="x">hi</div>\n\nan <b>inline</b> tag\n'

  it('shows every tag as the characters somebody typed', () => {
    const html = toHtml(source, HOST)
    expect(html).toContain('&lt;div class="x"&gt;')
    expect(html).toContain('&lt;b&gt;')
    expect(html).not.toContain('<div')
    expect(html).not.toContain('<b>')
  })

  it('escapes the ampersand before it escapes anything else', () => {
    // `&` last would eat the `&lt;` the previous replacement had just written, and the tag
    // would come back to life. The reader sees `<p>a &amp; b</p>` — every character typed.
    expect(toHtml('<p>a &amp; b</p>\n', HOST)).toBe('&lt;p&gt;a &amp;amp; b&lt;/p&gt;\n')
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
    // after a host's render would silently inherit that host — heading demotion and all.
    toHtml('# x\n', HOST)
    expect(toHtml('# x\n')).toContain('<h1')
  })
})
