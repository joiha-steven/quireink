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

export type TabSize = 'lg' | 'sm'

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
// The track is carved — it CONTAINS the keys, so it wears the groove (`bg` one step off the
// card plus a 1px inner shadow); the active key is HELD DOWN in it. Ink-on-ink shading is
// invisible, so the pressed key also catches light on its lower inside edge.
// `min-h-8` — 32px, the small control height, and the height of the whole segmented family.
// The strip sets the height of the sheet's tools row: it is the widest thing on that row and
// the first thing read on it, so the save key and the search field beside it are sized to IT
// rather than the other way round. A MINIMUM rather than a fixed height, because three call
// sites let the strip wrap and a fixed one would halve their rows; a single-line strip lands
// on 32 exactly, its items stretching to 30 inside the 1px edge.
// ⚠️ TWO TRACKS, AND THE ROLE PICKS ONE. A groove is a CHOOSER's furniture: a value control
// that needs its chosen key to sit visibly lower than its neighbours. A `place` strip is
// NAVIGATION — the settings tabs, the trash's kinds — and it is the page's own first row;
// dressing it as a heavy grey control makes the top of every settings screen read as a
// widget rather than as a set of sections. Both were the same string for a few hours on
// 2026-09-07 and the settings tabs came out looking like a machine part.
//
// THE GROOVE, `neutral-200`, for a chooser. It was `neutral-50` — one point off the card it
// sits on, so the strip had no edges of its own and the chosen key had to be drawn DARKER
// than its own track to be seen. That inverts the object: a pressed key is not darker than
// the panel it is set into, it is the panel's face pushed down. With a real groove the key
// can be white and carved, which is what a segmented control on a desk looks like.
export const SEGMENT_TRACK = 'flex min-h-8 w-fit max-w-full overflow-x-auto no-scrollbar rounded-md border border-neutral-200 bg-neutral-200 shadow-[inset_0_1px_2px_rgba(0,0,0,.09)] dark:border-neutral-800 dark:bg-neutral-950/60 dark:shadow-[inset_0_1px_2px_rgba(0,0,0,.5)]'
/** The quiet track a PLACE strip wears: an outline on the sheet, not a control set into it. */
export const SEGMENT_TRACK_PLACE = 'flex min-h-8 w-fit max-w-full overflow-x-auto no-scrollbar rounded-md border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950/40'
// The dense variant is full-width with growing items: five segments whose right edge lands
// on the pane's own edge instead of stopping short of it, which read as a gap left over.
export const SEGMENT_TRACK_DENSE = 'flex min-h-8 w-full overflow-x-auto no-scrollbar rounded-md border border-neutral-200 bg-neutral-200 shadow-[inset_0_1px_2px_rgba(0,0,0,.09)] dark:border-neutral-800 dark:bg-neutral-950/60 dark:shadow-[inset_0_1px_2px_rgba(0,0,0,.5)]'
/** Full-width and quiet: the write pane's scope strip is a place strip that fills its column. */
export const SEGMENT_TRACK_DENSE_PLACE = 'flex min-h-8 w-full overflow-x-auto no-scrollbar rounded-md border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950/40'

/**
 * What an active item MEANS, which turns out to be two different things wearing one costume.
 *
 * A `place` is a tab you navigated to: Site, Layout, Reading. A `choice` is a value you set:
 * English, 3:2, framed. They had the identical black pill, and on the Settings screen that
 * put "Site" — the section you are IN — beside "English" — a field's current value — in the
 * same ink, the same size, the same shape, eight lines apart. Nothing said which of the two
 * was answering "where am I". That sameness is most of what reads as machine-made: a screen
 * where everything is the same rectangle has told you nothing by the time you have looked
 * at all of it.
 *
 * So the highlighter marks WHERE YOU ARE and nothing else. It is the meaning the ink already
 * has on paper — the line you ran a marker over to come back to — and it is the reason this
 * is not decoration: a second colour that means one thing is a signal, and a palette is not.
 * A value you picked is not a place, so it takes the sunken paper key.
 *
 * The seam is the `Tabs` component below, which is the only thing in the admin that renders
 * navigation; the ten call sites that build a chooser out of `tabItemClass` directly are all
 * choices, and get the default.
 */
