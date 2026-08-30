// THE EDITOR MEETS THE CORPUS, and the cross product it never had.
//
// Two blank-page bugs shipped on the same day, both in the editor's markdown-it rules:
//
//   **đậm** và ==mực==                      the nested parse shared the outer token array
//   [**@@Quire Ink@@**](https://…)          a silent claim that did not move the cursor
//
// Neither could have been found by the suites that existed, for structural reasons:
//
//   1. `golden/corpus/` holds 45 fixtures and only ONE of this repo's two parsers was ever run
//      against them. `marked` renders the reader's page and is gated by the golden compare;
//      markdown-it parses the WRITER'S page and saw none of it.
//   2. Every pen fixture tested one gesture in one sentence. The bugs live in COMBINATIONS —
//      a gesture after emphasis, a gesture inside a link label — which a suite of
//      single-gesture fixtures cannot reach however many it has.
//
// So this runs the corpus through the EDITOR, and generates the cross product of every gesture
// against every container the pen can find itself inside.
//
// THE LAW IS A FIXED POINT, not an exact string. Opening and saving may legitimately normalise,
// and pinning exact output makes this a transcript to rewrite whenever anything improves. What
// may never happen is a document that keeps changing every time it is opened — silent
// corruption on a timer — or a parse that throws, which is a white screen. Both are caught by:
// serialize twice, compare.
//
// ⚠️ AND A FIXED POINT IS NOT ENOUGH, which is the correction of 2026-08-30. That law sees a
// document that keeps CHANGING. It is blind to one that changes ONCE and then holds — which is
// what a serializer that deletes something actually does. Every footnote reference in this
// corpus was being rewritten `[^1]` → `\[^1\]` on the first save, and `\[^1\]` is a perfectly
// stable fixed point, so all six footnote fixtures passed this file while the feature was gone
// from the published page. Callouts, table column alignment and the blank line after a picture
// went the same way: 19 of these 45 fixtures published differently after ONE pass through the
// editor, and nothing here could say so.
//
// So there is a second law, and it is the one that matches the promise: RENDER BOTH AND
// COMPARE. What a save may not do is change the reader's page. That is a stricter test than
// comparing Markdown — a setext heading rewritten as `#` is the same page and passes — and it
// is the only one that could have caught any of the four.
//
// happy-dom is registered for THIS FILE ONLY, the rule every editor suite here follows.

import { describe, expect, it, beforeAll, afterAll } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

/** Open a document in the REAL extension set and save it again. Throws if the parse does. */
async function roundTrip(source: string): Promise<string> {
  const { Editor } = await import('@tiptap/core')
  const { editorExtensions } = await import('@/admin/components/editorExtensions')
  const editor = new Editor({ extensions: editorExtensions(''), content: source })
  const out = (editor.storage as unknown as { markdown: { getMarkdown: () => string } }).markdown.getMarkdown()
  editor.destroy()
  return out
}

const CORPUS = 'golden/corpus'
const FIXTURES = readdirSync(CORPUS).filter((f) => f.endsWith('.md')).sort()

describe('the corpus, opened in the editor', () => {
  it('has fixtures to run', () => {
    // A guard on the guard: a moved corpus directory would otherwise turn this whole file
    // into zero silent tests.
    expect(FIXTURES.length).toBeGreaterThan(20)
  })

  for (const file of FIXTURES) {
    it(`opens and settles: ${file}`, async () => {
      const source = readFileSync(join(CORPUS, file), 'utf8')
      const once = await roundTrip(source)
      const twice = await roundTrip(once)
      expect(twice).toBe(once)
    })
  }
})

/**
 * The fixtures whose PAGE is allowed to move, and what moves in each.
 *
 * Every one is a normalisation Markdown itself permits, checked by hand on 2026-08-30 — none
 * loses a feature, a word or a link. The list is short on purpose: an entry here is a promise
 * that somebody looked, so adding one is a decision, and adding one to make a red check go
 * away is the failure this file exists to prevent.
 *
 * ⚠️ THE SHAPE CHANGED ON 2026-08-30, and the reason is that the first cut of this hatch was
 * far weaker than the one it was modelled on. An excused fixture was asserted only to render
 * SOMETHING (`after.length > 0`), so any of these eight could have collapsed to a single
 * character and this file would still have said ok — in the exact place where four data-loss
 * bugs had just been found. `render/golden.test.ts` had solved the same problem years of
 * fixtures earlier and its answer is copied here wholesale: group by BEHAVIOUR, bound both
 * counts, and pin the new answer on disk so an excused fixture is still compared byte for
 * byte — against what it renders after a save rather than against what it rendered before.
 */
