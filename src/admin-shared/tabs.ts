// THE ADMIN'S TAB STRIPS, as class strings both faces can read.
//
// Moved out of `admin/components/tabs.tsx` when the trash screen became a page (ADR 0054):
// the server renders that screen's kind strip now, and `src/admin` is excluded from the root
// TypeScript project so a server module cannot reach into it. A React `Tabs` component used to
// wrap these strings and re-export them; it left with React in ADR 0054's step 6.
//
// EVERYTHING IN THIS DIRECTORY IS FRAMEWORK-FREE: no React, no hono, no DOM. See the head of
// `kit.ts` for why that is the whole reason the directory exists.
//
// The rest of the original file's argument — why `lg` and `sm` are two different objects, and
// why a `place` is not a `choice` — travels with the strings it is about, below.

// The SEGMENTED family is made of components since 2026-10-03 (`component.ts`): a settings
// screen draws ninety-odd segments and a few dozen tracks, and every key also carries both of
// its faces as attributes for the island that presses it (`keyFaces`) — three copies of a
// 200-character list per key. The underlined `lg` strip is a handful of keys per page and is
// left spelled out. `no-scrollbar` and `scroll-fade-x` stay written out beside the names: the
// tour finds a track by them.
import { component } from '@/admin-shared/component'
import { NOTE_SIZE, TAP_TALL } from '@/admin-shared/scale'

export type TabSize = 'lg' | 'sm'

const TRACK = component('kit-track',
  'flex min-h-8 overflow-x-auto rounded-md border border-neutral-200 dark:border-neutral-800')

// The tracks and the item are exported separately because Analytics' range control is made of
// LINKS: the range lives in the URL, so it cannot be a `<Tabs>` with an `onChange`. It had its
// own copy of the markup, one padding step off and with a different hover, which is how one
// control came to look like two. A link-driven strip wears these and gets the real thing.
export const TAB_TRACK = 'flex w-full flex-wrap items-end gap-6 border-b border-neutral-200 dark:border-neutral-800'
// The underlined strip at the write pane's width: a 288px column cannot hold four words
// 24px apart, so the gap closes to 16 and the type steps down to the pane's own 13px.
// It does NOT wrap — four short words in every language, measured — because a strip that
// folds puts one word on a line of its own, which is what the segmented row used to do.
export const TAB_TRACK_DENSE = 'flex w-full items-end gap-4 border-b border-neutral-200 dark:border-neutral-800'
// `overflow-x-auto`, not `overflow-hidden`, and the difference is the whole control on a
// phone. A hidden box IS a scroll container — script and focus can move it — but the browser
// gives the user no way to: a finger cannot pan it. So a segmented strip wider than its box
// did not merely look cut off, its far end was UNREACHABLE by touch. Measured 2026-08-28 on
// the Settings tabs: at 390px five of the eight tabs were past the edge, AI and System among
// them, and the only way to reach them was a `?tab=` URL. `no-scrollbar` keeps the bar
// itself out of a 32px-tall control; the strip still clips visually at its rounded edge.
// `min-h-8` — 32px, the small control height, and the height of the whole segmented family.
// The strip sets the height of the sheet's tools row: it is the widest thing on that row and
// the first thing read on it, so the save key and the search field beside it are sized to IT
// rather than the other way round. A MINIMUM rather than a fixed height, because three call
// sites let the strip wrap and a fixed one would halve their rows; a single-line strip lands
// on 32 exactly, its items stretching to 30 inside the 1px edge.
// ONE TRACK, an outline on the sheet, since 2026-11-04. A chooser had a grey groove with a white
// key carved into it, and a place strip this outline with the stroke behind the word: two
// controls eight lines apart on one settings screen, the second still in the look the admin had
// just left.
export const SEGMENT_TRACK = `${TRACK} w-fit max-w-full no-scrollbar scroll-fade-x bg-neutral-50 dark:bg-neutral-950/40`
// The dense variant is full-width with growing items: five segments whose right edge lands
// on the pane's own edge instead of stopping short of it, which read as a gap left over.
export const SEGMENT_TRACK_DENSE = `${TRACK} w-full no-scrollbar scroll-fade-x bg-neutral-50 dark:bg-neutral-950/40`

/**
 * WHERE IN THE STRIP A KEY SITS, which is the only thing that decides its corners.
 *
 * ⚠️ A SEGMENTED KEY IS ROUNDED ONLY WHERE IT MEETS THE TRACK'S END. A key fills its track edge
 * to edge, so its focus ring has to follow the track's own curve at the two ends, and everywhere
 * else it butts against the key beside it, where a curve would cut a notch out of a straight run.
 */
export type TabEdge = 'start' | 'end' | 'both' | 'none'

/** The edge a key at `i` of `n` has. One strip of one key is both ends of itself. */
export const edgeAt = (i: number, n: number): TabEdge =>
  n <= 1 ? 'both' : i === 0 ? 'start' : i === n - 1 ? 'end' : 'none'

/** 5px is the track's 6px outer radius less its 1px border: the curve that border draws inside. */
const CORNERS: Record<TabEdge, string> = {
  start: 'rounded-l-[5px]',
  end: 'rounded-r-[5px]',
  both: 'rounded-[5px]',
  none: '',
}

