// The public sheets as they go out on the wire: each one minified, once.
//
// The sheets are commented the way the rest of this codebase is, and those comments were going out
// on the wire: measured 2026-07-30, 34,438 of the 65,645 bytes served were comment text, and a first
// visit paid for all of it. Stripping them is worth about 14 KB compressed per cold visit. The prose
// stays in the .ts files; `css-min.ts` takes it out on the way to being hashed and served.
//
// ITS OWN MODULE so that the Cloudflare build can run it at build time instead of at module load.
// Bun minifies here when the process starts, as it always has — once, a few milliseconds, gone. A
// Worker starts an isolate far more often than Bun starts a process, and every one of them paid for
// these six calls before its first request: 8.9 ms of CPU, measured 2026-10-03 by `wrangler check
// startup`. `scripts/build-worker.ts` evaluates this module under Bun and puts the six finished
// strings in its place, so the Worker gets the same bytes (and the same hashes in the same URLs)
// without the work. Nothing here may depend on anything but the sheets' own source, or the two
// builds would stop agreeing.
import { PUBLIC_CSS } from '@/web/public.css'
import { LOOK_CODE_CSS } from '@/web/look-code.css'
import { LOOK_PAPER_CSS } from '@/web/look-paper.css'
import { LOOK_NOTES_CSS } from '@/web/look-notes.css'
import { INK_HIGHLIGHT_CSS, INK_LINES_CSS } from '@/pen/ink.css'
import { minifyCss } from '@/web/css-min'

export const SERVED_CSS = {
  site: minifyCss(PUBLIC_CSS),
  'pen-marks': minifyCss(INK_HIGHLIGHT_CSS),
  'pen-lines': minifyCss(INK_LINES_CSS),
  'look-code': minifyCss(LOOK_CODE_CSS),
  'look-paper': minifyCss(LOOK_PAPER_CSS),
  'look-notes': minifyCss(LOOK_NOTES_CSS),
}
