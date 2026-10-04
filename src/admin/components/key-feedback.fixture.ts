// What the screen shows after each key a writer presses, typing
// "Tiếng Việt có dấu, gõ nhanh không lỗi." in Telex — one list per word.
//
// Shared by `key-feedback.test.ts` and `scripts/typing-check.ts`, so the unit test and the real
// browser type exactly the same thing. A step that only appends one letter is the writer's own
// key passing straight through; any other step is the input method rewriting the word (a
// backspace-based one by deleting back to the change, a composing one by updating its buffer).
export const TELEX_STEPS: string[][] = [
  ['T', 'Ti', 'Tie', 'Tiê', 'Tiên', 'Tiêng', 'Tiếng'],
  ['V', 'Vi', 'Vie', 'Viê', 'Viêt', 'Việt'],
  ['c', 'co', 'có'],
  ['d', 'da', 'dâ', 'dâu', 'dấu', 'dấu,'],
  ['g', 'go', 'gõ'],
  ['n', 'nh', 'nha', 'nhan', 'nhanh'],
  ['k', 'kh', 'kho', 'khô', 'khôn', 'không'],
  ['l', 'lo', 'lô', 'lôi', 'lỗi', 'lỗi.'],
]

/** The sentence those steps end on. */
export const TELEX_SENTENCE = TELEX_STEPS.map((w) => w[w.length - 1]).join(' ')
