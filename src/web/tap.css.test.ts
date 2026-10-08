// The 24px tap floor for small text links (WCAG 2.5.8).
import { describe, expect, it } from 'bun:test'
import { TAP_CSS } from '@/web/tap.css'
import { MOBILE_CSS } from '@/web/mobile.css'
import { PUBLIC_CSS } from '@/web/public.css'

describe('tap targets', () => {
  it('grows the hit area of every small link without moving a line', () => {
    for (const sel of ['.card-kick a', 'aside.series li a', '.series-name a', '.related li a', '.author-name a',
      '.byline a', 'a.post-cat', 'p.mt-3 > a']) expect(TAP_CSS).toContain(sel)
    // padding and an EQUAL negative margin: the block-level link gets its height back
    expect(TAP_CSS).toContain('{padding-block:.25em;margin-block:-.25em}')
    expect(TAP_CSS).toContain('@media (max-width:48rem)')
  })
  it('is shipped, and before the coarse pointer rules so the larger floor wins', () => {
    expect(PUBLIC_CSS).toContain(TAP_CSS)
    expect(MOBILE_CSS.indexOf(TAP_CSS)).toBeLessThan(MOBILE_CSS.indexOf('@media (pointer:coarse)'))
  })
})
