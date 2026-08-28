// The site-wide frame default reaching the page.
//
// Same seam as `gallery-default.test.ts` and the same reason: a rendered body is cached
// under a hash of its INPUT, so a default that changed the markup would leave every
// already-rendered post wearing the old frame until something unrelated evicted it. What is
// pinned here is that the default travels as CSS, that a picture can still override it in
// either direction, and the one thing this default has that the gallery's does not — a
// responsive step, which is where an obvious implementation gets it wrong.

import { describe, expect, it, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { pageStyles } from '@/web/layout'
import { PUBLIC_CSS } from '@/web/public.css'
import { DEFAULT_SETTINGS } from '@/content/settings'
import { sanitizeFigure, DEFAULT_FIGURE } from '@/content/settings-sanitize'
import type { FigureSettings } from '@/types'

const DIR = './.tmp/test-figure'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const styles = (figure: FigureSettings) => pageStyles({ ...DEFAULT_SETTINGS, figure })

describe('the site-wide frame default', () => {
  it('ships with no frame, and says nothing at all while that is the answer', () => {
    expect(DEFAULT_FIGURE.frame).toBe('none')
    expect(styles(DEFAULT_FIGURE)).not.toContain('--fig-default')
  })

  it('names a STEP rather than a length, so the phone rule still reaches it', () => {
    // The obvious implementation writes `--fig-default-pad:1.75rem` here. It would work on a
    // desktop and be wrong on a phone: this block is inlined AFTER the linked sheet, so a
    // length would outrank the media query and a thick default would keep its full mat in a
    // 350px column. Pointing at the step lets `mobile.css.ts` redefine it underneath.
    const css = styles({ frame: 'thick', ink: false })
    expect(css).toContain('--fig-default-pad:var(--fig-step-thick)')
    expect(css).not.toMatch(/--fig-default-pad:[^v]/)
    expect(PUBLIC_CSS).toContain('--fig-step-thick:calc(var(--sp) * 1.75)') // the desktop step
    expect(PUBLIC_CSS).toContain('--fig-step-thick:var(--sp)') // and the phone's, in the media query
  })

  it('gives the ink mat a colour that inverts itself instead of a second setting', () => {
    // `--c-heading` is near-black on a light palette and near-white on a dark one, so one
    // declaration is a dark mat on paper and a light mat at night. A hardcoded colour here
    // would need a media query and would miss every palette the reader can switch to.
    const ink = styles({ frame: 'medium', ink: true })
    expect(ink).toContain('--fig-default-mat:var(--c-heading)')
    const paper = styles({ frame: 'medium', ink: false })
    expect(paper).toContain('--fig-default-mat:var(--c-bg)')
  })

  it('keeps a pale line for an engine with no color-mix, rather than no line at all', () => {
    const css = styles({ frame: 'medium', ink: false })
    const first = css.indexOf('--fig-default-line:var(--c-rule)')
    const mixed = css.indexOf('--fig-default-line:color-mix')
    expect(first).toBeGreaterThan(-1)
    expect(mixed).toBeGreaterThan(first) // the fallback is declared first, so the mix wins where it parses
  })

  it('lets a picture override the default in BOTH directions', () => {
    // Silence follows the site. A frame class overrides it upward; `img-noframe` overrides
    // it downward, which is the half that only matters once a site default exists.
    expect(PUBLIC_CSS).toContain('padding:var(--fig-pad,var(--fig-default-pad,0))')
    expect(PUBLIC_CSS).toContain('.img-noframe{--fig-pad:0')
  })

  it('refuses a frame weight it does not have', () => {
    expect(sanitizeFigure({ frame: 'huge' }, DEFAULT_FIGURE).frame).toBe('none')
    expect(sanitizeFigure({ frame: 'thin' }, DEFAULT_FIGURE).frame).toBe('thin')
    expect(sanitizeFigure({ ink: 'yes' }, DEFAULT_FIGURE).ink).toBe(false)
  })
})