/**
 * Both faces of ONE key, as attributes, for an island that presses it later.
 *
 * The islands read "on" and "off" off whichever keys were pressed at load and wrote that string
 * onto every key, and a key's corners are part of its class: picking the last key of a strip
 * gave it the first key's rounding, square against the track's end (2026-09-30). Each key now
 * carries its own two faces, and `pressKey` (admin/island/lib/press-key.ts) swaps between them.
 */
/** The segmented key's faces, as components; `tabItemClass` below explains each list. */
const SEGMENT = component('kit-seg', `py-1 ${NOTE_SIZE} font-medium transition`)
// The stroke behind the word the rail's current row wears (`.pen-stroke` in admin.css). Every
// strip wears it, tab or value: until 2026-11-04 a chosen value kept a white key carved into a
// groove, so one screen showed the admin's new mark and its old one eight lines apart.
const SEGMENT_HERE = component('kit-seg-here', 'pen-stroke text-neutral-950 dark:text-white')
/**
 * The chosen cell of the subscriber count row, the one chooser that is a block of two lines and
 * not a word: a stroke has no word to run behind there, so the cell stays pressed in, one grey
 * step down from the card.
 */
export const SEGMENT_ON_CARD = component('kit-seg-on-card',
  'bg-neutral-100 font-semibold text-neutral-950 shadow-[inset_0_2px_3px_rgba(0,0,0,.16)] dark:bg-neutral-800 dark:text-white dark:shadow-[inset_0_2px_3px_rgba(0,0,0,.55)]')
// The stroke again, fainter, on hover (`.kit-seg-idle:hover` in admin.css), so a key answers the
// pointer in the shape it would take if pressed and not in a grey box.
const SEGMENT_IDLE = component('kit-seg-idle',
  'hover:text-neutral-900 dark:hover:text-neutral-200')

export const keyFaces = (size: TabSize, dense: boolean, edge: TabEdge, extra = ''): string =>
  ` data-on="${tabItemClass(true, size, dense, edge)}${extra}" data-off="${tabItemClass(false, size, dense, edge)}${extra}"`

export const tabItemClass = (
  active: boolean,
  size: TabSize = 'lg',
  dense = false,
  edge: TabEdge = 'both',
): string =>
  size === 'lg'
    // `-mb-px` so the item's own 2px border sits ON the track's hairline rather than under it.
    // Dense is the write pane's size: 13px and a shorter stem, whole words never broken.
    ? `${TAP_TALL} -mb-px border-b-2 font-medium transition ${dense ? `min-w-6 whitespace-nowrap pb-1.5 ${NOTE_SIZE}` : 'pb-2.5 text-sm'} ${
        active
          // A marker stroke under the label, not a wash behind it: an underlined strip is
          // already a quiet control and a lime block in it would be the loudest thing on the
          // page. The ink stays on the word so the label is still read as a word.
          ? 'border-[var(--pen-edge)] text-neutral-900 dark:text-white'
          : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:border-neutral-300 hover:text-neutral-900 dark:hover:border-neutral-600 dark:hover:text-neutral-200'
      }`
    // `shrink-0 whitespace-nowrap` on the segmented variant, now that the track scrolls
    // rather than clipping. Without them a strip too wide for its box squeezes its items and
    // wraps their labels instead: measured at 390px, "Search & URLs" broke over three lines
    // and made a 32px control 130px tall. A scrolling strip should keep its items whole and
    // let the strip move — that is what scrolling is for.
    // `py-1` and not `py-1.5`: the track's own `min-h-8` is what sets the strip's height now,
    // and the padding only has to be small enough to let it. At `py-1.5` the item measured
    // 31.5 and pushed the track to 33.5 — a third height on a row that has a 32px key and a
    // 32px field on it.
    // ⚠️ THE CORNERS COME FROM THE POSITION, and the track carries no padding. The key had no
    // radius at all — a square block inside a 6px track — and the track held it 3px in from
    // every edge (2px of padding over a 1px border), so the chosen segment floated in the middle
    // of its own groove with four sharp corners. Rounding all four was the correction's first
    // cut and it was wrong in the other direction: a middle key butts against its neighbours,
    // and a curve there cuts a notch out of a straight run. See `TabEdge`.
    : `${CORNERS[edge]} ${dense ? 'grow px-2' : 'shrink-0 whitespace-nowrap px-3'} ${SEGMENT} ${
        active
          // INK on the highlighter, not the reading site's olive `--on-pen`: on a control the
          // olive read as grey and dull. `dark:text-white` for the reason set out on
          // SIDEBAR_NAV_ACTIVE: the dark pen is an olive, and near-black on it measures 3.8:1
          // against the 5.0 white gets.
          ? SEGMENT_HERE
          // `seg-off` and not a neutral step: the class holds the value, with the measurements
          // beside it in `admin.css`.
          // Written out beside its hover's name, because it is `admin.css`'s own class.
          : `seg-off ${SEGMENT_IDLE}`
      }`
