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

// THE RAIL'S FIVE STRINGS MOVED. `SIDEBAR_NAV`, `SIDEBAR_NAV_QUIET`, `SIDEBAR_NAV_ACTIVE`,
// `SIDEBAR_UTIL`, `SIDEBAR_ICON` and `SIDEBAR_GROUP` are in `@/admin-rail` since 2026-09-14,
// because the SERVER draws the rail now (ADR 0054) and cannot import anything under
// `src/admin` — that exclusion is what stops a server module reaching for `document`, and it
// is worth more than the convenience of leaving them here.
//
// Re-exported so the two files that are not the rail — `tabs.tsx`, which wears the same
// where-you-are mark, and the test that reads it — keep the import they had. The rule above
// still holds: a new header item reuses one of these, it does not hand-roll a class list.
export {
  SIDEBAR_NAV, SIDEBAR_NAV_QUIET, SIDEBAR_NAV_ACTIVE, SIDEBAR_UTIL, SIDEBAR_ICON, SIDEBAR_GROUP,
} from '@/admin-rail'
