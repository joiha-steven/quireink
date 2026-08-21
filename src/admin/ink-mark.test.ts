// The pen in the WRITING surface: open a post, and save it again unchanged.
//
// This is the test that matters most for the highlighter, because the failure it guards is
// silent. The editor is the only thing that rewrites a post's Markdown wholesale, so a
// serializer that is subtly wrong does not throw — it just saves a different document than
// the one that was opened, and the author finds out later.
//
// happy-dom is registered for THIS FILE ONLY and unregistered afterwards, the same rule the
// island tests follow: registering globally hands every other suite happy-dom's `fetch`.

import { describe, expect, it, beforeAll, afterAll } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

/** A fresh editor with the extension set `Editor.tsx` actually mounts — the REAL list, not
 *  a copy of it. This file used to rebuild the array by hand under a comment making exactly
 *  that claim, which meant a node added to the editor was silently absent from its own
 *  round-trip test. `editorExtensions.ts` is now the one list. */
async function open(content: string) {
  const { Editor } = await import('@tiptap/core')
  const { editorExtensions } = await import('@/admin/components/editorExtensions')
  return new Editor({ extensions: editorExtensions(''), content })
}

async function roundTrip(md: string): Promise<string> {
  const editor = await open(md)
  const out = (editor.storage as unknown as { markdown: { getMarkdown: () => string } }).markdown.getMarkdown()
  editor.destroy()
  return out.trim()
}

async function html(md: string): Promise<string> {
  const editor = await open(md)
  const out = editor.getHTML()
  editor.destroy()
  return out
}

/**
 * Type into an editor one character at a time, through the plugin a KEYPRESS goes through.
 *
 * `insertContent` would be one line and would prove nothing: input rules hang off
 * `handleTextInput`, so anything that dispatches a transaction directly skips exactly the
 * code under test. This is the seam that let `==go tay==#pink` mark the word "pink" and
 * delete "go tay" while every other test in this file passed.
 */
function type(editor: { state: { selection: { from: number; to: number }; tr: { insertText: (t: string, f: number, to: number) => unknown } }; view: { someProp: (n: string, f: (fn: unknown) => unknown) => unknown; dispatch: (tr: unknown) => void } }, text: string) {
  for (const ch of text) {
    const { from, to } = editor.state.selection
    const handled = editor.view.someProp('handleTextInput', (fn) =>
      (fn as (v: unknown, f: number, t: number, c: string) => boolean)(editor.view, from, to, ch))
    if (!handled) editor.view.dispatch(editor.state.tr.insertText(ch, from, to))
  }
}

