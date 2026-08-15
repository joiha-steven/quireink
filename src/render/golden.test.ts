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
    // The three below are asserted in the block underneath, against what 2.x prints.
    if (name in DIVERGED) continue
    test(name, async () => {
      const markdown = readFileSync(join(CORPUS, file), 'utf8')
      const expected = readFileSync(join(REFERENCE, `${name}.html`), 'utf8')
      expect(await renderPostContent({ markdown })).toBe(expected)
    })
  }
})

/**
 * THE THREE FIXTURES THAT NO LONGER MATCH 1.x, AND WHY THAT IS NOT A REGRESSION.
 *
 * Everything above this point is a parity gate: 2.0's body is byte-identical to the frozen
 * implementation's. On 2026-08-15 three fixtures stopped being, deliberately, and the honest
 * way to record that is here rather than by overwriting `golden/v1/` — those files are what
 * 1.x ACTUALLY PRINTED, captured by running it, and a renderer that no longer exists cannot
 * be re-run to get them back. Overwriting them would not update the reference; it would
 * destroy it, and the gate would go on reporting parity against our own output.
 *
 * So 1.x's answer stays on disk untouched, the new answer lives beside it in `golden/v2/`,
 * and the three are named here with the reason each one moved. Forty-two fixtures still hold
 * the original contract, which is the number that matters: this is a divergence in ONE
 * behaviour, not a licence to drift.
 *
 * All three are the same behaviour — a fence whose language could not be used — and the
 * report behind it was an owner asking why the code blocks on his own posts had no colour.
 */
const DIVERGED: Record<string, string> = {
  // ```typescript names a grammar that IS loaded, under the spelling nobody writes as `ts`.
  // 1.x missed the lookup and printed plain text. It highlights now.
  'fence-alias': 'the alias map resolves typescript -> ts',
  // A fence with no language, and one with a language nothing has a grammar for, both used to
  // go through Shiki as `text`: a block with no tokens, wearing Shiki's #ffffff background.
  // They are now guessed at (`detect-lang.ts`) and, when that declines, marked for the two
  // things true in any notation (`plain-code.ts`).
  'fence-no-lang': 'guessed, then marked as plain',
  'fence-unknown-lang': 'guessed, then marked as plain',
}

describe('golden: the deliberate divergences from 1.x', () => {
  test('the list is small, and every name in it is a real fixture', () => {
    // Both halves matter. A list that grows is drift; a name that no longer exists is a rule
    // guarding nothing, which is how `check:css-literal` went quietly dead twice.
    expect(Object.keys(DIVERGED).length).toBeLessThan(5)
    for (const name of Object.keys(DIVERGED)) expect(fixtures).toContain(`${name}.md`)
  })

  for (const [name, why] of Object.entries(DIVERGED)) {
    test(`${name} — ${why}`, async () => {
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
