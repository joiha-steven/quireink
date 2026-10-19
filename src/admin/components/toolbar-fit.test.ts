// What the button row keeps and what goes behind "More", decided from widths alone.
// The rooms below are the strip widths measured on the editor (less the strip's 2 x 16px
// padding), so each case is a window somebody writes in rather than an invented number.
import { describe, expect, it } from 'bun:test'
import { fitRow } from './toolbar-fit'
import { TOOLBAR_CLUSTERS } from '@/admin-shared/toolbar-shape'

/** The real bar: keys are 36px, 2px apart in a cluster, clusters 8px apart, More is one key. */
const KEY = 36
const KEY_GAP = 2
const GAP = 8
const BAR = TOOLBAR_CLUSTERS.map((n) => Array.from({ length: n }, () => KEY))
const fit = (room: number) => fitRow(BAR, room, KEY, GAP, KEY_GAP)

describe('fitRow: which clusters stay on the one row', () => {
  it('keeps everything, and no More key, when the row fits', () => {
    // 1920 with the panel shut (strip 1038), 1440 shut (1134), 1280 (974).
    expect(fit(1006)).toEqual({ whole: 5, part: 0 })
    expect(fit(1102)).toEqual({ whole: 5, part: 0 })
    expect(fit(942)).toEqual({ whole: 5, part: 0 })
  })

  it('fits a row that is exactly as wide as the room, and not one pixel more', () => {
    // 6+6+3+3+6 keys: 226 + 226 + 112 + 112 + 226 and four 8px gaps = 934.
    expect(fit(934)).toEqual({ whole: 5, part: 0 })
    expect(fit(933)).toEqual({ whole: 4, part: 0 })
  })

  it('moves the inserts behind More at 1024 shut and at 1920 docked', () => {
    expect(fit(838)).toEqual({ whole: 4, part: 0 }) // 1024: strip 870
    expect(fit(854)).toEqual({ whole: 4, part: 0 }) // 1920 docked: strip 886
  })

  it('moves the shapes and the inserts at 1440 docked', () => {
    // strip 750: three clusters (580) + gap + More = 624 fits in 718; a fourth (744) does not.
    expect(fit(718)).toEqual({ whole: 3, part: 0 })
  })

  it('moves whole clusters from the end, never splitting one while a cluster fits', () => {
    // Room for the marks and More (226 + 8 + 36 = 270) but not for the blocks after them.
    expect(fit(270)).toEqual({ whole: 1, part: 0 })
    expect(fit(503)).toEqual({ whole: 1, part: 0 })
    expect(fit(504)).toEqual({ whole: 2, part: 0 })
  })

  it('splits the first cluster only when not even that fits beside More', () => {
    expect(fit(269)).toEqual({ whole: 0, part: 5 })
    expect(fit(100)).toEqual({ whole: 0, part: 1 })
    expect(fit(43)).toEqual({ whole: 0, part: 0 })
  })

  it('reads the clusters it is given, not a fixed shape', () => {
    expect(fitRow([[40, 40], [40]], 130, 30, 10, 0)).toEqual({ whole: 2, part: 0 })
    expect(fitRow([[40, 40], [40]], 129, 30, 10, 0)).toEqual({ whole: 1, part: 0 })
    expect(fitRow([], 0, 36, 8, 2)).toEqual({ whole: 0, part: 0 })
  })

  it('forgives a subpixel layout half a pixel, and no more', () => {
    expect(fit(933.5)).toEqual({ whole: 5, part: 0 })
    expect(fit(933.4)).toEqual({ whole: 4, part: 0 })
  })
})
