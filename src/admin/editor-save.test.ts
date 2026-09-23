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

describe('a loose list stays loose', () => {
  // FOUND ON PRODUCTION CONTENT, not in the corpus: 142 published posts opened and saved on
  // 2026-09-23, and two published differently after. Both were loose lists of one-paragraph
  // items — the shape a WordPress import writes — which the corpus happened not to hold. A
  // blank line anywhere between two items makes every item a paragraph; the save dropped the
  // blank lines and with them the space a reader sees between the items.
  const shapes = [
    ['blank lines between every item', '- **Bình chọn:** một.\n\n- **Kết quả:** hai.\n'],
    ['one blank line, the whole list loose', '- một\n- hai\n\n- ba\n    - con\n'],
    ['ordered, starting past one', '3. ba\n\n4. bốn\n'],
    ['a checklist', '- [x] xong\n\n- [ ] chưa\n'],
  ] as const
  for (const [what, source] of shapes) {
    it(what, async () => {
      const saved = await save(source)
      expect(toHtml(saved, PAGE)).toBe(toHtml(source, PAGE))
      expect(await save(saved)).toBe(saved)
    })
  }

  it('and a tight one stays tight, so the attribute is not a new way to be wrong', async () => {
    const source = '- một\n- hai\n    - con\n- ba\n'
    const saved = await save(source)
    expect(saved).not.toContain('\n\n')
    expect(toHtml(saved, PAGE)).toBe(toHtml(source, PAGE))
  })
})

describe('a paragraph keeps its second line', () => {
  // FOUND 2026-09-23 through this editor, after the fix of 2026-09-21 was marked done: that fix
  // guarded a newline INSIDE a text node, which the parser never produces. The line after a soft
  // break is its own node, and nothing escaped it — so `\---` saved as `---`, the next open read
  // it as a setext underline, and the second line was gone with the first turned into a heading.
  const shapes = [
    ['a rule', 'first line\n\\---\n'],
    ['a heading mark', 'first line\n\\# not a heading\n'],
    ['a list marker', 'first line\n\\- not an item\n'],
    ['a numbered marker', 'first line\n2\\. not an item\n'],
    ['a quote mark', 'first line\n\\> not a quote\n'],
    ['an underline of equals', 'first line\n\\===\n'],
    ['inside emphasis', '*first line\n\\# still emphasis*\n'],
  ] as const
  for (const [what, source] of shapes) {
    it(what, async () => {
      const once = await save(source)
      const twice = await save(once)
      expect(toHtml(once, PAGE)).toBe(toHtml(source, PAGE))
      expect(twice).toBe(once)
    })
  }

  it('a two-line setext heading stays ONE heading, with its id', async () => {
    const source = 'Head one\nhead two\n===\n\nbody\n'
    const saved = await save(source)
    expect(saved.startsWith('# Head one head two\n')).toBe(true)
    const headings = (html: string) => (html.match(/<h[1-6][ >]/g) ?? []).length
    expect(headings(toHtml(saved, PAGE))).toBe(1)
    expect(headings(toHtml(source, PAGE))).toBe(1)
    expect(toHtml(saved, PAGE)).toContain('<p>body</p>')
  })

  it('an empty fence stays empty', async () => {
    expect(await save('```\n```\n')).toBe('```\n```\n')
  })
})