export type TabRole = 'place' | 'choice'

/**
 * WHERE IN THE STRIP A KEY SITS, which is the only thing that decides its corners.
 *
 * ⚠️ A SEGMENTED KEY IS ROUNDED ONLY WHERE IT MEETS THE TRACK'S END. The chosen key fills its
 * track edge to edge, so at the two ends its corner has to follow the track's own curve — and
 * everywhere else it butts against the key beside it, where a curve would cut a notch out of a
 * straight run. Rounding all four corners of a middle key was the first cut and it read as a
 * pill floating in a groove rather than as one segment of a strip.
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

export const tabItemClass = (
  active: boolean,
  size: TabSize = 'lg',
  dense = false,
  role: TabRole = 'choice',
  edge: TabEdge = 'both',
): string =>
  size === 'lg'
    // `-mb-px` so the item's own 2px border sits ON the track's hairline rather than under it.
    // Dense is the write pane's size: 13px and a shorter stem, whole words never broken.
    ? `-mb-px border-b-2 font-medium transition ${dense ? 'whitespace-nowrap pb-1.5 text-[0.8125rem]' : 'pb-2.5 text-sm'} ${
        active
          // A marker stroke under the label, not a wash behind it: an underlined strip is
          // already a quiet control and a lime block in it would be the loudest thing on the
          // page. The ink stays on the word so the label is still read as a word.
          ? role === 'place'
            ? 'border-[var(--pen-edge)] text-neutral-900 dark:text-white'
            : 'border-neutral-900 text-neutral-900 dark:border-white dark:text-white'
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
    : `${CORNERS[edge]} ${dense ? 'grow px-2' : 'shrink-0 whitespace-nowrap px-3'} py-1 text-[0.8125rem] font-medium transition ${
        active
          // INK on the highlighter, not the reading site's olive `--on-pen`: on a control
          // the olive read as grey and dull, and the owner called it. A mark in running
          // text keeps the olive; a pressed key wants the full contrast.
          //
          // A latched key: the active segment is held DOWN, so it carries the carved-in
          // shadow every pressed control wears. It is WHITE and the track is the groove,
          // reversed from what it was: the key used to be `neutral-200` — darker than its own
          // `neutral-50` track — because a white key does vanish on a white card, and that
          // argument stopped being true the day the track became a real groove. Measured on
          // the rendered control: the chosen label reads 4.2:1 against an unchosen one, which
          // is what tells them apart; the two GROUNDS are 1.3:1 and never were the signal.
          ? role === 'place'
            // `dark:text-white` for the reason set out on SIDEBAR_NAV_ACTIVE: the dark pen is
            // an olive, and near-black on it measures 3.8:1 against the 5.0 white gets.
            ? 'bg-[var(--pen)] text-neutral-950 dark:text-white shadow-[inset_0_2px_3px_rgba(0,0,0,.3),inset_0_-1px_0_rgba(255,255,255,.35)]'
            : 'bg-white font-semibold text-neutral-950 shadow-[inset_0_2px_3px_rgba(0,0,0,.16)] dark:bg-neutral-800 dark:text-white dark:shadow-[inset_0_2px_3px_rgba(0,0,0,.55)]'
          // `600` and not the `500` the underlined strip uses, because this one sits on a
          // GROOVE. The track is neutral-200, and 500 on it measures 3.76:1 where AA asks 4.5
          // for a 13px label -- measured on the rendered control, 2026-09-16. 600 reads 6.2:1
          // there. Dark is unchanged: 400 on the dark groove was already 6.94:1.
          : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-300/60 hover:text-neutral-900 dark:hover:bg-neutral-800/60 dark:hover:text-neutral-200'
      }`
