// WHAT THIS BLOG ANSWERS, as against what the engine asks.
//
// `md/html-rules.test.ts` measures the engine's half — each rule doing what it says when a
// host asks for it. This measures the two answers that could not stay in the engine, because
// both of them are the rest of the application: a slug function that knows Vietnamese and
// Cyrillic, and Temml.
//
// It is the only place that checks the wiring at all. `PAGE` is one object literal, and a
// `math` left at `null` in it would publish every formula on the site as its own TeX with
// nothing going red — the page would still render, and nobody reads MathML by eye.
import { describe, expect, it } from 'bun:test'
import { toHtml } from '@/md/index'
import { PAGE } from '@/render/page-rules'

describe('headingId: this blog writes its headings in two alphabets', () => {
  it('anchors a Vietnamese heading by its letters without their marks', () => {
    expect(toHtml('## Cách làm\n', PAGE)).toContain('id="cach-lam"')
    expect(toHtml('### Cách làm\n', PAGE)).toContain('id="cach-lam"')
    expect(toHtml('#### Cách làm\n', PAGE)).not.toContain('id=')
  })

  it('reads the heading\'s words rather than its source line', () => {
    // v1 slugified marked's raw text, so `## [Tài liệu](/docs)` anchored at `tai-lieudocs` —
    // the destination baked into the anchor.
    expect(toHtml('## [Tài liệu](/docs)\n', PAGE)).toContain('id="tai-lieu"')
    expect(toHtml('## **Đậm** và *nghiêng*\n', PAGE)).toContain('id="dam-va-nghieng"')
  })

  it('gives no id to a heading that slugifies to nothing', () => {
    // An id nothing links to is worse than none: `extractHeadings` skips it too, and the ToC
    // and the page staying in step is the whole point.
    expect(toHtml('## !!!\n', PAGE)).not.toContain('id=')
  })
})

describe('math: the reader gets MathML, not TeX', () => {
  it('renders a formula through Temml rather than falling back to its source', () => {
    const html = toHtml('Đặt $x^2$ vào đây.\n', PAGE)
    expect(html).toContain('<math')
    expect(html).not.toContain('class="math"')
  })

  it('renders a display formula the same way, inside the block that scrolls', () => {
    const html = toHtml('$$\\frac{a}{b}$$\n', PAGE)
    expect(html).toContain('<div class="math-block">')
    expect(html).toContain('<math')
    expect(html).toContain('display="block"')
  })

  it('shows a broken formula as the writer typed it, and nothing else', () => {
    // Temml's own error rendering paints the offending command in a hardcoded firebrick, and
    // a colour baked into a CACHED body outlives the palette that was supposed to control it.
    const html = toHtml('$\\frac{a}$\n', PAGE)
    expect(html).toContain('math-error')
    expect(html).not.toContain('#b22222')
  })
})
