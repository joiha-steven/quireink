// THE MARKDOWN SOURCE VIEW, and the switch between it and the writing.
//
// Everything here is about the OTHER view of the same document: which one is showing, the text
// the textarea holds, and the arithmetic that turns a caret in one into a caret in the other.
// Nothing here knows about the toolbar, the menus or the pen.
//
// ⚠️ BOTH VIEWS ARE IN THE PAGE AT ONCE, and only one is `hidden`. The React version rendered
// the paper conditionally, so switching to the source REMOVED the host the writing surface
// lived in — and switching back built a new one, which is how an editor shipped that came back
// from the Markdown view showing an empty sheet with the document intact inside it. A `hidden`
// attribute cannot do that: the surface stays exactly where it was mounted.
//
// ⚠️ WHAT THE SWITCH USED TO LOSE, and it was two separate losses. The scroll box kept its
// PIXEL offset while the two views have different heights, so 85% of the way down the writing
// arrived as 66% of the way down the source; and the textarea opened with its caret at 0, so
// the first click in it scrolled the piece to the top. Measured 2026-09-13 on an 18k-word
// draft: from three different starting points, every switch ended at offset 0.
import type { Editor as TiptapEditor } from '@tiptap/core'
import type { SourceView } from '@/admin/components/editor-source'
import {
  markdownOffsetAt, posAtMarkdownOffset, readMarkdown, videoUrlsToNodes,
} from '@/admin/components/editorDoc'

export type RawView = {
  /** Whether the source view is the one showing. */
  readonly on: boolean
  /** The live Markdown while the source view owns it. */
  readonly text: string
  /** Push text in from the textarea's own edits, without moving anything. */
  setText: (next: string) => void
  /** Throw the switch, carrying the caret over. */
  toggle: () => void
  /** Show the WRITING again with a document loaded from elsewhere (a revision, a draft). */
  load: (markdown: string) => void
}

export function wireRaw(
  source: SourceView,
  editor: TiptapEditor,
  hooks: {
    /** The Markdown, whenever the source view has changed it. */
    onText: (markdown: string) => void
    /** Which view is showing now, so the sheet can hide the other and take the chrome down. */
    onShow: (raw: boolean) => void
  },
): RawView {
  let on = false
  let text = ''

  /** Put the source view on screen at its real height, with the caret where the writer was. */
  const reveal = (at: number): void => {
    const ta = source.area
    // The text first, and the mirror with it: everything below measures the box.
    source.setValue(text)
    ta.style.height = 'auto'
    ta.style.height = `${ta.scrollHeight}px`
    // AFTER the box has its real height, and not before: focusing a textarea scrolls the page
    // to its caret, and a caret placed while the box is still one line tall scrolls to the
    // wrong line and then the box grows underneath it.
    //
    // SELECT, THEN FOCUS, and that order is the whole thing. A textarea remembers its selection
    // while unfocused, and the browser scrolls to the caret as part of FOCUSING; focusing first
    // scrolls to where the caret was (0, the top of the piece) and setting the range afterwards
    // moves the caret without scrolling again.
    ta.setSelectionRange(at, at)
    ta.focus()
  }

  return {
    get on() { return on },
    get text() { return text },
    setText: (next: string) => { text = next },

    toggle() {
      if (on) {
        const next = text
        const at = source.area.selectionStart
        editor.commands.setContent(next)
        videoUrlsToNodes(editor)
        hooks.onText(next)
        on = false
        hooks.onShow(false)
        // The same line, in the other view. `focus(pos)` both puts the caret there and scrolls
        // to it, which is the pair of things this switch used to do neither of.
        editor.commands.focus(posAtMarkdownOffset(editor, at, next))
        return
      }
      const at = markdownOffsetAt(editor, editor.state.selection.from)
      text = readMarkdown(editor)
      on = true
      // The slot has to be visible before the textarea is measured: `scrollHeight` on a hidden
      // box is 0, and a box laid out at zero height puts the caret on the first line.
      hooks.onShow(true)
      reveal(at)
    },

    load(markdown: string) {
      text = markdown
      source.setValue(markdown)
      if (!on) return
      on = false
      hooks.onShow(false)
    },
  }
}
