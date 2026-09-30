// A key that belongs to an input method, not to the page.
//
// Vietnamese Telex on macOS and every CJK input method confirm a word with Enter, and Chrome
// delivers that Enter as an ordinary `keydown` with `isComposing` set (and `keyCode` 229). A
// handler that acts on Enter without asking added the half-typed "việ" as a tag, sent a half
// typed message to the assistant and ran a Replace (2026-09-30). Every Enter handler in the
// admin asks this first.

/** True while an input method is composing, so the key is the method's to use. */
export const composing = (e: KeyboardEvent): boolean => e.isComposing || e.keyCode === 229
