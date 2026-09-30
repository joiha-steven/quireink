// A menu row stored before the save refused `javascript:` links is still never printed.
import { describe, expect, it } from 'bun:test'
import { menuBlock } from '@/web/sidebar'
import { isSafeHref } from '@/content/safe-href'

describe('a stored menu link that would run code', () => {
  it('is left out of the rendered menu, and the safe rows stay', () => {
    const html = menuBlock([
      { label: 'Home', href: '/' },
      { label: 'Bad', href: 'javascript:alert(1)' },
      { label: 'Worse', href: 'data:text/html,<script>' },
    ], 'Menu')
    expect(html).toContain('href="/"')
    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('data:')
  })

  it('is told apart by its scheme, with the characters a browser ignores taken out', () => {
    expect(isSafeHref('java\nscript:alert(1)')).toBe(false)
    expect(isSafeHref('\u0001javascript:x')).toBe(false)
    expect(isSafeHref('/p?next=javascript:x')).toBe(true)
    expect(isSafeHref('HTTPS://example.com')).toBe(true)
  })
})
