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

/** id · chord (Tiptap spelling) · what it does, in the Help screen's voice. */
import { onMac, printChord as print } from '@/admin-shared/rail'

// The two tables and their type moved to `@/admin-shared/keys` when the Help screen became a
// page (ADR 0054): the server prints the shortcut sheet from the same list the handlers read.
export { BUILTIN, SHORTCUTS, type Shortcut } from '@/admin-shared/keys'
import { BUILTIN, SHORTCUTS } from '@/admin-shared/keys'

/**
 * The chord as a reader sees it. `Mod` is the platform's own word for the same key, and
 * printing `Ctrl` to somebody on a Mac makes the whole table useless to them.
 *
 * The SPELLING moved to `@/admin-shared/rail` on 2026-09-14 (ADR 0054): the server draws the rail's
 * search key, which prints this chord, and a server module may not import anything under
 * `src/admin`. What stays here is the platform question, which only a browser can answer.
 */
export const printChord = (chord: string): string =>
  print(chord, typeof navigator !== 'undefined' && onMac(navigator.platform ?? ''))

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
