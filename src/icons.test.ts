// What a mark has to survive, and it is not a matter of taste: the reading site draws these
// at 20px, so a 24-unit viewBox renders one unit as 0.83px.
//
// Both guards here are the same bug caught twice. A shape drawn to look right in a 24-unit
// grid on screen can stop being that shape at the size it ships at, and nothing in the
// build says so — the header carried a sun whose rays rendered as dots and a palette that
// read as a face, and the tests, the typecheck and the golden compare were all green.
import { describe, expect, it } from 'bun:test'
import { ICONS } from '@/icons'

/** The stroke every body inherits from its wrapper (`web/chrome.ts`, `admin/navIcons`). */
const STROKE = 1.8

/** Straight-line runs in a path, in viewBox units. Only the commands this set uses. */
function segments(d: string): number[] {
  const out: number[] = []
  for (const [, cmd, args] of d.matchAll(/([MmLlHhVv])\s*([-\d. ]*)/g)) {
    const n = (args.match(/-?\d*\.?\d+/g) ?? []).map(Number)
    if (cmd === 'v' || cmd === 'h') out.push(...n.map(Math.abs))
    else if (cmd === 'l') for (let i = 0; i < n.length; i += 2) out.push(Math.hypot(n[i]!, n[i + 1]!))
  }
  return out
}

describe('a mark has to still be that mark at 20px', () => {
  it('draws the sun with rays rather than with dots', () => {
    // A round cap adds half the stroke at each end, so a 2-unit ray was drawn 3.8 long by
    // 1.8 thick — a 2:1 blob. Eight of those round a disc is a smudge, which is what the
    // header wore. At 3 units the drawn ray is 4.8 by 1.8, and it reads as a line.
    const rays = segments(/<path d="([^"]+)"/.exec(ICONS.theme)![1]!)
    expect(rays.length).toBe(8)
    for (const ray of rays) expect(ray).toBeGreaterThanOrEqual(STROKE * 1.6)
  })

  it('keeps daylight between the sun and its rays', () => {
    // Both grow by half a stroke towards each other. At r=4 with rays starting at 6.5 the
    // gap on screen was 0.5px, and the disc and the ring of rays merged into one blob.
    const r = Number(/r="([\d.]+)"/.exec(ICONS.theme)![1])
    // The ray straight up the centre: it starts at the rim and runs inward, so where it
    // stops IS the radius the ring of rays begins at.
    const [, top, len] = /M12 ([\d.]+)v([\d.]+)/.exec(ICONS.theme)!
    const inner = 12 - (Number(top) + Number(len))
    expect(inner - r - STROKE).toBeGreaterThanOrEqual(1)
  })

  it('spends three strokes on the menu, because two cannot say "list"', () => {
    // It was two bars of unequal length, and at 20px that is an EQUALS SIGN: two lines with
    // one gap between them have no rhythm to read as a list. The set's taste for asymmetry
    // stays in the LENGTHS - the last bar is short - but never in the count, which is the
    // part that carries what the mark is.
    const bars = ICONS.menu.match(/M[\d.]+ [\d.]+h[\d.]+/g) ?? []
    expect(bars.length).toBeGreaterThanOrEqual(3)
  })

  it('gives the palette a silhouette, because a ring with dots in it is a face', () => {
    // Two dots level near the top and a third below the centre is where a person's features
    // go. The ring version was read as a face on the live header and could not be unseen;
    // what tells a palette apart from a face is the outline — the swelling top and the
    // thumb notch — so the outline has to be a drawn shape and not a circle.
    expect(ICONS.palette.startsWith('<path ')).toBe(true)
    expect(/<circle[^>]*r="[5-9]/.test(ICONS.palette)).toBe(false)
  })
})

describe('one hand across the whole set', () => {
  it('allows 1.4 as the only local stroke, and only for an echo', () => {
    // The file's own rule, unguarded until now: a body inherits its weight from the wrapper
    // and may override it once, for the echo stroke. Three weights in one set is how the
    // icons looked before there was a set.
    for (const [name, body] of Object.entries(ICONS)) {
      for (const [, w] of body.matchAll(/stroke-width="([\d.]+)"/g)) {
        expect(`${name}:${w}`).toBe(`${name}:1.4`)
      }
    }
  })

  it('draws every mark inside the 24-unit box, caps included', () => {
    // A cap that overhangs the viewBox is clipped, and the clip only shows at some sizes.
    for (const [name, body] of Object.entries(ICONS)) {
      for (const [, n] of body.matchAll(/[ "](-?\d+\.?\d*)/g)) {
        expect(`${name} ${Number(n) >= -1 && Number(n) <= 25}`).toBe(`${name} true`)
      }
    }
  })
})
