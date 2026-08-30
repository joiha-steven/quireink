// The writing surface's keyboard, in one table.
//
// Tiptap arrives with a keyboard already — `Mod-b`, `Mod-i`, `Mod-Alt-1..6`, `Mod-Shift-7/8/9`,
// `Mod-z` and the rest — and this repo had added exactly two of its own: `Mod-u` for the pencil
// underline and `Mod-\` for focus mode. Everything this product invented on top of Markdown
// (the highlighter, the ring) and the two things a writer does most (save, link) were mouse-only.
//
// ONE TABLE, because a shortcut nobody can find is not a feature. `SHORTCUTS` below is read by
// the Help screen (`HelpTables.tsx`) as well as by the handlers, so a chord cannot be added,
// moved or removed without the printed list following it.
//
// COLLISIONS WERE CHECKED, not guessed — against the live keymap, by walking every mounted
// extension's `addKeyboardShortcuts` on 2026-08-30:
//
//   taken: Mod-b/B · Mod-i/I · Mod-u · Mod-e · Mod-y · Mod-z · Shift-Mod-z · Mod-a
//          Mod-Alt-0..6 · Mod-Alt-c · Mod-Shift-b · Mod-Shift-s · Mod-Shift-7/8/9
//          Mod-Enter · Mod-Backspace · Mod-Delete · Shift-Enter · Shift-Tab
//
// And against the BROWSER, which is the other keyboard in the room. Two candidates were
// dropped for that: `Mod-Shift-i` (DevTools on Windows/Linux) and `Mod-Shift-p` (a private
// window in Firefox). Both already have a toolbar button and a `/` entry, so nothing is lost.
import { Extension } from '@tiptap/core'

/** id · chord (Tiptap spelling) · what it does, in the Help screen's voice. */
export type Shortcut = { id: string; chord: string; does: string }

export const SHORTCUTS: Shortcut[] = [
  { id: 'save', chord: 'Mod-s', does: 'Save the draft. The editor autosaves to this device only, never to the server — this is what puts the work on the server.' },
  { id: 'link', chord: 'Mod-k', does: 'Add a link, or edit the one the cursor is inside. Clearing the box removes it.' },
  { id: 'ink', chord: 'Mod-Shift-h', does: 'Highlighter over the selection (==text==).' },
  { id: 'ring', chord: 'Mod-Shift-o', does: 'Ballpoint ring around the selection (@@word@@).' },
  { id: 'clear', chord: 'Mod-Shift-x', does: 'Strip every mark off the selection — the repair for text pasted from somewhere else.' },
  { id: 'attributes', chord: 'Mod-Shift-a', does: 'The Attributes panel: slug, date, terms, both pictures, the SEO fields and the Trash.' },
  { id: 'markdown', chord: 'Mod-Shift-m', does: 'Switch between the writing surface and the Markdown source.' },
  { id: 'focus', chord: 'Mod-\\', does: 'Focus mode: everything but the paper goes away.' },
  // Not the editor's, but it is printed by the same two things — the Help sheet and a
  // tooltip — and a second table would be a second place for a chord to drift.
  { id: 'palette', chord: 'Mod-k', does: 'Search everything: the screens, the settings and your writing. Also the button at the top of the rail.' },
]

/**
 * Tiptap's own bindings, for PRINTING only — no handler here answers them.
 *
 * They are in this file because the sheet and the tooltips must be able to say `⌘B` beside
 * Bold, and because a chord this product later wants has to be checked against them. Kept as
 * data rather than as a comment for exactly that: the collision list above was a comment once
 * and could not be read by anything.
 *
 * Only what the toolbar has a button for. `Mod-Backspace`, `Shift-Tab` and the list-navigation
 * keys are Tiptap's furniture, true of every editor built on it, and nobody looks them up.
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

/**
 * The chord as a reader sees it. `Mod` is the platform's own word for the same key, and
 * printing `Ctrl` to somebody on a Mac makes the whole table useless to them.
 *
 * The platform test is `navigator.platform`, deprecated but still the only thing that answers
 * on every browser this admin runs in; `userAgentData` is Chromium-only and undefined in
 * Safari and Firefox, which is half the readers of this table.
 */
export function printChord(chord: string): string {
  const mac = typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform ?? '')
  const parts = chord.split('-')
  // The letter goes UP. Every keyboard prints its letters as capitals and every shortcut
  // sheet ever written follows: `⌘S`, not `⌘s`, which reads as a typo next to `⌘⇧H`.
  // ONE character only — a named key is not a letter, and `Enter` upper-cased to `ENTER`
  // shouted one row of the sheet at the reader.
  const printed = parts.map((part, i) => {
    if (part === 'Mod') return mac ? '⌘' : 'Ctrl'
    if (part === 'Shift') return mac ? '⇧' : 'Shift'
    if (part === 'Alt') return mac ? '⌥' : 'Alt'
    return i === parts.length - 1 && part.length === 1 ? part.toUpperCase() : part
  })
  return printed.join(mac ? '' : '+')
}

/**
 * Does this keydown match that chord?
 *
 * `e.key` rather than `e.code`, so the letter is the one PRINTED on the key in the reader's
 * own layout — a French AZERTY writer presses the key that says `s`, not the one where a US
 * keyboard keeps `s`. With Shift held, `e.key` is the upper case letter, hence the fold.
 */
export function matchesChord(e: KeyboardEvent, chord: string): boolean {
  const parts = chord.split('-')
  const key = parts[parts.length - 1] ?? ''
  const wantShift = parts.includes('Shift')
  if (!(e.metaKey || e.ctrlKey)) return false
  if (e.altKey) return false
  if (e.shiftKey !== wantShift) return false
  return e.key.toLowerCase() === key.toLowerCase()
}

/**
 * `Mod-k`, the one shortcut that has to ask a question.
 *
 * An extension of its own rather than a line in `EditorActions`, because the link is a MARK on
 * the selection: the handler has to run while the editor still owns the focus and the range,
 * and a window listener that opens a `prompt()` has already lost both. It is the same three
 * lines the toolbar button runs, deliberately — one behaviour, two doors.
 *
 * The label is an option because this module holds no i18n, the same arrangement the
 * placeholder has in `editorExtensions.ts`.
 */
export const LinkKey = Extension.create<{ promptLabel: string }>({
  name: 'linkKey',
  addOptions() {
    return { promptLabel: '' }
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
        const url = window.prompt(this.options.promptLabel, previous)
        if (url === null) return true // cancelled, and the key is still handled
        const range = this.editor.chain().focus().extendMarkRange('link')
        if (url === '') range.unsetLink().run()
        else range.setLink({ href: url }).run()
        return true
      },
    }
  },
})

/**
 * The chord for one id, for a tooltip that wants to print it.
 *
 * Exists so a tooltip cannot say `⌘ \` while the table says something else — the drift that
 * makes printed shortcuts worse than none. Falls back to the id itself, which is visible and
 * wrong rather than blank and wrong.
 */
export const chordFor = (id: string): string =>
  [...SHORTCUTS, ...BUILTIN].find((s) => s.id === id)?.chord ?? id

/**
 * A control's tooltip: what it does, then how to do it without the mouse.
 *
 * The point of printing a chord on the control is that this is where somebody LOOKS — a
 * shortcut sheet on another screen teaches nobody, because you have to already suspect the
 * shortcut exists to go and read it. An unknown id prints the label alone rather than a
 * parenthesis with the id in it.
 */
export function tip(label: string, id: string): string {
  const found = [...SHORTCUTS, ...BUILTIN].find((s) => s.id === id)
  return found ? `${label} (${printChord(found.chord)})` : label
}
