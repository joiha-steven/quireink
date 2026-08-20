// The minifier runs over the sheet every reader receives, so what is tested here is not the
// byte count. It is the two constructs in that sheet a careless minifier destroys silently.
import { describe, expect, it } from 'bun:test'
import { minifyCss } from '@/web/css-min'
import { PUBLIC_CSS } from '@/web/public.css'

describe('minifyCss', () => {
  it('drops comments and the whitespace they sat in', () => {
    expect(minifyCss('a{color:red}/* why */\nb{color:blue}')).toBe('a{color:red}b{color:blue}')
  })

  it('drops the semicolon before a closing brace', () => {
    expect(minifyCss('a{color:red;}')).toBe('a{color:red}')
  })

  // The one that would be silent: a space before a colon is a DESCENDANT combinator, and
  // removing it changes which elements the rule matches.
  it('keeps the space that makes a descendant selector a descendant selector', () => {
    expect(minifyCss('.book-flow :is(img,pre){break-inside:avoid}'))
      .toBe('.book-flow :is(img,pre){break-inside:avoid}')
    expect(minifyCss('.prose > :first-child{margin-top:0}'))
      .toBe('.prose > :first-child{margin-top:0}')
  })

  // CSS REQUIRES the whitespace around + and - inside calc().
  it('keeps the spaces calc() cannot do without', () => {
    expect(minifyCss('a{width:calc(100% + var(--rail-w))}'))
      .toBe('a{width:calc(100% + var(--rail-w))}')
    expect(minifyCss('a{top:calc(var(--sp) * 2)}')).toBe('a{top:calc(var(--sp) * 2)}')
  })

  it('leaves the inside of a quoted string alone, spaces and slashes and all', () => {
    const svg = `a{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://a/b' width='2'%3E%3C/svg%3E")}`
    expect(minifyCss(svg)).toBe(svg)
    // A comment opener inside generated content is content, not a comment.
    expect(minifyCss('a::before{content:"/*"}')).toBe('a::before{content:"/*"}')
    expect(minifyCss('a::before{content:"("}')).toBe('a::before{content:"("}')
  })

  it('is idempotent, so serving it twice cannot degrade it', () => {
    const once = minifyCss(PUBLIC_CSS)
    expect(minifyCss(once)).toBe(once)
  })
})

describe('the public sheet, minified', () => {
  const min = minifyCss(PUBLIC_CSS)

  it('ships no comment text at all', () => {
    expect(min).not.toContain('/*')
    expect(min).not.toContain('*/')
  })

  it('is a large enough saving to be worth the code', () => {
    // Was .55, loosened to .9 while the pen's data-URIs lived in this sheet (0025/0026) and
    // drowned the ratio, and TIGHTENED BACK once ADR 0027 moved the ink into its own two
    // hashed files: site.css is hand-written prose again, measured at .39 after the split,
    // so a ratio drifting past .55 means comment text is leaking through the strip.
    expect(min.length).toBeLessThan(PUBLIC_CSS.length * 0.55)
    expect(PUBLIC_CSS.length - min.length).toBeGreaterThan(40_000)
  })

  // A spot check that the load-bearing rules survived, keyed on the ones that have each cost
  // this project a debugging session.
  it('still carries the rules that have gone missing before', () => {
    for (const fragment of [
      'box-sizing:border-box',
      'font-family:var(--font-sans)',
      '--type-scale:1.15',
      'animation-timeline:scroll(root block)',
      '@media (hover:none)',
      'min-width:0',
      '.skip-link',
      'break-inside:avoid',
    ]) {
      expect(min).toContain(fragment)
    }
  })

  it('keeps every at-rule it was given', () => {
    const count = (s: string, re: RegExp) => (s.match(re) ?? []).length
    // Compared against the sheet with its comments taken out, not the raw source: the
    // comments TALK about the rules ("the @supports rule removes it entirely"), so the raw
    // source counts mentions as well as rules and the comparison would never hold.
    const bare = PUBLIC_CSS.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(count(min, /@media/g)).toBe(count(bare, /@media/g))
    expect(count(min, /@supports/g)).toBe(count(bare, /@supports/g))
    expect(count(min, /@keyframes/g)).toBe(count(bare, /@keyframes/g))
    // Braces balance, which is the cheapest proof that no block was swallowed.
    expect(count(min, /\{/g)).toBe(count(min, /\}/g))
    expect(count(min, /\{/g)).toBe(count(bare, /\{/g))
  })
})
