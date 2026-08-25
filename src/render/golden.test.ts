// The M2 gate, at the level it can be held today: for every corpus fixture, Quire Ink 2.0's
// article body is BYTE-IDENTICAL to the frozen implementation's.
//
// The reference HTML in `golden/v1/corpus/` was produced by actually running the frozen
// renderer (`golden/capture-corpus.ts`), not written by hand. Hand-written expectations
// would only test that I transcribed my own port correctly, which is the thing least worth
// testing.
//
// `marked` and `shiki` are pinned to EXACT versions in `package.json`, no caret. A byte
// comparison against a floating dependency would fail on a patch release and teach everyone
// to ignore it.
//
// The pins are no longer the frozen tree's own (18.0.5 / 4.2.0): the 2026-08-11 security
// pass moved them to 18.0.9 and 4.4.3 and re-ran this gate, which stayed 46/46. That is what
// the pins are FOR — a bump is a reviewed change that has to prove it moved nothing, not a
// number nobody may touch. Deliberately not restated here as a version number, because the
// last one sat in this comment untrue from the day of the bump.
import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderPostContent } from '@/render/post-content'

const ROOT = join(import.meta.dir, '..', '..', 'golden')
const CORPUS = join(ROOT, 'corpus')
const REFERENCE = join(ROOT, 'v1', 'corpus')

const fixtures = readdirSync(CORPUS).filter((f) => f.endsWith('.md')).sort()

describe('golden: article bodies are byte-identical to Quire 1.x', () => {
  test('the corpus is present and non-trivial', () => {
    // A harness that silently finds zero fixtures passes forever and proves nothing.
    expect(fixtures.length).toBeGreaterThan(40)
  })

  for (const file of fixtures) {
    const name = file.replace(/\.md$/, '')
    // The names in DIVERGED are asserted in the block underneath, against what 2.x prints.
    if (name in DIVERGED) continue
    test(name, async () => {
      const markdown = readFileSync(join(CORPUS, file), 'utf8')
      const expected = readFileSync(join(REFERENCE, `${name}.html`), 'utf8')
      expect(await renderPostContent({ markdown })).toBe(expected)
    })
  }
})

/**
 * THE FIXTURES THAT NO LONGER MATCH 1.x, AND WHY THAT IS NOT A REGRESSION.
 *
 * Everything above this point is a parity gate: 2.0's body is byte-identical to the frozen
 * implementation's. Some fixtures stopped being, deliberately, and the honest way to record
 * that is here rather than by overwriting `golden/v1/` — those files are what 1.x ACTUALLY
 * PRINTED, captured by running it, and a renderer that no longer exists cannot be re-run to
 * get them back. Overwriting them would not update the reference; it would destroy it, and
 * the gate would go on reporting parity against our own output.
 *
 * So 1.x's answer stays on disk untouched, the new answer lives beside it in `golden/v2/`,
 * and each name is listed here with the BEHAVIOUR it belongs to and the reason it moved.
 *
 * `behaviour` is the field that matters, and it is why this shape changed on 2026-08-25.
 * The guard below used to count NAMES and refuse a fourth. But the three names it was sized
 * against were one behaviour wearing three fixtures, and the comment here always said so —
 * "a divergence in ONE behaviour, not a licence to drift". Counting names made a second
 * correct change impossible for an arithmetic reason nobody chose, which is a rule guarding
 * the wrong thing. It counts behaviours now, and keeps a bound on names so that one
 * behaviour cannot quietly eat the corpus.
 */
const DIVERGED: Record<string, { behaviour: string; why: string }> = {
  // ── A fence whose language could not be used. Reported by an owner asking why the code
  //    blocks on his own posts had no colour (2026-08-15).
  // ```typescript names a grammar that IS loaded, under the spelling nobody writes as `ts`.
  // 1.x missed the lookup and printed plain text. It highlights now.
  'fence-alias': { behaviour: 'fence language', why: 'the alias map resolves typescript -> ts' },
  // A fence with no language, and one with a language nothing has a grammar for, both used to
  // go through Shiki as `text`: a block with no tokens, wearing Shiki's #ffffff background.
  // They are now guessed at (`detect-lang.ts`) and, when that declines, marked for the two
  // things true in any notation (`plain-code.ts`).
  'fence-no-lang': { behaviour: 'fence language', why: 'guessed, then marked as plain' },
  'fence-unknown-lang': { behaviour: 'fence language', why: 'guessed, then marked as plain' },

  // ── A column header that says it is one (2026-08-25, Front-End Checklist `table-headers`).
  //    `scope="col"` on every `<th>`, from the `tablecell` override in `post-content.ts`.
  //    ELEVEN lines across these five, and each one differs from 1.x by that attribute and
  //    nothing else — checked line by line at capture time, not eyeballed.
  'footnote-in-table': { behaviour: 'table scope', why: 'th carries scope="col"' },
  'gfm-table-align': { behaviour: 'table scope', why: 'th carries scope="col", before align' },
  'gfm-table-pipes': { behaviour: 'table scope', why: 'th carries scope="col"' },
  'list-with-table': { behaviour: 'table scope', why: 'th carries scope="col"' },
  'mixed-everything': { behaviour: 'table scope', why: 'th carries scope="col"' },
}

describe('golden: the deliberate divergences from 1.x', () => {
  test('the divergences stay few, stay a minority, and every name is a real fixture', () => {
    // Three halves matter. A count of BEHAVIOURS that grows is drift — one deliberate change
    // legitimately moves several fixtures at once, and counting fixtures called that drift.
    // A count of names that grows past a quarter of the corpus means one behaviour ate the
    // gate. And a name that no longer exists is a rule guarding nothing, which is how
    // `check:css-literal` went quietly dead twice.
    const behaviours = new Set(Object.values(DIVERGED).map((d) => d.behaviour))
    expect(behaviours.size).toBeLessThan(4)
    expect(Object.keys(DIVERGED).length).toBeLessThan(fixtures.length / 4)
    for (const name of Object.keys(DIVERGED)) expect(fixtures).toContain(`${name}.md`)
  })

  for (const [name, { behaviour, why }] of Object.entries(DIVERGED)) {
    test(`${name} — ${behaviour}: ${why}`, async () => {
      const markdown = readFileSync(join(CORPUS, `${name}.md`), 'utf8')
      const expected = readFileSync(join(ROOT, 'v2', 'corpus', `${name}.html`), 'utf8')
      expect(await renderPostContent({ markdown })).toBe(expected)
    })
  }

  test('what 1.x printed is still on disk, and still different', async () => {
    // The point of keeping both: if a change ever makes these match again, that is news.
    for (const name of Object.keys(DIVERGED)) {
      const v1 = readFileSync(join(REFERENCE, `${name}.html`), 'utf8')
      const v2 = readFileSync(join(ROOT, 'v2', 'corpus', `${name}.html`), 'utf8')
      expect(v1).not.toBe(v2)
    }
  })
})