const MAY_DIFFER: Record<string, { behaviour: string; why: string }> = {
  // ── Two lines becoming one. Both are places where Markdown's own line rules already said
  //    the second line belongs to the first; what goes is the <br> between them.
  'callout-unknown.md': { behaviour: 'line joining', why: '[!MYSTERY] is not one of the five, so it is a blockquote either way, and its two lines join' },
  'lazy-continuation.md': { behaviour: 'line joining', why: 'a lazy second line is folded onto the first, which is what it already meant' },

  // ── Text that is not markup, spelled differently. In every one of these the CHARACTERS a
  //    reader sees are identical; only the entity spelling behind them moves. Two of the four
  //    are the escaping promise doing its job, and the pinned files prove it still is.
  'dangerous-hrefs.md': { behaviour: 'text that is not markup', why: 'javascript:/data:/vbscript: never became links; inert text before and after, escaped differently' },
  'dangerous-href-obfuscated.md': { behaviour: 'text that is not markup', why: 'the tab inside the scheme becomes a space in inert text' },
  'entities.md': { behaviour: 'text that is not markup', why: 'markdown-it decodes &copy; and friends on the way in; the characters they name are what comes back' },
  'raw-html-block.md': { behaviour: 'text that is not markup', why: 'html:false — raw HTML is text here, and text is written back as entities. The promise, working' },

  // ── One link notation for another, and one list becoming loose.
  'reference-links.md': { behaviour: 'link form', why: '[a][ref] is written back inline as [a](url); the link and its label survive, the definition list goes' },
  'task-lists.md': { behaviour: 'list looseness', why: 'items gain the blank line between them that makes a list loose, so each gets a <p>' },
}

/**
 * What each excused fixture publishes AFTER one save, captured rather than described.
 *
 * ⚠️ These are a CONTRACT, in the same sense `golden/v1/corpus/` is one, and with one weakness
 * that directory does not have: 1.x's renderer is gone, so its files cannot be regenerated,
 * while these can — by running the very code they are meant to check. Re-capturing one to make
 * a red check green turns this gate into a mirror. When one of these legitimately moves, look
 * at the diff and say in `MAY_DIFFER` what moved and why; the whole value of the list is that
 * every entry is a promise somebody looked.
 */
const AFTER = join('golden', 'editor')

describe('the corpus, saved once, still publishes the same page', () => {
  for (const file of FIXTURES) {
    const excused = MAY_DIFFER[file]
    it(`${file}${excused ? ` — ${excused.behaviour}` : ''}`, async () => {
      const { renderPostContent } = await import('@/render/post-content')
      const source = readFileSync(join(CORPUS, file), 'utf8')
      const before = await renderPostContent({ markdown: source })
      const after = await renderPostContent({ markdown: await roundTrip(source) })
      // An excused fixture is compared just as strictly; only the answer it is compared
      // against is different. "It still renders" is not a contract.
      expect(after).toBe(excused
        ? readFileSync(join(AFTER, file.replace(/\.md$/, '.html')), 'utf8')
        : before)
    })
  }
})

describe('the excuses stay few, and stay excuses', () => {
  it('counts behaviours rather than names, and keeps a bound on both', () => {
    // Counting NAMES alone makes one legitimate change look like drift — a single behaviour
    // moves several fixtures at once. Counting behaviours alone lets one behaviour eat the
    // corpus. Both, or neither means anything.
    const behaviours = new Set(Object.values(MAY_DIFFER).map((d) => d.behaviour))
    expect(behaviours.size).toBeLessThan(6)
    expect(Object.keys(MAY_DIFFER).length).toBeLessThan(FIXTURES.length / 4)
  })

  it('names only fixtures that exist, so no rule here is guarding nothing', () => {
    for (const file of Object.keys(MAY_DIFFER)) expect(FIXTURES).toContain(file)
  })

  it('excuses only fixtures that really do move, so the list cannot grow by habit', async () => {
    const { renderPostContent } = await import('@/render/post-content')
    for (const file of Object.keys(MAY_DIFFER)) {
      const source = readFileSync(join(CORPUS, file), 'utf8')
      const before = await renderPostContent({ markdown: source })
      const after = readFileSync(join(AFTER, file.replace(/\.md$/, '.html')), 'utf8')
      expect(`${file}: ${after === before ? 'does not move, and does not belong here' : 'moves'}`)
        .toBe(`${file}: moves`)
    }
  })
})

