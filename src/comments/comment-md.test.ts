import { describe, it, expect } from '@/test/vitest'
import { renderCommentMarkdown } from '@/comments/comment-md'

describe('renderCommentMarkdown', () => {
  it('renders bold and italic only', () => {
    expect(renderCommentMarkdown('a **b** c')).toBe('a <strong>b</strong> c')
    expect(renderCommentMarkdown('a *b* c')).toBe('a <em>b</em> c')
    expect(renderCommentMarkdown('__b__ and _i_')).toBe('<strong>b</strong> and <em>i</em>')
  })

  it('escapes raw HTML — no tag the user typed survives', () => {
    expect(renderCommentMarkdown('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    )
    expect(renderCommentMarkdown('<b onclick="x">hi</b>')).not.toContain('<b')
  })

  it('does NOT render links, images, headings, or code', () => {
    expect(renderCommentMarkdown('[x](https://evil.com)')).toBe('[x](https://evil.com)')
    expect(renderCommentMarkdown('![x](y.png)')).toBe('![x](y.png)')
    expect(renderCommentMarkdown('# heading')).toBe('# heading')
    expect(renderCommentMarkdown('`code`')).toBe('`code`')
  })

  it('keeps newlines as <br>, emphasis does not span lines', () => {
    expect(renderCommentMarkdown('a\nb')).toBe('a<br>b')
    expect(renderCommentMarkdown('*a\nb*')).toBe('*a<br>b*')
  })

  it('caps length at 1000 chars', () => {
    const long = 'x'.repeat(1500)
    expect(renderCommentMarkdown(long).length).toBe(1000)
  })
})
