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
export const SIDEBAR_NAV =
  'relative flex h-10 w-full items-center rounded-lg px-3 text-left text-sm text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white'

export const SIDEBAR_NAV_ACTIVE =
  'bg-neutral-100 font-medium text-neutral-950 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.03)] dark:bg-neutral-800 dark:text-white dark:shadow-none'

// The rail's UTILITY register. The footer's rows (theme, cache, sign out) are CONTROLS,
// and for a while they wore SIDEBAR_NAV — four more destinations, one apparently a page
// named "Light". A control is smaller and quieter than a place, and it always draws its
// glyph: the glyph is what says "this does something" when the word alone reads as a name.
export const SIDEBAR_UTIL =
  'relative flex h-8 w-full items-center rounded-md px-3 text-left text-xs text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-50 dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-neutral-300'
