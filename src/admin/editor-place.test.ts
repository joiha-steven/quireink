// KEEPING THE PLACE across the switch between the writing and the Markdown source.
//
// The two functions under test are each other's inverse, and the law that makes them useful
// is a ROUND TRIP: a caret somewhere in the document, expressed as an offset in the Markdown
// and read back, has to come home to the same sentence. Pinning exact positions instead would
// pin the serializer's notation — a fixture to rewrite whenever a mark's syntax changes —
// while saying nothing about the property the writer actually feels.
//
// The corpus is run through it because the failure this replaces was invisible on a short
// document: the old switch kept a PIXEL offset, which is right at the top of a piece and
// wrong by a screenful near the bottom of a long one.
//
// happy-dom is registered for THIS FILE ONLY, the rule every editor suite here follows.

import { describe, expect, it, beforeAll, afterAll } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import type { Editor as TiptapEditor } from '@tiptap/core'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

async function open(source: string): Promise<TiptapEditor> {
  const { Editor } = await import('@tiptap/core')
  const { editorExtensions } = await import('@/admin/components/editorExtensions')
  return new Editor({ extensions: editorExtensions(''), content: source }) as unknown as TiptapEditor
}

/** A piece long enough that being off by a paragraph is visible, and marked up like a real one. */
function draft(sections: number): string {
  const out: string[] = []
  for (let i = 0; i < sections; i++) {
    out.push(`## Phần ${i + 1}, với ==một vệt mực==#green trong tiêu đề`)
    out.push(`Câu mở của phần ${i + 1}. Có @@một chữ khoanh tròn@@, ++một chữ gạch chân++ và **một chữ đậm**, rồi một [liên kết](https://example.com/${i}) để đóng đoạn.`)
    out.push(`Đoạn thứ hai của phần ${i + 1}, không mang dấu bút nào, chỉ là chữ chạy dài cho tới hết dòng.`)
  }
  return out.join('\n\n')
}

describe('the caret, carried between the two views', () => {
  it('turns a position into the offset the source view opens at', async () => {
    const editor = await open(draft(6))
    const { markdownOffsetAt, readMarkdown } = await import('@/admin/components/editorDoc')
    const md = readMarkdown(editor)

    // The offset a position maps to is the length of the Markdown BEFORE it, which is the
    // property the switch relies on: the prefix of a cut document is the prefix of the whole.
    const end = markdownOffsetAt(editor, editor.state.doc.content.size)
    expect(end).toBe(md.length)
    expect(markdownOffsetAt(editor, 0)).toBe(0)

    // And it grows with the position, or a caret halfway down would open the source view
    // above a caret a quarter of the way down.
    const quarter = markdownOffsetAt(editor, Math.floor(editor.state.doc.content.size * 0.25))
    const half = markdownOffsetAt(editor, Math.floor(editor.state.doc.content.size * 0.5))
    expect(quarter).toBeLessThan(half)
    expect(half).toBeLessThan(end)
    editor.destroy()
  })

  it('comes home to the same sentence, from anywhere in a long piece', async () => {
    const editor = await open(draft(20))
    const { markdownOffsetAt, posAtMarkdownOffset, readMarkdown } = await import('@/admin/components/editorDoc')
    const md = readMarkdown(editor)
    const size = editor.state.doc.content.size

    for (const part of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      const pos = Math.floor(size * part)
      const back = posAtMarkdownOffset(editor, markdownOffsetAt(editor, pos), md)
      // WITHIN A SENTENCE, not to the character. The offset is exact; coming back is an
      // interpolation that stops when it is closer than a reader can see, and the notation
      // around a mark means a few characters of Markdown are no characters of text at all.
      // 60 positions is under half a paragraph of this draft.
      expect(Math.abs(back - pos)).toBeLessThan(60)
    }
    editor.destroy()
  })

  it('answers inside the document for offsets outside the text', async () => {
    const editor = await open(draft(3))
    const { posAtMarkdownOffset, readMarkdown } = await import('@/admin/components/editorDoc')
    const md = readMarkdown(editor)
    const size = editor.state.doc.content.size

    // A source view can be edited before the switch back, so the offset arriving here may be
    // past the end of the document it is being mapped into — or at 0, on an empty piece.
    for (const offset of [0, -50, md.length, md.length * 2]) {
      const pos = posAtMarkdownOffset(editor, offset, md)
      expect(pos).toBeGreaterThanOrEqual(0)
      expect(pos).toBeLessThanOrEqual(size)
    }
    editor.destroy()
  })

  it('says 0 for a document with nothing in it', async () => {
    const editor = await open('')
    const { markdownOffsetAt, posAtMarkdownOffset } = await import('@/admin/components/editorDoc')
    expect(markdownOffsetAt(editor, 0)).toBe(0)
    expect(posAtMarkdownOffset(editor, 0, '')).toBe(0)
    editor.destroy()
  })
})
