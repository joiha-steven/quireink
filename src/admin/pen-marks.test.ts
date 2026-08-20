// The pencil and the ballpoint in the WRITING surface: open a post, save it unchanged.
//
// Same stakes as `ink-mark.test.ts`, plus one more: the underline used to be StarterKit's,
// whose mark has no markdown serialization — pressing U applied an underline the save then
// dropped, silently. The first suite below is the regression test that failure never gets
// to happen again.
//
// happy-dom is registered for THIS FILE ONLY and unregistered afterwards — see the island
// tests for the rule.

import { describe, expect, it, beforeAll, afterAll } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

async function open(content: string) {
  const { Editor } = await import('@tiptap/core')
  const { editorExtensions } = await import('@/admin/components/editorExtensions')
  return new Editor({ extensions: editorExtensions(''), content })
}

const md = (editor: { storage: unknown }) =>
  (editor.storage as { markdown: { getMarkdown: () => string } }).markdown.getMarkdown().trim()

async function roundTrip(source: string): Promise<string> {
  const editor = await open(source)
  const out = md(editor)
  editor.destroy()
  return out
}

describe('the U button reaches the file', () => {
  it('saves an applied underline as ++text++ instead of dropping it', async () => {
    const editor = await open('khoanh chữ này')
    editor.commands.selectAll()
    editor.commands.toggleUnderline()
    expect(md(editor)).toBe('++khoanh chữ này++')
    editor.destroy()
  })

  it('saves an applied ring as @@text@@', async () => {
    const editor = await open('cease')
    editor.commands.selectAll()
    editor.commands.toggleRing()
    expect(md(editor)).toBe('@@cease@@')
    expect(editor.getHTML()).toContain('<mark data-form="o">')
    editor.destroy()
  })
})

describe('the two gestures round-trip', () => {
  it('keeps a plain underline and a coloured one', async () => {
    expect(await roundTrip('a ++gạch dưới++ b')).toBe('a ++gạch dưới++ b')
    expect(await roundTrip('++màu++#green')).toBe('++màu++#green')
  })

  it('keeps a plain ring and a coloured one', async () => {
    expect(await roundTrip('@@cease@@ và @@chữ@@#blue')).toBe('@@cease@@ và @@chữ@@#blue')
  })

  it('keeps an underline stacked under a highlight', async () => {
    expect(await roundTrip('==tô ++gạch++ chung==#pink')).toBe('==tô ++gạch++ chung==#pink')
  })

  it('leaves C++, increments and bare @ runs alone', async () => {
    expect(await roundTrip('C++ và ++i, x @@ y')).toBe('C++ và ++i, x @@ y')
  })

  it('never lets a pasted ring parse as a highlight', async () => {
    // `<mark data-form="o">` must land on the ring mark, not InkMark's bare `mark` rule —
    // the ring rule outranks it AND the ink rule refuses [data-form]. If either guard
    // slips, this saves as `==cease==` and the ring is silently rewritten into a sweep.
    // Parsed through the schema's own DOMParser deliberately: every string door into this
    // editor (constructor, insertContent) is markdown-first (`html:false`), but a real
    // paste arrives as DOM and lands on exactly these parse rules.
    const editor = await open('')
    const { DOMParser } = await import('@tiptap/pm/model')
    const el = document.createElement('div')
    el.innerHTML = '<p>phải <mark data-form="o">cease</mark> ngay</p>'
    editor.commands.setContent(DOMParser.fromSchema(editor.schema).parse(el).toJSON())
    expect(md(editor)).toBe('phải @@cease@@ ngay')
    editor.destroy()
  })
})
