// The Markdown source view, and the switch between it and the writing.
//
// Split out of `Editor.tsx` on 2026-09-13, when keeping the place across the switch pushed
// that file past its 400-line ceiling. The seam is the one the subject draws: everything
// here is about the OTHER view of the same document — the state that says which one is
// showing, the text the textarea holds, and the arithmetic that turns a caret in one into a
// caret in the other. Nothing here knows about the toolbar, the menus or the pen.
//
// ⚠️ WHAT THE SWITCH USED TO DO, and it was two separate losses. The scroll box kept its
// PIXEL offset while the two views have different heights, so 85% of the way down the
// writing arrived as 66% of the way down the source; and the textarea opened with its caret
// at 0, so the first click in it scrolled the piece to the top. Measured 2026-09-13 on an
// 18k-word draft: from three different starting points, every switch ended at offset 0.
import { useEffect, useRef, useState } from 'react'
import type { Editor as TiptapEditor } from '@tiptap/core'
import { markdownOffsetAt, posAtMarkdownOffset, readMarkdown, videoUrlsToNodes } from './editorDoc'

export type RawView = {
  /** Whether the source view is the one showing. */
  on: boolean
  text: string
  setText: (next: string) => void
  taRef: React.RefObject<HTMLTextAreaElement | null>
  /** Reads the live values without re-subscribing (`Editor.tsx` holds them in closures). */
  onRef: React.MutableRefObject<boolean>
  textRef: React.MutableRefObject<string>
  /** Throw the switch, carrying the caret over. */
  toggle: () => void
  /** Leave the source view showing a document loaded from elsewhere (a revision, a draft). */
  load: (markdown: string) => void
}

export function useRawView(
  // A REF rather than the editor, because this hook is declared beside `useEditor` and the
  // instance does not exist at that line — the same ref the drop and paste handlers read.
  editorRef: React.MutableRefObject<TiptapEditor | null>,
  onText: (markdown: string) => void,
): RawView {
  const [on, setOn] = useState(false)
  const [text, setText] = useState('')
  const onRef = useRef(on)
  const textRef = useRef(text)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const onTextRef = useRef(onText)
  // Where the caret has to land in the source view, carried across the render that creates
  // the textarea — it does not exist yet at the moment the switch is thrown.
  const caret = useRef<number | null>(null)

  useEffect(() => { onRef.current = on }, [on])
  useEffect(() => { textRef.current = text }, [text])
  useEffect(() => { onTextRef.current = onText }, [onText])

  // Grow the source box to fit its content (no tiny inner scrollbox), then put the caret in.
  useEffect(() => {
    const ta = taRef.current
    if (!on || !ta) return
    ta.style.height = 'auto'
    ta.style.height = `${ta.scrollHeight}px`
    // AFTER the box has its real height, and not before: focusing a textarea scrolls the page
    // to its caret, and a caret placed while the box is still one line tall scrolls to the
    // wrong line and then the box grows underneath it.
    const at = caret.current
    if (at === null) return
    caret.current = null
    // SELECT, THEN FOCUS, and that order is the whole thing. A textarea remembers its
    // selection while unfocused, and the browser scrolls to the caret as part of FOCUSING;
    // focusing first scrolls to where the caret was (0, the top of the piece) and setting
    // the range afterwards moves the caret without scrolling again — which is the bug this
    // was written to fix, reproduced exactly by the two lines in the other order.
    ta.setSelectionRange(at, at)
    ta.focus()
  }, [on, text])

  function toggle(): void {
    const editor = editorRef.current
    if (!editor) return
    if (onRef.current) {
      const next = textRef.current
      const at = taRef.current?.selectionStart ?? 0
      editor.commands.setContent(next)
      videoUrlsToNodes(editor)
      onTextRef.current(next)
      setOn(false)
      // The same line, in the other view. `focus(pos)` both puts the caret there and scrolls
      // to it, which is the pair of things this switch used to do neither of.
      editor.commands.focus(posAtMarkdownOffset(editor, at, next))
    } else {
      caret.current = markdownOffsetAt(editor, editor.state.selection.from)
      setText(readMarkdown(editor))
      setOn(true)
    }
  }

  function load(markdown: string): void {
    setText(markdown)
    setOn(false)
  }

  return { on, text, setText, taRef, onRef, textRef, toggle, load }
}
