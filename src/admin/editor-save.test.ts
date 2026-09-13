// A POST OPENED IN THE EDITOR AND SAVED AGAIN — the new writer against the old one.
//
// The editor still OPENS a post with `tiptap-markdown`; what this exercises is the way back:
// `from-editor.ts` turning the ProseMirror document into the tree, and `to-markdown.ts`
// turning the tree into the file. That is the direction that overwrites the author's words,
// and its failures do not look like bugs — they look like a sentence that is no longer there.
//
// WHAT IS COMPARED, and why it is not the source. Opening a post changes it: the editor has
// no node for a soft line break inside a paragraph, none for raw HTML (`html: false`, so a
// `<b>` arrives as text), and it resolves a reference link where it stands. Comparing a save
// against the SOURCE fails on all of that and says nothing about the thing being replaced.
//
// So the comparison is between the two WRITERS, on the same document: `prosemirror-markdown`
// through `tiptap-markdown`, and this engine. Same input, same editor, two files — and the
// question is whether the new one produces a different page. Where it does, the difference is
// named below with which of the two is right, because "different" is not the same as "worse"
// and on this corpus it is mostly the opposite.
//
// It lives in `src/admin/` rather than beside the engine because it mounts the real editor,
// and the admin's tsconfig is the one that knows about a DOM. happy-dom is registered for THIS
// FILE ONLY, the rule every editor suite here follows.

import { describe, expect, it, beforeAll, afterAll } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { toHtml } from '@/md/index'
import { toMarkdown } from '@/md/to-markdown'
import { fromEditor, type PMNode } from '@/md/from-editor'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

type MarkdownStorage = { markdown: { getMarkdown: () => string } }

/** Open a document in the REAL extension set; hand back what each writer would save. */
async function bothWriters(source: string): Promise<{ old: string; fresh: string }> {
  const { Editor } = await import('@tiptap/core')
  const { editorExtensions } = await import('@/admin/components/editorExtensions')
  const editor = new Editor({ extensions: editorExtensions(''), content: source })
  const old = (editor.storage as unknown as MarkdownStorage).markdown.getMarkdown()
  const fresh = toMarkdown(fromEditor(editor.state.doc as unknown as PMNode))
  editor.destroy()
  return { old, fresh }
}

const CORPUS = 'golden/corpus'
const FIXTURES = readdirSync(CORPUS).filter((f) => f.endsWith('.md')).sort()

/**
 * Where the two writers produce different pages, and which one is right.
 *
 * Every entry here was read side by side against the SOURCE, which is the tiebreak: the writer
 * whose page matches what the author wrote is the correct one. On this corpus that is the new
 * writer in all four, and two of them are the same bug in the old one.
 */
const DIFFERS: Record<string, string> = {
  // `\[ … \]` is display maths on this blog (ADR 0020), so escaping BOTH brackets turns any
  // bracketed text into a formula. The old writer does exactly that: `[js](javascript:…)`
  // comes back as `<math>js</math>(javascript:…)`, and `[two][missing]` as `<math>two</math>`.
  // The new writer escapes only the opening bracket, which reads back as the same text and
  // cannot be a formula. Same bug, two fixtures.
  'dangerous-hrefs': 'the old writer turns `\\[js\\]` into a formula; the new one keeps the text',
  'dangerous-href-obfuscated': 'the old writer turns `\\[tab\\]` into a formula; the new one keeps the text',
  'reference-links': 'the old writer turns `\\[two\\]\\[missing\\]` into a formula; the new one keeps the text',
  // The source is a TIGHT list — no blank lines. The old writer saves it loose, so every item
  // grows a `<p>` and the list the author wrote is not the list that publishes.
  'task-lists': 'the old writer makes a tight list loose; the new one keeps it tight',
}

describe('the two writers, on the same editor document', () => {
  it('has fixtures to run', () => {
    expect(FIXTURES.length).toBeGreaterThan(40)
    for (const name of Object.keys(DIFFERS)) expect(FIXTURES).toContain(`${name}.md`)
    // Bounded: a list of excuses that can grow without limit is not a gate.
    expect(Object.keys(DIFFERS).length).toBeLessThan(FIXTURES.length / 8)
  })

  for (const file of FIXTURES) {
    const name = file.replace(/\.md$/, '')
    if (name in DIFFERS) continue
    it(`agree: ${name}`, async () => {
      const { old, fresh } = await bothWriters(readFileSync(join(CORPUS, file), 'utf8'))
      expect(toHtml(fresh)).toBe(toHtml(old))
    })
  }

  for (const [name, why] of Object.entries(DIFFERS)) {
    it(`${name} — ${why}`, async () => {
      const source = readFileSync(join(CORPUS, `${name}.md`), 'utf8')
      const { old, fresh } = await bothWriters(source)
      // They differ…
      expect(toHtml(fresh)).not.toBe(toHtml(old))
      // …and the new one is the one that did not invent a formula. Asserted rather than
      // asserted-in-prose: a claim in a comment is not a gate.
      expect(toHtml(fresh)).not.toContain('<math')
    })
  }
})

describe('what a save must never do', () => {
  it('keeps the pen on the words it was drawn over', async () => {
    const { fresh } = await bothWriters('A ==highlighted==#green word and a @@ringed@@ one.\n')
    expect(fresh).toContain('==highlighted==#green')
    expect(fresh).toContain('@@ringed@@')
  })

  it('keeps a formula a formula', async () => {
    const { fresh } = await bothWriters('The identity $M \\times V = P \\times Q$ holds.\n')
    expect(fresh).toContain('$M \\times V = P \\times Q$')
  })

  it('keeps a table aligned', async () => {
    // The alignment lives on the header cells, and dropping it is a bug this repository has
    // had once already — every centred column went left on the first save and stayed there.
    const { fresh } = await bothWriters('| a | b |\n| :---: | ---: |\n| 1 | 2 |\n')
    expect(fresh).toContain(':---:')
    expect(fresh).toContain('---:')
  })

  it('keeps a footnote reference and a callout marker', async () => {
    const { fresh } = await bothWriters('A note[^1].\n\n> [!NOTE]\n> Body.\n')
    expect(fresh).toContain('[^1]')
    expect(fresh).toContain('[!NOTE]')
    expect(fresh).not.toContain('\\[')
  })
})
