// THE FOUR SHAPES A SAVE USED TO DESTROY, held against the engine that replaced the writer.
//
// This file was a COMPARISON while there were two writers: `prosemirror-markdown` through
// `tiptap-markdown`, and this engine, run over the same editor document so the difference could
// be read rather than argued about. That comparison is over — the old bridge came out on
// 2026-09-13 (ADR 0052) — and what it found is the reason the file stays.
//
// It found four shapes the old writer published wrong, across five fixtures. Four of the five
// were ONE bug: the serializer escaped both brackets, and `\[ … \]` is display maths on this
// blog (ADR 0020), so `[js](javascript:…)` published as a formula reading "js" followed by a
// naked URL, and `[two][missing]` as an empty formula in the middle of a sentence. The fifth
// was a tight checklist saved loose — a blank line per item, added to a file that had none.
//
// None of them threw. None of them looked like a bug. Every one was a post that read
// differently after somebody opened it and pressed nothing, which is the failure this whole
// engine was written against — so the shapes are pinned here as assertions on the NEW writer,
// where they stay checked long after anybody remembers what `tiptap-markdown` was.
//
// The corpus-wide round trip lives in `editor-corpus.test.ts`, which renders the page before and
// after a save across all 45 fixtures. It reports 44 of 45 identical; the one that moves is raw
// HTML, and it moves in the source rather than on the page.
//
// happy-dom is registered for THIS FILE ONLY, the rule every editor suite here follows.

import { describe, expect, it, beforeAll, afterAll } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { toHtml } from '@/md/index'
import { PAGE } from '@/render/page-rules'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())


/** Open a document in the REAL extension set and hand back what a save would write. */
async function save(source: string): Promise<string> {
  const { Editor } = await import('@/admin/editor/editor')
  const editor = new Editor({ element: document.createElement('div'), content: source })
  const out = editor.getMarkdown()
  editor.destroy()
  return out
}

const CORPUS = 'golden/corpus'
const read = (name: string) => readFileSync(join(CORPUS, `${name}.md`), 'utf8')

describe('a bracketed link does not become a formula', () => {
  // THE BUG, in one line: `\[js\]` is an escaped bracket to Markdown and DISPLAY MATHS to this
  // blog. A serializer that escapes the closing bracket as well as the opening one has written
  // a formula. `md/to-markdown.ts` escapes the opening bracket only — `\[js]` reads back as the
  // text `[js]`, cannot open a link, and is not a formula because a formula needs `\]`.
  for (const name of ['dangerous-hrefs', 'dangerous-href-obfuscated', 'reference-links']) {
    it(`${name}: no formula where the author wrote brackets`, async () => {
      const source = read(name)
      const saved = await save(source)
      expect(saved).not.toContain('\\]')
      expect(toHtml(saved)).not.toContain('<math')
      // The page is the same page, which is the claim that matters. All three round-trip
      // exactly now; `editor-corpus.test.ts` holds that over the whole corpus.
      expect(toHtml(saved)).toBe(toHtml(source))
    })
  }

  it('leaves the dangerous schemes disarmed and the safe link working', async () => {
    const html = toHtml(await save(read('dangerous-hrefs')), PAGE)
    expect(html).toContain('href="#"')
    expect(html).toContain('https://example.com')
    expect(html).not.toContain('href="javascript:')
  })
})

describe('a tight list stays tight', () => {
  it('the list the author wrote is the list that publishes', async () => {
    const source = read('task-lists')
    const saved = await save(source)
    // A loose list puts a `<p>` inside every item, and the source has no blank lines in it.
    expect(saved).not.toMatch(/\n\n-/)
    expect(toHtml(saved)).toBe(toHtml(source))
  })
})

describe('what a save must never do', () => {
  it('keeps the pen on the words it was drawn over', async () => {
    const saved = await save('A ==highlighted==#green word and a @@ringed@@ one.\n')
    expect(saved).toContain('==highlighted==#green')
    expect(saved).toContain('@@ringed@@')
  })

  it('keeps a formula a formula, in the delimiters the author chose', async () => {
    expect(await save('The identity $M \\times V = P \\times Q$ holds.\n'))
      .toContain('$M \\times V = P \\times Q$')
    // Four spellings mean maths here, and a save may not pick its favourite.
    expect(await save('Trước \\(a_1\\) sau.\n')).toContain('\\(a_1\\)')
  })

  it('keeps a table aligned', async () => {
    // The alignment lives on the header cells, and dropping it is a bug this repository has
    // had once already — every centred column went left on the first save and stayed there.
    const saved = await save('| a | b |\n| :---: | ---: |\n| 1 | 2 |\n')
    expect(saved).toContain(':---:')
    expect(saved).toContain('---:')
  })

  it('keeps a footnote reference and a callout marker', async () => {
    const saved = await save('A note[^1].\n\n> [!NOTE]\n> Body.\n')
    expect(saved).toContain('[^1]')
    expect(saved).toContain('[!NOTE]')
    expect(saved).not.toContain('\\[')
  })

  it('keeps a link whose whole label is a formula', async () => {
    // An inline NODE carries marks too, and the first cut of `md/to-editor.ts` dropped them:
    // the URL was gone from the document before the writer had touched anything.
    expect(await save('giá [$x^2$](https://a.test) đây\n')).toContain('](https://a.test)')
  })

  it('does not put a backslash where the author typed none', async () => {
    // Over-escaping is corruption too — of the file the author opens next. `pen/grammar.ts`
    // can read neither of these as a stroke, so neither needs a backslash.
    expect(await save('x == y and z == w\n')).toBe('x == y and z == w\n')
    expect(await save('C++ và ++i, x @@ y\n')).toBe('C++ và ++i, x @@ y\n')
  })
})
