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
import { classify, firstDifference } from '@/render/html-equivalence'

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
    // The names in DIVERGED are asserted in the block underneath, against what 2.x prints;
    // the names in SAME_PAGE are asserted in the block after that, against the ladder.
    if (name in DIVERGED || name in SAME_PAGE) continue
    test(name, async () => {
      const markdown = readFileSync(join(CORPUS, file), 'utf8')
      const expected = readFileSync(join(REFERENCE, `${name}.html`), 'utf8')
      expect(await renderPostContent({ markdown })).toBe(expected)
    })
  }
})

/**
 * THE THIRD TIER, added when this blog stopped renting its Markdown engine (ADR 0052).
 *
 * The two tiers above both end in a byte comparison, and both should: one says a port moved
 * nothing, the other says a deliberate change moved exactly what it said it would. Neither can
 * express what a REPLACED ENGINE promises. `src/md/` is written to CommonMark and `marked` was
 * not, so the two spell a line break `<br />` and `<br>`, and one writes a newline between two
 * block tags where the other does not. Those are real bytes. No reader can see one of them.
 *
 * A gate that reports those the same way it reports a lost sentence is a gate somebody turns
 * off, so the names below are held to a different and narrower claim: they differ from 1.x
 * ONLY through `html-equivalence.ts`'s ladder, and the rung is named here. A difference that
 * survives the ladder fails, and the whole difference is printed.
 *
 * ⚠️ THIS TIER IS FOR WHITESPACE AND SPELLING, never for behaviour. Anything a reader could
 * notice belongs in DIVERGED with a reason, or is a bug. The ladder is what enforces that —
 * it cannot dissolve a changed word, a lost tag or a moved attribute.
 */
const SAME_PAGE: Record<string, string> = {
  'callout-unknown': 'a newline after a line break',
  entities: 'an entity resolved to its character (&copy; vs ©)',
  'hard-breaks': 'a newline after a line break',
  'lazy-continuation': 'a newline after a line break',
  'list-with-code': 'a newline between two tags',
  'nested-lists': 'a newline between text and a block tag',
  'raw-html-block': 'a newline between text and a block tag',
}

describe('golden: our own engine writes the same page in different bytes', () => {
  test('the tier stays small, and every name is a real fixture', () => {
    // Same guard as DIVERGED's, for the same reason: a tier that grows without anyone
    // deciding is a tier that has eaten the gate above it.
    expect(Object.keys(SAME_PAGE).length).toBeLessThan(fixtures.length / 4)
    for (const name of Object.keys(SAME_PAGE)) expect(fixtures).toContain(`${name}.md`)
  })

  for (const [name, rung] of Object.entries(SAME_PAGE)) {
    test(`${name} — ${rung}`, async () => {
      const markdown = readFileSync(join(CORPUS, `${name}.md`), 'utf8')
      const expected = readFileSync(join(REFERENCE, `${name}.html`), 'utf8')
      const actual = await renderPostContent({ markdown })
      const kind = classify(expected, actual)
      // The rung is named, not merely required to exist: a fixture that starts differing for a
      // NEW reason has to be looked at, even when the new reason is also harmless.
      if (kind !== rung) throw new Error(`${name}: expected "${rung}", got "${kind}"\n${firstDifference(expected, actual)}`)
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
  //
  //    The same five moved again on 2026-09-01, for the second reason in the `why` below: a
  //    table is now wrapped in a scrolling block. The scroll had been on `.prose` itself,
  //    which is the only element CSS would let it sit on and the wrong one — an `overflow-x`
  //    that is not `visible` computes `overflow-y` to `auto` too, so an article carrying one
  //    table became a scroll box as tall as the piece and Safari drew a scrollbar down the
  //    reading column. Each v2 answer grew by exactly the 32 bytes of the wrapper and nothing
  //    else, which was asserted at capture time rather than eyeballed.
  'footnote-in-table': { behaviour: 'table scope', why: 'th carries scope="col"; the table is wrapped to scroll' },
  'gfm-table-align': { behaviour: 'table scope', why: 'th carries scope="col" before align; wrapped to scroll' },
  'gfm-table-pipes': { behaviour: 'table scope', why: 'th carries scope="col"; the table is wrapped to scroll' },
  'list-with-table': { behaviour: 'table scope', why: 'th carries scope="col"; the table is wrapped to scroll' },
  'mixed-everything': { behaviour: 'table scope', why: 'th carries scope="col"; the table is wrapped to scroll' },
  // ── A task item says it is one (2026-09-09, with the pen's list marks — ADR 0042).
  //    `class="task"` on the `<li>` round a GFM checkbox, from `markTaskItems` in
  //    `post-content.ts`, so the stylesheet can keep its ink dot off an item that already
  //    has a box. Three lines differ from 1.x by that attribute and nothing else.
  'task-lists': { behaviour: 'task item', why: 'li carries class="task" round a checkbox' },

  // ── A picture leaves the paragraph it was written in (2026-09-14).
  //    `<figure>` is a block and `<p>` may not hold one, so the browser's parser CLOSES the
  //    paragraph before it: what a reader got was an empty `<p>`, the figure, and the rest of
  //    the sentence as a bare text node with no paragraph round it. Measured on the live site:
  //    that run of words now takes `text-align:justify`, `hyphens:auto` and a 25.3px top margin
  //    from `.prose p` and had none of them before, so it sat ragged-right in a justified piece.
  //    43 pictures in 20 of this blog's 92 posts were in that state, and 1.x printed the same
  //    shape, which is why this is a divergence and not a port bug. `buildFigures` now splits
  //    the paragraph, which is what the parser was doing anyway.
  'reference-links': { behaviour: 'picture out of paragraph', why: 'the paragraph is split round the figure, not repaired by the parser' },
}

describe('golden: the deliberate divergences from 1.x', () => {
  test('the divergences stay few, stay a minority, and every name is a real fixture', () => {
    // Three halves matter. A count of BEHAVIOURS that grows is drift — one deliberate change
    // legitimately moves several fixtures at once, and counting fixtures called that drift.
    // A count of names that grows past a quarter of the corpus means one behaviour ate the
    // gate. And a name that no longer exists is a rule guarding nothing, which is how
    // `check:css-literal` went quietly dead twice.
    const behaviours = new Set(Object.values(DIVERGED).map((d) => d.behaviour))
    // Four since 2026-09-14. The ceiling moves only when a behaviour is added deliberately and
    // written up above; raising it to keep a red test quiet is the drift this guard is for.
    expect(behaviours.size).toBeLessThan(5)
    expect(Object.keys(DIVERGED).length).toBeLessThan(fixtures.length / 4)
    for (const name of Object.keys(DIVERGED)) expect(fixtures).toContain(`${name}.md`)
  })

  test('the list golden/recapture-v2.ts works from is this same list', () => {
    // TWO HAND-KEPT COPIES OF ONE LIST DO NOT CHECK EACH OTHER, and a name in only one of them
    // is the worst shape this can take: `recapture-v2.ts` would refresh a reference the gate no
    // longer reads, or the gate would hold a reference nothing can refresh — and in both cases
    // everything stays green. So they are compared, and the comparison is the only reason the
    // second copy is allowed to exist.
    const listed = readFileSync(join(ROOT, 'v2', 'names.txt'), 'utf8')
      .split('\n')
      .map((n) => n.trim())
      .filter((n) => n !== '' && !n.startsWith('#'))
    expect(listed.sort()).toEqual(Object.keys(DIVERGED).sort())
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
