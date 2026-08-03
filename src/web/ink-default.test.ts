// The highlighter's stroke setting reaching the page.
//
// Same seam, and the same reason, as `gallery-default.test.ts`: rendered Markdown is cached
// under a hash of its input, so the stroke has to arrive as CSS. If it were ever baked into
// the markup, changing the setting would leave every already-rendered body wearing the old
// stroke until something unrelated evicted it — and the settings screen would look broken
// while being, technically, correct.

import { describe, expect, it, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { pageStyles } from '@/web/layout'
import { PUBLIC_CSS } from '@/web/public.css'
import { DEFAULT_SETTINGS } from '@/content/settings'
import { sanitizeHighlight, DEFAULT_HIGHLIGHT, HIGHLIGHT_STROKES } from '@/content/settings-sanitize'
import { INKS } from '@/render/ink'
import type { HighlightSettings } from '@/types'

const DIR = './.tmp/test-ink'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const styles = (highlight: HighlightSettings) => pageStyles({ ...DEFAULT_SETTINGS, highlight })

describe('the site-wide highlighter stroke', () => {
  it('emits nothing at all for the default, so an untouched site pays no bytes', () => {
    const css = styles(DEFAULT_HIGHLIGHT)
    expect(css).not.toContain('--ink-h0')
    expect(css).not.toContain('--ink-y0')
  })

  it('moves the band down and shortens it for the fast pass', () => {
    const css = styles({ stroke: 'swipe' })
    expect(css).toContain('--ink-h0:.8em')
    expect(css).toContain('--ink-y0:.76em')
    // One layer only: the second is what makes a stroke a double pass.
    expect(css).not.toContain('--ink-h2')
  })

  it('turns on the second layer only for the double pass', () => {
    const css = styles({ stroke: 'double' })
    expect(css).toContain('--ink-h2:.88em')
    expect(css).toContain('--ink-y2:.72em')
  })

  it('reads those variables in the sheet, with the marker geometry as the fallback', () => {
    // The var() fallbacks ARE the default stroke. If these drift from highlightCss the
    // default silently becomes something nobody chose.
    expect(PUBLIC_CSS).toContain('--ink-h:var(--ink-h0,1.05em)')
    expect(PUBLIC_CSS).toContain('--ink-y:var(--ink-y0,.5em)')
    // A zero-height second layer paints nothing, which is what keeps all three strokes
    // inside one rule instead of three variants that have to be kept in step.
    expect(PUBLIC_CSS).toContain('background-size:100% var(--ink-h),100% var(--ink-h2,0)')
  })

  it('ships a stroke for every ink, in both light and dark', () => {
    for (const ink of INKS) {
      const selector = ink === 'yellow' ? '.prose mark{' : `.prose mark[data-ink=${ink}]{`
      expect(PUBLIC_CSS).toContain(selector)
      expect(PUBLIC_CSS).toContain(`.dark ${selector}`)
    }
  })

  it('drops the multiply blend in dark mode and lifts the words to the heading colour', () => {
    // Multiply on a near-black page turns every ink to mud; `opacity` on the mark would fade
    // the TEXT with it, making a highlighted word dimmer than the words around it.
    expect(PUBLIC_CSS).toContain('.dark .prose mark{mix-blend-mode:normal;color:var(--c-heading)}')
  })

  it('rejects a stroke it does not have, without disturbing the current one', () => {
    expect(sanitizeHighlight({ stroke: 'airbrush' }, { stroke: 'swipe' }).stroke).toBe('swipe')
    expect(sanitizeHighlight(undefined, DEFAULT_HIGHLIGHT).stroke).toBe('marker')
    for (const stroke of HIGHLIGHT_STROKES) {
      expect(sanitizeHighlight({ stroke }, DEFAULT_HIGHLIGHT).stroke).toBe(stroke)
    }
  })
})
