// Pasting a Markdown article into the writing surface.
//
// The bug this guards shipped and was found by the owner, not by a test: paste a post's
// Markdown and every line landed as literal text — `# Heading` stayed two characters and a
// word, the table a wall of pipes. It did not stop there. The serializer escapes what it is
// handed, so SAVING that draft wrote `\# Dùng Synology…` and ```` \`\`\`bash ```` into the
// database, and the post published as its own source. The editor looked broken; what was
// broken was the document.
//
// The seam is `clipboardTextParser`, where prosemirror-view asks whether anyone can turn the
// clipboard's PLAIN TEXT into a slice. `tiptap-markdown` answers only when
// `transformPastedText` is on, and its default is off — one option, and the whole difference
// between pasting an article and pasting a screenshot of one.
//
// ⚠️ NOT `view.pasteText()`, which would be one line: it passes `preferPlain: true`, the flag
// meaning "the writer held Shift". The parser is contractually required to decline that, so
// the convenient helper tests the one path where the fix must NOT apply and reports green with
// the option switched back off. This goes through the prop itself.
//
// happy-dom is registered for THIS FILE ONLY: registering globally hands the rest of the run
// happy-dom's `fetch`.

import { describe, expect, it, beforeAll, afterAll } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import type { Editor as TiptapEditor } from '@tiptap/core'
import type { Slice, ResolvedPos } from '@tiptap/pm/model'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

/** A fresh editor on the REAL extension set — the list `Editor.tsx` mounts, not a copy. */
async function open(content = '') {
  const { Editor } = await import('@tiptap/core')
  const { editorExtensions } = await import('@/admin/components/editorExtensions')
  return new Editor({ extensions: editorExtensions(''), content })
}

type ClipboardTextParser = (text: string, context: ResolvedPos, plainText: boolean) => Slice | null

/**
 * What a Cmd+V of plain text does: ask the registered parser for a slice, then replace the
 * selection with it. Both halves matter — a parser that returns the right slice into a
 * document nothing dispatches it into proves nothing.
 *
 * `plainText` is the Shift-held flag, and it is a parameter here so the test below can hold
 * Shift too.
 */
function paste(editor: TiptapEditor, text: string, plainText = false): void {
  const { $from } = editor.state.selection
  const slice = editor.view.someProp('clipboardTextParser', (fn) =>
    (fn as ClipboardTextParser)(text, $from, plainText))
  if (!slice) throw new Error('nothing answered clipboardTextParser — transformPastedText is off')
  editor.view.dispatch(editor.state.tr.replaceSelection(slice))
}

function markdownOf(editor: TiptapEditor): string {
  return (editor.storage as unknown as { markdown: { getMarkdown: () => string } }).markdown.getMarkdown()
}

const ARTICLE = [
  '# Dùng Synology để host một cái blog',
  '',
  'Con NAS ở nhà đã chạy 24/7 rồi.',
  '',
  '## Vì sao',
  '',
  '| Thứ | WordPress |',
  '|---|---|',
  '| RAM | 512 MB |',
  '',
  '```bash',
  'docker run -d quireink',
  '```',
  '',
  '> Lưu ý: DSM chiếm cổng 5000.',
  '',
  '- [x] Mở cổng 443',
  '- [ ] Trỏ tên miền',
  '',
].join('\n')

describe('pasting Markdown into the editor', () => {
  it('builds the nodes the source describes, not a paragraph of its characters', async () => {
    const editor = await open('')
    paste(editor, ARTICLE)
    const html = editor.getHTML()
    editor.destroy()

    // Each of these is a line that used to arrive as prose.
    expect(html).toContain('<h1>Dùng Synology để host một cái blog</h1>')
    expect(html).toContain('<h2>Vì sao</h2>')
    expect(html).toContain('<table')
    expect(html).toContain('<code class="language-bash">')
    expect(html).toContain('<blockquote>')
    expect(html).toContain('data-type="taskList"')
    // The give-away of the old behaviour: the delimiters left standing as text.
    expect(html).not.toContain('# Dùng Synology')
    expect(html).not.toContain('```bash')
  })

  it('saves the article, not an escaped transcript of it', async () => {
    // The half that reached the database. `\#` and `&gt;` are what the serializer writes when
    // the delimiters were only ever text, and they are what published.
    const editor = await open('')
    paste(editor, ARTICLE)
    const saved = markdownOf(editor)
    editor.destroy()

    expect(saved).toContain('# Dùng Synology để host một cái blog')
    expect(saved).toContain('```bash')
    expect(saved).toContain('> Lưu ý: DSM chiếm cổng 5000.')
    expect(saved).not.toContain('\\#')
    expect(saved).not.toContain('\\`')
    expect(saved).not.toContain('&gt;')
  })

  it('pastes a post the same way opening one does', async () => {
    // The two doors into the same document. Opening a post has always parsed; pasting one
    // now does, and the test that matters is that they agree — a paste that produced its own
    // dialect of the same Markdown would be a second bug wearing the first one's clothes.
    const source = '# Tiêu đề\n\nMột đoạn với ==mực==, $x^2$ và [liên kết](https://a.test).\n\n1. một\n2. hai\n'
    const opened = await open(source)
    const openedMd = markdownOf(opened)
    opened.destroy()

    const pasted = await open('')
    paste(pasted, source)
    const pastedMd = markdownOf(pasted)
    pasted.destroy()

    expect(pastedMd.trim()).toBe(openedMd.trim())
  })

  it('pastes a task list, with the one difference that is known and measured', async () => {
    // `- [x] xong` comes back as `- [x]  xong`, with two spaces. The clipboard parser asks
    // for `preserveWhitespace`, so the space that sat after the checkbox in the parsed HTML
    // survives into the text — where opening a post, which parses the same HTML without that
    // flag, drops it. It is one space inside a list item: Markdown collapses it, the reader
    // never sees it, and the alternative is reimplementing `tiptap-markdown`'s task-item spec
    // to delete it. Pinned rather than fixed, so that if it ever changes, it changes on
    // purpose. The loose spacing between the items is not a paste artefact — opening a post
    // with a task list writes it back the same way.
    const editor = await open('')
    paste(editor, '- [x] xong\n- [ ] chưa\n')
    const saved = markdownOf(editor)
    editor.destroy()
    expect(saved).toContain('- [x]')
    expect(saved).toContain('xong')
    expect(saved).toContain('- [ ]')
    expect(saved).toContain('chưa')
  })

  it('leaves the text alone when the writer holds Shift', async () => {
    // The browser's own "paste as plain text" gesture. A Markdown editor that cannot paste a
    // literal `# 1` into a sentence has taken something away.
    const editor = await open('')
    let slice: Slice | null = null
    const { $from } = editor.state.selection
    slice = editor.view.someProp('clipboardTextParser', (fn) =>
      (fn as ClipboardTextParser)('# not a heading', $from, true)) ?? null
    editor.destroy()
    expect(slice).toBeNull()
  })

  it('does not reformat a paste inside a code block', async () => {
    // Not our rule and not our code: prosemirror-view answers a `code` context with the raw
    // text before any parser is asked. Pinned anyway, because it is the property that makes
    // the option above safe to leave on — a shell transcript pasted into a fence must stay a
    // shell transcript.
    const editor = await open('```bash\n\n```')
    const { state } = editor
    let inCode = false
    state.doc.descendants((node) => {
      if (node.type.spec.code) inCode = true
    })
    editor.destroy()
    expect(inCode).toBe(true)
  })
})