describe('the highlighter in the editor', () => {
  it('inks the stroke in the writing surface, not two equals signs', async () => {
    // The whole point of the mark existing: what you are writing looks like what publishes.
    expect(await html('==vài chữ==')).toContain('<mark>vài chữ</mark>')
    expect(await html('==định nghĩa==#blue')).toContain('<mark data-ink="blue">định nghĩa</mark>')
  })

  it('opens and saves a highlighted post unchanged', async () => {
    for (const md of [
      '==highlighted==',
      'Người ta chỉ ==giữ lại đúng chỗ==#green, thường là ==vài chữ==.',
      '==ệ ộ ỡ ầy==#green',
      '==a==#pink and ==b==#blue and ==c==',
      '- [ ] ==việc phải làm==#orange',
      '> ==trong trích dẫn==#blue',
    ]) {
      expect(await roundTrip(md)).toBe(md)
    }
  })

  it('keeps ONE stroke across bold and a link', async () => {
    // Without `mixable` the serializer closed and reopened the mark around every nested one,
    // turning this into `==chữ ==#orange**==in đậm==#orange**==, một ==#orange[==liên…` —
    // not a formatting wobble, a different document.
    const md = '==chữ **in đậm**, một [liên kết](/x) và cả thế==#orange'
    expect(await roundTrip(md)).toBe(md)
  })

  it('leaves prose that only looks like the syntax alone', async () => {
    for (const md of ['x == y and z == w', '===three===']) {
      expect(await roundTrip(md)).toBe(md)
    }
    expect(await html('x == y and z == w')).not.toContain('<mark')
  })

  it('does not invent a colour attribute for the default ink', async () => {
    // Must match the server renderer exactly, or the same post yields two different HTMLs
    // depending on whether it was last touched by the editor.
    expect(await html('==x==')).toContain('<mark>x</mark>')
    expect(await roundTrip('==x==#yellow')).toBe('==x==')
  })

  it('inks as the syntax is TYPED, colour suffix included', async () => {
    // The colour arrives after the stroke is already complete, so it is a second input rule
    // that recolours what it follows and swallows itself. Typed, not pasted, not loaded.
    const editor = await open('x')
    editor.commands.setTextSelection(editor.state.doc.content.size)
    type(editor as never, ' ==go tay==#pink xong')
    expect(editor.getHTML()).toBe('<p>x <mark data-ink="pink">go tay</mark> xong</p>')
    // And what gets saved is the syntax that was typed.
    expect((editor.storage as unknown as { markdown: { getMarkdown: () => string } }).markdown.getMarkdown().trim())
      .toBe('x ==go tay==#pink xong')
    editor.destroy()
  })

  it('types the plain form as yellow, and leaves a loose #colour alone', async () => {
    const a = await open('x')
    a.commands.setTextSelection(a.state.doc.content.size)
    type(a as never, ' ==vang thoi== la xong')
    expect(a.getHTML()).toBe('<p>x <mark>vang thoi</mark> la xong</p>')
    a.destroy()

    // A hashtag that follows ordinary words is a word, not a command.
    const b = await open('x')
    b.commands.setTextSelection(b.state.doc.content.size)
    type(b as never, ' mau #pink khong dinh gi')
    expect(b.getHTML()).toBe('<p>x mau #pink khong dinh gi</p>')
    b.destroy()
  })

  it('does not fire on a comparison typed in prose', async () => {
    const editor = await open('x')
    editor.commands.setTextSelection(editor.state.doc.content.size)
    type(editor as never, ' y == z va a == b')
    expect(editor.getHTML()).not.toContain('<mark')
    editor.destroy()
  })

  it('survives a stroke that follows bold in the same paragraph', async () => {
    // THE BLANK-PAGE BUG, and it is here rather than in a file about parsers because this is
    // the sentence that did it: one emphasis run, then one stroke. `inkPlugin` parsed the
    // stroke's contents into the token array the OUTER parse was still holding indices into,
    // markdown-it's `text_collapse` spliced that array, and the next delimiter lookup threw
    // `undefined is not an object (evaluating 'token.type = "s_open"')` out of markdown-it —
    // through `setContent`, into a React handler with no boundary above it. The admin
    // unmounted and the owner got a white screen with nothing in the console to explain it.
    //
    // The order is the whole trick: `==mực== và **đậm**` never failed, and neither did either
    // one on its own, so nothing anybody wrote deliberately to test the pen ever hit it.
    expect(await html('**đậm** và ==mực==')).toBe('<p><strong>đậm</strong> và <mark>mực</mark></p>')
    expect(await html('# Tiêu đề **đậm** và ==mực==')).toContain('<mark>mực</mark>')
    expect(await roundTrip('Chi phí **thấp** và ==tiết kiệm== nhiều.')).toBe('Chi phí **thấp** và ==tiết kiệm== nhiều.')
    // The nested parse still nests: what the stroke contains keeps its own marks, and the
    // whole line survives a save. (The HTML shape is ProseMirror's — one `<mark>` per text
    // node — so the round trip, not the markup, is what says the document is intact.)
    expect(await html('==chữ **đậm** trong mực==')).toContain('<strong><mark>đậm</mark></strong>')
    expect(await roundTrip('==chữ **đậm** trong mực==')).toBe('==chữ **đậm** trong mực==')
  })

  it('survives a stroke inside a link label', async () => {
    // THE SECOND BLANK PAGE, found in the owner's own draft after the first one was fixed and
    // shipped. markdown-it scans a link's LABEL by running every inline rule in silent mode
    // and then checking that the rule which claimed a match moved the cursor. `if (silent)
    // return true` claims without moving, so markdown-it throws
    // `inline rule didn't increment state.pos` — not a wrong document, a dead parse, inside a
    // React render, which is a white admin again.
    //
    // It needs a delimiter INSIDE `[...]` to happen at all, which is why a day of round-trip
    // tests never touched it: every fixture put the stroke beside the link, not in it.
    expect(await roundTrip('Xem [==tài liệu==](https://a.test) ở đây.')).toBe('Xem [==tài liệu==](https://a.test) ở đây.')
    expect(await html('[==tô đậm==](https://a.test)')).toContain('<mark>')
    // Bold and a ring in one label — the owner's line, near enough.
    expect(await roundTrip('dựng [**@@Quire Ink@@**](https://a.test) lên NAS'))
      .toBe('dựng [**@@Quire Ink@@**](https://a.test) lên NAS')
    // And a formula in a label, the same rule in `MathNode.tsx`.
    expect(await roundTrip('giá [$x^2$](https://a.test) đây')).toBe('giá [$x^2$](https://a.test) đây')
  })

  it('ends the stroke at an inline code span, stably', async () => {
    // The documented limit, pinned so it stays a KNOWN shortfall rather than becoming a
    // surprise. `code` excludes every other mark at the schema level (see InkMark.ts), so
    // the editor cannot hold this one. What matters is that the result is valid Markdown and
    // a FIXED POINT: saving twice must not keep eating the stroke.
    const once = await roundTrip('==chữ và cả `mã`==#orange đều thế.')
    expect(once).toBe('==chữ và cả==#orange `mã` đều thế.')
    expect(await roundTrip(once)).toBe(once)
  })
})
