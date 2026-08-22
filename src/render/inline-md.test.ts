import { describe, it, expect } from '@/test/vitest'
import { renderInlineMarkdown, expandFooterTokens } from '@/render/inline-md'

describe('renderInlineMarkdown', () => {
  it('renders bold, italic, underline', () => {
    expect(renderInlineMarkdown('**b** *i* ++u++')).toBe('<strong>b</strong> <em>i</em> <u>u</u>')
    expect(renderInlineMarkdown('__b__ and _i_')).toBe('<strong>b</strong> and <em>i</em>')
  })

  it('renders safe links (http/https/mailto/relative/anchor)', () => {
    expect(renderInlineMarkdown('[x](https://a.com)')).toBe('<a href="https://a.com" rel="noopener">x</a>')
    expect(renderInlineMarkdown('[m](mailto:a@b.com)')).toContain('href="mailto:a@b.com"')
    expect(renderInlineMarkdown('[r](/about)')).toContain('href="/about"')
    expect(renderInlineMarkdown('[a](#top)')).toContain('href="#top"')
  })

  it('drops dangerous link protocols → plain text, never an <a>', () => {
    expect(renderInlineMarkdown('[x](javascript:alert(1))')).not.toContain('<a')
    expect(renderInlineMarkdown('[x](data:text/html,bad)')).not.toContain('<a')
    expect(renderInlineMarkdown('[x](vbscript:x)')).not.toContain('<a')
  })

  it('escapes raw HTML — no tag the author typed survives', () => {
    expect(renderInlineMarkdown('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(renderInlineMarkdown('[x](https://a.com" onmouseover="x)')).not.toContain('onmouseover="')
  })

  it('caps length at 600 chars', () => {
    expect(renderInlineMarkdown('x'.repeat(900)).length).toBe(600)
  })

  it('expandFooterTokens replaces {year} and {title} (escaping happens at render)', () => {
    const out = expandFooterTokens('© {year} {title}', 'My Blog')
    expect(out).toBe(`© ${new Date().getFullYear()} My Blog`)
  })
})