// The gestures this editor adds to Markdown, each in the form a writer types.
const GESTURES = [
  ['ink', '==tô đậm=='],
  ['ink with a colour', '==tô đậm==#orange'],
  ['underline', '++gạch chân++'],
  ['ring', '@@khoanh tròn@@'],
  ['maths, dollars', '$x^2$'],
  ['maths, parens', '\\(a_1\\)'],
] as const

/**
 * Everywhere one can end up. `%s` is where the gesture goes.
 *
 * The two that mattered today are `after bold` and `in a link label`, and they are two lines
 * in a list of sixteen — which is the argument for generating the list rather than thinking of
 * cases one at a time. Nobody sits down and thinks "a highlight inside a link label"; the
 * cross product does it without being clever.
 */
const CONTEXTS = [
  ['a plain paragraph', 'Câu này có %s ở giữa.'],
  ['after bold', 'Chi phí **thấp** và %s nhiều.'],
  ['before bold', 'Có %s rồi mới **đậm** sau.'],
  ['between two bolds', '**một** rồi %s rồi **hai**.'],
  ['after italic', 'Chữ *nghiêng* rồi %s.'],
  ['after strikethrough', 'Bỏ ~~cái này~~ còn %s.'],
  ['in a link label', 'Xem [%s](https://a.test) nhé.'],
  ['in bold', 'Đây là **%s** trong đậm.'],
  ['in a heading', '## Tiêu đề có %s\n\nMột đoạn.'],
  ['in a list item', '- một\n- có %s ở đây\n'],
  ['in a task item', '- [x] xong %s\n- [ ] chưa\n'],
  ['in a table cell', '| a | b |\n| --- | --- |\n| %s | hai |\n'],
  ['in a blockquote', '> Ghi chú có %s trong đó.\n'],
  ['twice in one line', 'Có %s và lại %s nữa.'],
  ['beside a code span', 'Gõ `ls -la` rồi %s.'],
  ['in a footnote', 'Câu này[^1] có chú thích.\n\n[^1]: chú thích có %s.\n'],
] as const

describe('every gesture, in every container', () => {
  for (const [gestureName, gesture] of GESTURES) {
    for (const [contextName, template] of CONTEXTS) {
      it(`${gestureName} — ${contextName}`, async () => {
        const source = template.replaceAll('%s', gesture)
        // A throw here is a WHITE ADMIN, not a failed assertion: this is the exact call the
        // editor makes when it opens a post, and both of today's bugs threw right here.
        const once = await roundTrip(source)
        const twice = await roundTrip(once)
        expect(twice).toBe(once)
      })
    }
  }
})

describe('a gesture is not silently eaten', () => {
  // Separate from the fixed-point law above, because "stable" and "still there" are different
  // promises and only one of them can be made everywhere. A stroke that crosses an inline code
  // span is DOCUMENTED to end early (`InkMark.ts`, pinned in `ink-mark.test.ts`), so the code
  // span context is not asserted here — the rest must come back with their delimiters intact.
  const KEEPS = CONTEXTS.filter(([name]) => name !== 'beside a code span')

  for (const [gestureName, gesture] of GESTURES) {
    // What has to survive: the opening delimiter. `#orange` rides on the close and the maths
    // forms carry their own, so the first two characters are the honest common denominator.
    const opener = gesture.slice(0, 2)
    for (const [contextName, template] of KEEPS) {
      it(`${gestureName} survives ${contextName}`, async () => {
        const out = await roundTrip(template.replaceAll('%s', gesture))
        expect(out).toContain(opener)
      })
    }
  }
})
