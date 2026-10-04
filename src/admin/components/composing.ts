// A key that belongs to an input method, not to the page.
//
// Vietnamese Telex on macOS and every CJK input method confirm a word with Enter, and Chrome
// delivers that Enter as an ordinary `keydown` with `isComposing` set (and `keyCode` 229). A
// handler that acts on Enter without asking added the half-typed "việ" as a tag, sent a half
// typed message to the assistant and ran a Replace (2026-09-30). Every Enter handler in the
// admin asks this first.

/** True while an input method is composing, so the key is the method's to use. */
export const composing = (e: KeyboardEvent): boolean => e.isComposing || e.keyCode === 229

/**
 * `fn` on every edit a field SETTLES on, and never on a word an input method is still building.
 *
 * The second half of the same problem. On macOS Telex, `tiếng` is built in place — `t`, `ti`,
 * `tie`, `tiê`, `tiên`, `tiêng`, `tiếng` — and every step fires `input`. A list filtered on each
 * one flickers through matches for words nobody is looking for, a search that reaches the server
 * after a pause sends one for `tiê`, and the find strip rescans the whole piece for each. The
 * steps arrive with `isComposing` set; the word that stays arrives on `compositionend` (Chrome
 * fires its last `input` before that, Safari after, so a field may hear the finished word twice
 * — every caller here is idempotent, a filter or a draft field).
 *
 * The input methods most Vietnamese writers use (EVKey, OpenKey, Unikey) do not compose at all:
 * their half-built `tieng` is real text with real `input` events, which this passes straight
 * through — and that is right, because it is what is on screen.
 */
export function onTyped(field: HTMLElement, fn: (e: Event) => void): void {
  field.addEventListener('input', (e) => { if (!(e as InputEvent).isComposing) fn(e) })
  field.addEventListener('compositionend', fn)
}
