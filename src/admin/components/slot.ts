// What an image slot looks like when it is EMPTY.
//
// There were four answers on 2026-09-01 and no two alike: the editor's featured image and the
// post settings' cover drew a filled grey box (byte-identical to each other, so a hand-copy);
// the OG fallback on Search & URLs drew a 144×80 DASHED outline with no fill; the favicon and
// app icon drew no slot at all, just the words — so those two rows changed height the moment
// a picture went in.
//
// It is a WELL. The kit already says what a well is where `DROPZONE` is defined: a place that
// holds something, carved rather than raised. Not dashed, though — dashes in this admin mean
// "drop a file here", and none of these four accept a drop; the two that do (the import box,
// the library) keep theirs. No radius either: every call site already has a shape to match,
// from a 32px favicon to a full-width 16:9.
export const EMPTY_SLOT =
  'flex items-center justify-center bg-neutral-100 text-xs text-neutral-500 '
  + 'shadow-[inset_0_1px_2px_rgba(0,0,0,.06)] '
  + 'dark:bg-neutral-800 dark:text-neutral-400 dark:shadow-[inset_0_1px_2px_rgba(0,0,0,.35)]'
