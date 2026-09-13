// THE NUMBER. How many of the two specs' 676 examples this engine renders exactly.
//
// A RATCHET, not a pass/fail. Building a CommonMark implementation takes many sittings, and a
// suite that is red until the last one tells nobody anything on any of the days in between —
// so this one asserts against a FLOOR kept in `spec/floor.json` and goes red only when the
// count drops below it. Raising the floor is a deliberate line in a commit, which makes
// progress a thing the repository records rather than a thing somebody remembers.
//
// ⚠️ THE FLOOR MAY ONLY GO UP. Lowering it to make a red check green is the one move this
// file exists to prevent: it is how a rewrite quietly ships worse than what it replaced.
// If an example has to be given up, it goes in `DIVERGED` below with the reason written out,
// where it is visible and countable — and every entry there is a promise that somebody looked.

import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { toHtml } from './index'

type Example = { markdown: string; html: string; example: number; section: string }

const CM: Example[] = JSON.parse(readFileSync('spec/commonmark-0.31.2.json', 'utf8'))
const GFM: Example[] = JSON.parse(readFileSync('spec/gfm-extensions.json', 'utf8'))
const FLOOR: { commonmark: number; gfm: number } = JSON.parse(readFileSync('spec/floor.json', 'utf8'))

/**
 * Examples this engine deliberately answers differently, each with the reason.
 *
 * Empty, and meant to stay nearly so. An entry is not "this one is hard" — it is a decision
 * that the standard's answer is the wrong one for this product, which has happened zero times
 * so far and should stay rare enough to read.
 */
const DIVERGED: Record<number, string> = {}

function run(set: Example[]): { pass: number; fails: Example[] } {
  let pass = 0
  const fails: Example[] = []
  for (const ex of set) {
    if (DIVERGED[ex.example]) continue
    let out: string
    try {
      out = toHtml(ex.markdown)
    } catch {
      fails.push(ex)
      continue
    }
    if (out === ex.html) pass++
    else fails.push(ex)
  }
  return { pass, fails }
}

/** What is failing, grouped, so a sitting knows where to spend itself. */
function report(label: string, total: number, pass: number, fails: Example[]): void {
  const bySection: Record<string, number> = {}
  for (const f of fails) bySection[f.section] = (bySection[f.section] ?? 0) + 1
  const worst = Object.entries(bySection).sort((a, b) => b[1] - a[1]).slice(0, 8)
  const lines = worst.map(([s, n]) => `      ${String(n).padStart(3)}  ${s}`).join('\n')
  console.log(`\n  ${label}: ${pass}/${total} (${((100 * pass) / total).toFixed(1)}%)${lines ? `\n${lines}` : ''}`)
}

describe('the Markdown engine against the specs', () => {
  it('has both spec files, with the examples in them', () => {
    // A guard on the guard: a moved or emptied spec file would turn the rest of this into
    // zero silent tests reporting a perfect score.
    expect(CM.length).toBe(652)
    expect(GFM.length).toBe(24)
  })

  it(`renders at least ${FLOOR.commonmark} of CommonMark 0.31.2`, () => {
    const { pass, fails } = run(CM)
    report('CommonMark 0.31.2', CM.length, pass, fails)
    expect(pass).toBeGreaterThanOrEqual(FLOOR.commonmark)
  })

  it(`renders at least ${FLOOR.gfm} of the GFM extensions`, () => {
    const { pass, fails } = run(GFM)
    report('GFM extensions', GFM.length, pass, fails)
    expect(pass).toBeGreaterThanOrEqual(FLOOR.gfm)
  })

  it('never throws, on any example in either spec', () => {
    // Separate from the counts on purpose. A wrong answer is a bug; an exception reaching the
    // renderer is a blank page, and the two deserve different alarms.
    const threw: number[] = []
    for (const ex of [...CM, ...GFM]) {
      try {
        toHtml(ex.markdown)
      } catch {
        threw.push(ex.example)
      }
    }
    expect(threw).toEqual([])
  })
})
