// Shared styling for EVERY admin header item — the left nav links AND the
// right-side controls (theme, clear-cache, sign-out). They all import this ONE
// string so the bar reads as a single, uniform set of text links (no item looks
// like a button) and they can never drift in size/colour again.
//
// RULE: a new header item must reuse this. Do NOT hand-roll per-item classes.

// Plain text link, muted → full-contrast on hover. `disabled:opacity-50` covers
// busy states (clear-cache). Used inline on desktop and stacked in the mobile menu.
// FIXED HEIGHT (h-9) + items-center: every item is an identical-height box, so the
// whole row aligns on one line no matter the text/size — this is what stops the
// recurring "menu items not lined up" drift.
export const ADMIN_NAV =
  'inline-flex h-9 items-center text-sm text-neutral-600 transition-colors hover:text-neutral-900 disabled:opacity-50 dark:text-neutral-300 dark:hover:text-white'

// Vertical sidebar variant: a full-width h-9 row with hover surface. EVERY sidebar
// item (nav links AND the theme/palette/cache/sign-out controls) shares this ONE
// string so the column reads as a single uniform set and can't drift — same rule as
// ADMIN_NAV, just laid out as rows. Active links add `SIDEBAR_NAV_ACTIVE`.
// Split in two so the ACTIVE row can be built without the hover half, rather than by trying
// to out-rank it. Both are `hover:bg-*`, and which one lands last in the built stylesheet is
// decided by Tailwind's own ordering, not by the order the classes appear on the element:
// measured, `hover:bg-neutral-100` was emitted 418 bytes AFTER the highlighter, so pointing
// at the page you are already on repainted it grey. A rule you cannot see the order of is a
// rule you should not be relying on.
export const SIDEBAR_NAV_QUIET =
  'relative flex h-10 w-full items-center rounded-lg px-3 text-left text-sm text-neutral-500 transition-colors disabled:opacity-50 dark:text-neutral-400'

const SIDEBAR_NAV_HOVER =
  'hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white'

export const SIDEBAR_NAV = `${SIDEBAR_NAV_QUIET} ${SIDEBAR_NAV_HOVER}`

// The rail's answer to "which page am I on", in highlighter.
//
// It was `bg-neutral-100` — a grey one step off the canvas, no answer at all — and then a
// SOLID pen pill, which answered too loudly: a filled block of the brightest ink on the
// screen, sitting in the rail on every single page. Now it is the mark the rest of the
// product already makes: a short bar in the pen's edge tone at the row's leading edge, over
// a wash of the pen diluted into the paper. Same ink, same meaning as an active TAB
// (`tabs.tsx`) — the highlighter marks the place you are in, never the value you chose —
// but a run of a marker, not a slab of it.
//
// The bar is drawn with `before:` because the row string is one class list on a link, and
// `SIDEBAR_NAV_QUIET` already carries the `relative` it needs. It stays visible on the
// collapsed icon rail, where the wash alone would be a faint square.
export const SIDEBAR_NAV_ACTIVE =
  "bg-[color-mix(in_srgb,var(--pen)_26%,transparent)] font-medium text-neutral-900 dark:text-white before:absolute before:bottom-1.5 before:left-0 before:top-1.5 before:w-[3px] before:rounded-full before:bg-[var(--pen-edge)] before:content-['']"

// The rail's UTILITY register. The footer's rows (theme, cache, sign out) are CONTROLS,
// and for a while they wore SIDEBAR_NAV — four more destinations, one apparently a page
// named "Light". A control is smaller and quieter than a place, and it always draws its
// glyph: the glyph is what says "this does something" when the word alone reads as a name.
export const SIDEBAR_UTIL =
  'relative flex h-8 w-full items-center rounded-md px-3 text-left text-xs text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-300'
