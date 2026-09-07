// `Mod-k`, the one editor shortcut that needs Tiptap to express it.
//
// ITS OWN FILE since 2026-09-07, and the split is about weight rather than tidiness. It lived
// in `editorKeys.ts` beside the shortcut TABLE, and the rail's search button reads that table
// for a tooltip — so `@tiptap/core` was pulled into the chunk every admin screen loads.
// Measured on the build: 308 KB of ProseMirror and Tiptap parsed on the dashboard, on
// Settings, on Analytics, on every screen that has no editor in it. The table is data; this
// is the only part that is not.
import { Extension } from '@tiptap/core'

/**
 * `Mod-k`, the one shortcut that has to ask a question.
 *
 * An extension of its own rather than a line in `EditorActions`, because the link is a MARK on
 * the selection: the handler has to run while the editor still owns the focus and the range,
 * and a window listener that asked elsewhere has already lost both. It is the same three
 * lines the toolbar button runs, deliberately — one behaviour, two doors.
 *
 * ⚠️ ASKING IS NOW ASYNCHRONOUS, and the shape follows from that. The native `prompt()` this
 * replaced (2026-09-07) blocked the main thread, so the answer was a value on the next line;
 * the product's own dialog resolves later, and a Tiptap shortcut must return its boolean NOW.
 * So the key returns `true` at once — it HAS handled the chord — and applies the mark when the
 * answer arrives. `chain().focus()` restores the selection ProseMirror kept while the dialog
 * held the DOM focus, which is the same recovery the prompt needed and got by accident.
 *
 * The asker is an option because this module holds no i18n and no React, the same arrangement
 * the placeholder has in `editorExtensions.ts`.
 */
export const LinkKey = Extension.create<{ askLink: (previous: string) => Promise<string | null> }>({
  name: 'linkKey',
  addOptions() {
    return { askLink: async () => null }
  },
  addKeyboardShortcuts() {
    return {
      // `Mod-Shift-x`, the repair for pasted text. Everything arriving from a word processor
      // or another site brings its marks with it, and picking them off one button at a time
      // is the reason people paste into a plain text field first and lose the paragraphs too.
      // Marks only: the headings, lists and quotes are the SHAPE and are usually what you
      // wanted to keep.
      'Mod-Shift-x': () => this.editor.chain().focus().unsetAllMarks().run(),
      'Mod-k': () => {
        const previous = (this.editor.getAttributes('link').href as string | undefined) ?? ''
        void this.options.askLink(previous).then((url) => {
          if (url === null) return // backed out, and the link is untouched
          const range = this.editor.chain().focus().extendMarkRange('link')
          if (url === '') range.unsetLink().run() // cleared the URL -> remove the link
          else range.setLink({ href: url }).run()
        })
        return true // the chord is handled either way, so nothing else claims it
      },
    }
  },
})
