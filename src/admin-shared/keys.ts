// The editor's keyboard, as data.
//
// It lives here rather than in `admin/components/editorKeys.ts` because the Help screen prints
// it and that screen is server-rendered HTML since ADR 0054. Generated from this list rather
// than typed out, for the reason the Help table states: a shortcut sheet that has drifted from
// the shortcuts is worse than no sheet, because the reader presses the key, nothing happens,
// and stops trusting the page.
//
// What stays in `editorKeys.ts` is the part only a browser can do: matching a real keydown.
import { PALETTE_CHORD } from '@/admin-shared/rail'

export type Shortcut = { id: string; chord: string; does: string }

export const SHORTCUTS: Shortcut[] = [
  { id: 'save', chord: 'Mod-s', does: 'Save the draft. Autosave keeps a copy on this device and on the server, but only Save writes the piece itself — the text a preview or a Publish reads.' },
  { id: 'link', chord: 'Mod-k', does: 'Add a link, or edit the one the cursor is inside. Clearing the box removes it.' },
  { id: 'ink', chord: 'Mod-Shift-h', does: 'Highlighter over the selection (==text==).' },
  { id: 'ring', chord: 'Mod-Shift-o', does: 'Ballpoint ring around the selection (@@word@@).' },
  { id: 'clear', chord: 'Mod-Shift-x', does: 'Strip every mark off the selection — the repair for text pasted from somewhere else.' },
  { id: 'attributes', chord: 'Mod-Shift-a', does: 'The Attributes panel: slug, date, terms, both pictures, the SEO fields and the Trash.' },
  { id: 'markdown', chord: 'Mod-Shift-m', does: 'Switch between the writing surface and the Markdown source.' },
  { id: 'focus', chord: 'Mod-\\', does: 'Focus mode: everything but the paper goes away.' },
  // ⚠️ TAKEN FROM THE BROWSER, deliberately, and the only chord here that is. The argument is
  // the one `Mod-s` made: the browser's own find cannot search the Markdown view's textarea
  // usefully, cannot replace anything, and matches the rail and the write pane beside the
  // sheet as readily as the piece. Handled in `useEditorFind.ts` rather than in
  // `EditorActions` — the strip's open state lives with the editor, not with the action line
  // — so the loop there finds this row and matches no branch, which is correct and is why
  // the row carries this note.
  { id: 'find', chord: 'Mod-f', does: 'Find, in either view. Enter steps to the next match, Shift-Enter to the one before, Escape closes it.' },
  { id: 'replace', chord: 'Mod-Shift-f', does: 'Find and replace: the same strip with the replace field open. The chevron at its head opens it too.' },
  // Not the editor's, but it is printed by the same two things — the Help sheet and a
  // tooltip — and a second table would be a second place for a chord to drift.
  // ⚠️ `Mod-Shift-k`, and it moved there on 2026-09-07. `Mod-k` was assigned TWICE — this
  // palette on a window listener, and the editor's link box inside the editor — so pressing
  // it while writing opened both: the link box took the selection and the palette opened over
  // it. `Mod-k` is the link in every editor anybody has used, so the palette is the one that
  // moves, and the rail's search button prints the new chord beside itself.
  { id: 'palette', chord: PALETTE_CHORD, does: 'Search everything: the screens, the settings and your writing. Also the button at the top of the rail.' },
]

/**
 * The editor's own bindings, for PRINTING only — no handler here answers them. They are
 * `admin/editor/keymap.ts`'s, and were the editor package's before ADR 0054's step 7.
 *
 * They are in this file because the sheet and the tooltips must be able to say `⌘B` beside
 * Bold, and because a chord this product later wants has to be checked against them. Kept as
 * data rather than as a comment for exactly that: the collision list above was a comment once
 * and could not be read by anything.
 *
 * Only what the toolbar has a button for. `Mod-Backspace`, `Shift-Tab` and the list-navigation
 * keys are an editor's ordinary furniture, true of every editor, and nobody looks them up.
 */
export const BUILTIN: Shortcut[] = [
  { id: 'bold', chord: 'Mod-b', does: 'Bold.' },
  { id: 'italic', chord: 'Mod-i', does: 'Italic.' },
  { id: 'underline', chord: 'Mod-u', does: 'Pencil underline (++text++).' },
  { id: 'strike', chord: 'Mod-Shift-s', does: 'Strikethrough.' },
  { id: 'code', chord: 'Mod-e', does: 'Code span.' },
  { id: 'codeBlock', chord: 'Mod-Alt-c', does: 'Fenced code block.' },
  { id: 'heading', chord: 'Mod-Alt-1', does: 'Heading levels 1 to 6 — Mod-Alt-2 for H2, and so on. Mod-Alt-0 goes back to a paragraph.' },
  { id: 'bulletList', chord: 'Mod-Shift-8', does: 'Bulleted list.' },
  { id: 'orderedList', chord: 'Mod-Shift-7', does: 'Numbered list.' },
  { id: 'taskList', chord: 'Mod-Shift-9', does: 'Checklist.' },
  { id: 'blockquote', chord: 'Mod-Shift-b', does: 'Blockquote. Start it with [!NOTE] for a callout.' },
  { id: 'undo', chord: 'Mod-z', does: 'Undo. Shift-Mod-Z redoes.' },
  { id: 'hardBreak', chord: 'Shift-Enter', does: 'A line break inside the same paragraph.' },
]
