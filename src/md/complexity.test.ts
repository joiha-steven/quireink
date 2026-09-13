// WHAT A HOSTILE DOCUMENT MAY COST.
//
// Every other suite here asks whether the engine is RIGHT. This one asks whether it can be
// made to stop, which is the question that matters the moment the markdown stops being the
// owner's own — a comment box, a multi-tenant install, or this engine published for other
// people to embed. A parser that is correct and quadratic is a parser that answers a 64 KB
// paste with three seconds of one thread.
//
// MEASURED 2026-09-14, before the fixes in `link-ref.ts` and `inline-link.ts`:
//
//     `[a](` × 4,000  (16 KB)                  215 ms, ×4.0 per doubling — quadratic
//     `[a](` × 4,000 + one `)` at the end      161 ms, ×4.0 per doubling — quadratic
//
// The second shape is the first one's answer defeated by a single character, which is why the
// early-out in `inline-link.ts` is not the fix and the budget in `link-ref.ts` is.
//
// ⚠️ THE CEILINGS BELOW ARE NOT PERFORMANCE TARGETS. They are two orders of magnitude above
// what these inputs cost now (1–3 ms each), so a slow machine or a cold JIT cannot make this
// red; only a return to superlinear growth can. Tightening them into a benchmark is how a
// suite like this starts failing for reasons nobody believes.

import { describe, expect, it } from 'bun:test'
import { toHtml } from './index'

/** Milliseconds for one render, median of three, so a single scheduling hiccup cannot decide. */
function render(source: string): number {
  const runs: number[] = []
  for (let i = 0; i < 3; i++) {
    const t = Bun.nanoseconds()
    toHtml(source, {})
    runs.push((Bun.nanoseconds() - t) / 1e6)
  }
  return runs.sort((a, b) => a - b)[1]!
}

describe('a hostile document still has a bounded cost', () => {
  it('an unclosed link destination does not scan the rest of the document, once per bracket', () => {
    expect(render('[a]('.repeat(4000))).toBeLessThan(500)
  })

  it('and one closing parenthesis at the far end does not bring the cost back', () => {
    // The shape that defeats the early-out: every scan now runs to the end looking for a `)`
    // whose depth can never match. This is the case the budget exists for.
    expect(render('[a]('.repeat(4000) + ')')).toBeLessThan(500)
    expect(render('[a](b'.repeat(4000) + ')')).toBeLessThan(500)
  })

  it('a budget is spent per parse, so the same document twice gives the same answer', () => {
    // A budget remembered against the text would leave the second render of one document with
    // nothing to spend, and it would quietly render differently from the first.
    const source = '[a](b) '.repeat(200) + '[a]('.repeat(2000) + ')'
    expect(toHtml(source, {})).toBe(toHtml(source, {}))
  })

  it('an ordinary document never reaches the budget', () => {
    // 200 real links in a long piece: the allowance is eight times the document's length and
    // this spends a fraction of one percent of it. If this ever goes red, the budget has
    // started refusing honest writing.
    // An ASCII destination on purpose: a URL with Vietnamese in it is percent-encoded on the
    // way out, which is right and is a different test's business.
    const prose = 'Một câu có [một liên kết](https://example.com/mot/duong/kha/dai/nua) trong đó. '
    const source = prose.repeat(200)
    const out = toHtml(source, {})
    expect(out.split('<a href="https://example.com/mot/duong/kha/dai/nua">').length - 1).toBe(200)
  })

  it('deeply nested blockquotes do not recurse away the stack', () => {
    // One character per level, so this is the cheap way to ask for depth. 4,000 levels cost
    // 0.9ms and no stack: the block parser is iterative.
    const out = toHtml('> '.repeat(4000) + 'x', {})
    expect(out).toContain('<blockquote>')
    expect(out).toContain('x')
  })

  it('a paragraph whose lines are indented further each time is linear in its bytes', () => {
    // THE SHAPE THAT COST 98.5% OF THE ENGINE'S TIME. `/^[ \t]+|[ \t]+$/g` trimmed the joined
    // paragraph, and its `$` branch backtracks through a run of spaces one character at a time;
    // a paragraph whose continuation lines grow their indent pays it once per line.
    // MEASURED 2026-09-14 before `trimSpaceTab`: 1,000 lines is 979 KB and took 1,503ms, 2,000
    // lines took 11,817ms. After: 18ms and 69ms, and the per-byte rate stopped falling.
    //
    // The law is the RATE, not the clock: this input quadruples when n doubles, so a time
    // ceiling would have to quadruple with it and would say nothing. Bytes per millisecond may
    // not collapse — half would still pass, and the bug made it fall by a factor of thirty.
    const build = (n: number) => Array.from({ length: n }, (_, i) => ' '.repeat(i * 2) + 'x').join('\n')
    const rate = (n: number) => { const s = build(n); return s.length / Math.max(render(s), 0.001) }
    expect(rate(1000)).toBeGreaterThan(rate(250) / 2)
  })

  it('nesting stops at the ceiling instead of growing without one', () => {
    // 100 containers, so 50 levels of list-and-item. Asked for six times that.
    const source = Array.from({ length: 300 }, (_, i) => ' '.repeat(i * 2) + '- x').join('\n')
    const opens = (toHtml(source, {}).match(/<ul>/g) ?? []).length
    expect(opens).toBeLessThanOrEqual(50)
    expect(opens).toBeGreaterThan(40)
  })

  it('runs of every delimiter cost what ordinary prose of the same length costs', () => {
    // AGAINST PROSE ON THE SAME MACHINE, not against a clock. The first version of this gave
    // each run a 500ms ceiling; it passed here in single milliseconds and went red on CI at
    // 2,695ms, because a shared runner is slow and the ceiling was measuring the runner.
    // A ratio cannot be: whatever the machine, a delimiter run that is linear costs a small
    // multiple of the same number of ordinary characters, and a quadratic one costs hundreds.
    //
    // None of these was ever slow. They are here because an emphasis or code-span rewrite is
    // exactly where a delimiter run turns quadratic, and the cost of asking is nothing.
    const SIZE = 5000
    const baseline = Math.max(render('một câu bình thường. '.repeat(SIZE / 20)), 0.05)
    for (const run of ['*', '_', '`', '[', '(', '~', '=', '+', '@', '$', '\\', '<', '&', '#']) {
      // The worst of the fourteen is `$`, at 4.6 — it is the only one that opens a scan for a
      // closing delimiter. Forty leaves nine times that as headroom and still catches the
      // hundredfold a quadratic costs: `\\` was 35 before `matchMathAtPos`.
      expect({ run, over: render(run.repeat(SIZE)) / baseline < 40 }).toEqual({ run, over: true })
    }
  })
})
