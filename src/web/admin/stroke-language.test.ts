// ONE STROKE LANGUAGE, held by a test: a glyph in the admin or on the sign-in page is drawn at
// the weights `src/icons.ts` documents, or it is one of the listed things that are not glyphs.
//
// Before this test the admin drew its icons at 1.8, 1.6, 1.7, 2 and 1.1 depending on who wrote the
// wrapper that day (a calendar at 1.6, the sign-in eye and key at 1.7), and a drawn weight is
// invisible in a code review: the three numbers differ by a fraction of a pixel at 18px and
// together make a column of glyphs that does not look like one hand.
//
// The scan reads SOURCE, not the rendered page, because the thing being guarded is a number typed
// at a call site. A weight that arrives by interpolation (`${ICON_STROKE}`) is not a literal and
// is not flagged: that is the form every wrapper takes now.
import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { ECHO_STROKE, GLYPH_ECHO_STROKE, GLYPH_STROKE, ICON_STROKE } from '@/icons'

const SRC = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

const ALLOWED = new Set<number>([ICON_STROKE, ECHO_STROKE, GLYPH_STROKE, GLYPH_ECHO_STROKE])

/**
 * Not glyphs, so not bound to the set: a check tick is a 16-unit mark drawn heavier so it stays
 * a stroke at 12px, and a sparkline or chart line is data, not a symbol. Each entry names the file
 * and the literal, and the test fails when the file stops containing it, so this list cannot
 * outlive the thing it excuses.
 */
const NOT_GLYPHS: { file: string; stroke: number; why: string }[] = [
  { file: 'web/admin/kit.ts', stroke: 2, why: 'the drawn checkbox tick, a 16-unit mark' },
  { file: 'web/admin/fields-pick.ts', stroke: 2, why: 'the picker tick, a 16-unit mark' },
  { file: 'admin-shared/media-marks.ts', stroke: 2, why: 'the picture tile tick, a 16-unit mark' },
  { file: 'web/admin/screens/dashboard-cards.ts', stroke: 1.5, why: 'the dashboard sparkline' },
  { file: 'web/admin/screens/analytics-kit.ts', stroke: 1.5, why: 'the analytics chart lines' },
  // A 12-unit data URI drawn 1:1 behind the sign-in select. The set's 1.8 of 24 would be 0.9px at
  // 12px, a hairline against the field's text, so this chevron keeps the 1.6px it has always had.
  { file: 'web/login.css.ts', stroke: 1.6, why: 'the sign-in select chevron, a 12px data URI' },
]

/**
 * Every literal stroke weight in a source text, in any of the forms a weight gets typed: an HTML
 * attribute quoted or not (`stroke-width="2"`, `stroke-width=2`), a DOM attribute map
 * (`'stroke-width': '2'`), `setAttribute('stroke-width', '2')`, a style declaration
 * (`stroke-width: 2`) and a property (`strokeWidth: '2'`). The number must follow directly, so a
 * weight that arrives by interpolation (`${ICON_STROKE}`) or a `var()` is not a literal.
 */
export function literalStrokes(text: string): number[] {
  return [...text.matchAll(/(?:stroke-width|strokeWidth)['"]?\s*[=:,]\s*['"]?(\d*\.?\d+)/g)].map((m) => Number(m[1]))
}

/** The strokes in `text` that are neither in the set nor excused for `file`. */
export function offenders(file: string, text: string): number[] {
  const excused = new Set(NOT_GLYPHS.filter((e) => e.file === file).map((e) => e.stroke))
  return literalStrokes(text).filter((n) => !ALLOWED.has(n) && !excused.has(n))
}

function sources(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    if (name === 'dist' || name === 'node_modules') continue
    const path = join(dir, name)
    if (statSync(path).isDirectory()) out.push(...sources(path))
    else if (name.endsWith('.ts') && !name.endsWith('.test.ts')) out.push(path)
  }
  return out
}

const TREES = ['admin', 'web/admin', 'admin-shared']
const FILES = [...TREES.flatMap((t) => sources(join(SRC, t))), join(SRC, 'web/login-page.ts'), join(SRC, 'web/login.css.ts')]
const rel = (path: string): string => path.slice(SRC.length).replaceAll('\\', '/')

describe('stroke language', () => {
  test('the scan itself bites: a stray weight is reported, the set and a not-a-glyph are not', () => {
    expect(offenders('web/admin/x.ts', '<svg stroke-width="1.7">')).toEqual([1.7])
    expect(offenders('web/admin/x.ts', `'stroke-width': '1.6'`)).toEqual([1.6])
    expect(offenders('web/admin/x.ts', '<svg stroke-width=1.7>')).toEqual([1.7])
    expect(offenders('web/admin/x.ts', `svg.setAttribute('stroke-width', '1.7')`)).toEqual([1.7])
    expect(offenders('web/admin/x.ts', 'style="stroke-width: 1.7"')).toEqual([1.7])
    expect(offenders('web/admin/x.ts', `{ strokeWidth: '1.7' }`)).toEqual([1.7])
    expect(offenders('web/admin/x.ts', `{ strokeWidth: 1.7 }`)).toEqual([1.7])
    expect(offenders('web/admin/x.ts', `stroke-width='1.7'`)).toEqual([1.7])
    expect(offenders('web/admin/x.ts', 'stroke-width: var(--w)')).toEqual([])
    expect(offenders('web/admin/x.ts', '<svg stroke-width="1.8"><path stroke-width="1.4"/>')).toEqual([])
    expect(offenders('web/admin/kit.ts', '<path stroke-width="2"/>')).toEqual([])
    expect(offenders('web/admin/x.ts', '<path stroke-width="2"/>')).toEqual([2])
    expect(offenders('web/admin/x.ts', 'stroke-width="${ICON_STROKE}"')).toEqual([])
  })

  test('the scan reaches real files, or a green result means nothing', () => {
    expect(FILES.length).toBeGreaterThan(100)
    expect(FILES.some((f) => rel(f) === 'web/admin/kit.ts')).toBe(true)
    expect(FILES.some((f) => rel(f) === 'web/login-page.ts')).toBe(true)
    expect(FILES.some((f) => rel(f) === 'web/login.css.ts')).toBe(true)
  })

  test('no admin or sign-in file draws at a weight outside the icon set', () => {
    const bad = FILES.flatMap((f) => offenders(rel(f), readFileSync(f, 'utf8')).map((n) => `${rel(f)}: stroke-width ${n}`))
    expect(bad).toEqual([])
  })

  test('every excused file still contains the literal that excuses it', () => {
    for (const e of NOT_GLYPHS) {
      expect(literalStrokes(readFileSync(join(SRC, e.file), 'utf8'))).toContain(e.stroke)
    }
  })

  test('the set itself carries only its own echo weights', () => {
    const icons = readFileSync(join(SRC, 'icons.ts'), 'utf8')
    expect([...new Set(literalStrokes(icons))].sort()).toEqual([GLYPH_ECHO_STROKE, ECHO_STROKE].sort())
  })
})
