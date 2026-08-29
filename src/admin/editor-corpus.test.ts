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
