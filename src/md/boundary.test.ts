// THE ENGINE REACHES OUT OF ITSELF IN EXACTLY ONE PLACE, AND THIS IS THE PLACE THAT SAYS SO.
//
// ADR 0052 built this engine to replace four libraries; the point of it being ours is that it
// can also be somebody else's. That is a property, not an intention, and a property that
// erodes one convenient import at a time — so it is a red test rather than a line in a README,
// the same bargain `pen/boundary.test.ts` makes for the pen.
//
// WHAT IT COST TO GET HERE (2026-09-14). The engine reached four ways out of `src/md`:
//
//   @/render/math          renderMath, and through it Temml — 212 KB unpacked, a LaTeX engine
//                          compiled into anything that could render a page. Now a function the
//                          host passes as `PageRules.math`, with the author's own TeX as the
//                          answer when nobody passes one.
//   @/utils                slugify, for heading anchors. It knows Vietnamese diacritics and
//                          Cyrillic because this blog's headings are written in both, which is
//                          exactly why it is a host's answer: `render/page-rules.ts` holds it
//                          now, with the rest of what this blog asks for.
//   @/render/math-syntax   the four maths delimiters. Notation the parser reads and nothing
//                          that can render it, so it MOVED IN — `md/math-syntax.ts` — and
//                          `render/math.ts` re-exports it for the two callers outside.
//   @/pen/grammar          the three pen fences and the hash that deals a stroke its variant.
//                          Still outside, deliberately, and the one line below.
//
// WHY THE PEN'S GRAMMAR STAYS OUT. It is not the engine's to take. Four parsers read those
// three regexes — this engine, the editor's two marks, and the reader's own pen — and
// `src/pen/` is liftable for the same reason `src/md/` is (`pen/boundary.test.ts`): the
// WordPress theme and the embeddable sheet take the hand without the blog around it. Moving
// the grammar in here would put the pen's door inside the engine and break that.
//
// SO EXTRACTION DAY IS ONE DECISION, not four. Either the engine ships the pen's three fences
// as configuration — a host registers an inline gesture and the node it becomes — or the two
// repositories are published together and this import points at a package. Everything else in
// `src/md` already only knows `src/md`.
import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const DIR = join(import.meta.dir)

/** Inside the engine, the runtime, and the test runner. Nothing else is portable. */
const LOCAL = [/^\.\.?\//, /^@\/md\//, /^bun:test$/, /^node:/]

/**
 * The one exception, written as a list so it can only shrink by somebody editing this line.
 *
 * A second entry here is not a bug to fix in this file. It is a decision about what the
 * engine is, and it belongs in an ADR before it belongs in this array.
 */
const REACHES_OUT = ['@/pen/grammar']

function importsOf(file: string): string[] {
  const src = readFileSync(join(DIR, file), 'utf8')
  return [...src.matchAll(/^(?:import|export)[^'"\n]*from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]!)
}

describe('the markdown engine module boundary', () => {
  const files = readdirSync(DIR).filter((f) => f.endsWith('.ts'))

  it('holds every file in src/md to src/md, the runtime, and one named exception', () => {
    // The suites get the same rule. A test that reaches into the blog is a test of the blog,
    // and it is also the file that would refuse to compile in the engine's own repository:
    // `html-rules.test.ts` drove this blog's `PAGE` until this test was written.
    const leaks: string[] = []
    for (const f of files) {
      for (const spec of importsOf(f)) {
        if (LOCAL.some((re) => re.test(spec))) continue
        if (REACHES_OUT.includes(spec)) continue
        leaks.push(`${f} → ${spec}`)
      }
    }
    expect(leaks).toEqual([])
  })

  it('keeps the exception to one module, and that module dependency-free', () => {
    expect(REACHES_OUT).toEqual(['@/pen/grammar'])
    // The reach is only cheap while the thing reached for is a leaf. `pen/grammar.ts` takes
    // two numbers from `pen/dies-kit.ts` and nothing else; the day it imports a renderer, a
    // store or a setting, the engine has quietly taken all of it.
    const grammar = readFileSync(join(DIR, '..', 'pen', 'grammar.ts'), 'utf8')
    const reached = [...grammar.matchAll(/^import[^'"\n]*from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]!)
    expect(reached).toEqual(['@/pen/dies-kit'])
    const kit = readFileSync(join(DIR, '..', 'pen', 'dies-kit.ts'), 'utf8')
    expect([...kit.matchAll(/^import[^'"\n]*from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]!)).toEqual([])
  })

  it('never imports the one dependency that would make it unliftable', () => {
    // Temml is the measurement that started this: an ESM import is not a menu, so one call to
    // `renderMath` took a whole LaTeX engine with it. `PageRules.math` is the slot it left.
    for (const f of files) {
      for (const spec of importsOf(f)) {
        expect({ f, spec }).not.toEqual({ f, spec: 'temml' })
        expect({ f, spec }).not.toEqual({ f, spec: '@/render/math' })
      }
    }
  })
})
