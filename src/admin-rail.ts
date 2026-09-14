// THE RAIL, DESCRIBED ONCE — every row the admin's left column can hold, and where rows go.
//
// It sits at `src/` beside `icons.ts` and `brand-art.ts` for the reason those do: two faces
// wear it. The server renders the rail into HTML (`web/admin/rail.ts`) and the island runs it
// in the browser (`admin/island/rail.ts`), and a row that exists in one and not the other is a
// door that appears or disappears depending on which of them last drew it.
//
// NO FRAMEWORK, NO DOM, NO JSX. That is what makes it shareable at all: `src/admin` is
// excluded from the root TypeScript project precisely so a server module cannot reach for
// `document`, so anything both sides need has to live out here and touch neither. An icon is
// a NAME from `@/icons`, never a rendered element — the server wraps it in its own `<svg>`
// and the island wraps it in another, and both wrappers are already written.
//
// THREE SUBJECTS, in this order: what a row IS, where rows GO, and what a row WEARS. The
// third arrived from `admin/components/headerActions.ts` for the same reason as the other two
// — a class list drawn by one face and not the other is a rail that changes shape depending on
// who rendered it. What is NOT here is which rows a given install has stored, which is
// `content/nav-order.ts`, and it is not here because it is a SETTING rather than a fact about
// the product.
import type { IconName } from '@/icons'
import type { AdminStrings } from '@/i18n/admin-i18n'
import type { NavId } from '@/content/nav-order'
import type { NavOrder } from '@/types'

/**
 * A row the rail can draw.
 *
 * `href` is what separates the two kinds and there is no `kind` field saying so: a row with a
 * destination is a link, and a row without one does something. A flag beside the href would be
 * a second answer to a question the href already answers, and the two could disagree.
 */
export type RailRow = {
  id: NavId
  /** Where it goes. Absent on a control. */
  href?: string
  /** `_blank`, for the one row that leaves the admin. */
  external?: boolean
  label: string
  /** A name in the shared set, or null for a row that draws no glyph of its own. */
  icon: IconName | null
}

/**
 * Every row, by id, for one install and one language.
 *
 * A function rather than a constant because two of its answers are not fixed: the labels are
 * translated, and the assistant is only a row at all once a model is plugged in — see
 * `defaultOrder` for why that placement is computed and never stored.
 */
export function railRows(t: AdminStrings): Map<NavId, RailRow> {
  const rows: RailRow[] = [
    // --- destinations ---------------------------------------------------------------
    { id: 'home', href: '/admin', label: t.navHome, icon: 'home' },
    { id: 'assistant', href: '/admin/assistant', label: t.navAssistant, icon: 'penMark' },
    { id: 'write', href: '/admin/content', label: t.navWrite, icon: 'page' },
    { id: 'media', href: '/admin/media', label: t.navMedia, icon: 'image' },
    { id: 'newsletter', href: '/admin/newsletter', label: t.navNewsletter, icon: 'mail' },
    { id: 'analytics', href: '/admin/analytics', label: t.navAnalytics, icon: 'chart' },
    { id: 'comments', href: '/admin/comments', label: t.commentsNavTitle, icon: 'comment' },
    { id: 'trash', href: '/admin/trash', label: t.navTrash, icon: 'trash' },
    { id: 'settings', href: '/admin/settings', label: t.navSettings, icon: 'settings' },
    { id: 'log', href: '/admin/log', label: t.navLog, icon: 'log' },
    { id: 'help', href: '/admin/help', label: t.navHelp, icon: 'help' },
    // The one destination that leaves. A row like any other here, because the owner may put
    // it anywhere the others go.
    { id: 'viewBlog', href: '/', external: true, label: t.navViewBlog, icon: 'external' },

    // --- the group row, which names no page -------------------------------------------
    { id: 'more', label: t.navMore, icon: 'more' },

    // --- controls ----------------------------------------------------------------------
    // Their labels are the READING state: collapse says "Collapse" and flips to "Expand"
    // when the rail is shut, and the icon switch says "Hide icons" while they are on. The
    // other half of each pair is `railFlipLabels` below, so a face that has to swap a word
    // at runtime does not have to know which words those are.
    { id: 'collapse', label: t.navCollapse, icon: 'prev' },
    { id: 'theme', label: t.themeLabel, icon: null },
    { id: 'icons', label: t.navIconsHide, icon: 'glyphs' },
    { id: 'cache', label: t.clearCache, icon: 'cache' },
    { id: 'signout', label: t.signOut, icon: 'signOut' },

    // --- the two on the top row, which are chrome and never rows -----------------------
    // They are here because they can be switched OFF and `hidden` needs a name for them; no
    // list ever holds them. See `NAV_IDS` in `content/nav-order.ts`.
    { id: 'logo', href: '/admin', label: 'quireINK', icon: null },
    { id: 'search', label: t.paletteTitle, icon: 'search' },
  ]
  return new Map(rows.map((r) => [r.id, r]))
}

/**
 * The words a control swaps to when its state flips.
 *
 * Kept beside the rows rather than inside either face: the server paints one of each pair into
 * the HTML and the island swaps to the other on a click, so the two have to agree on what the
 * other word is, and a face that guessed would put "Collapse" on a rail that is already shut.
 */
export function railFlipLabels(t: AdminStrings): Record<string, string> {
  return {
    collapse: t.navExpand,
    icons: t.navIconsShow,
  }
}

/**
 * The rail as the PRODUCT has it, for a given install.
 *
 * Computed rather than a constant because one row moves on its own: the assistant rides at the
 * top only once a model is configured and sits in the group until then. A frozen default would
 * have to pick one of those, and the rail would stop reacting to the key being pasted.
 *
 * ⚠️ It appears in exactly one of the two lists, never both. A row in two places is a rail
 * that answers "where is it?" twice, differently.
 */
export function defaultOrder(aiConfigured: boolean): NavOrder {
  return {
    primary: ['home', ...(aiConfigured ? ['assistant'] : []), 'write', 'media', 'newsletter', 'more'],
    more: [...(aiConfigured ? [] : ['assistant']), 'analytics', 'comments', 'trash', 'settings', 'log', 'help', 'viewBlog'],
    footer: ['collapse', 'theme', 'icons', 'cache', 'signout'],
    // Nothing hidden: the wordmark and the search button are both on.
    hidden: [],
  }
}

// ----- where rows go ------------------------------------------------------------------

/** The three lists, in the order they are drawn — which is also the order a row steps through. */
export const ZONES = ['primary', 'more', 'footer'] as const
export type Zone = (typeof ZONES)[number]
export type Spot = { zone: Zone; index: number }

const clone = (o: NavOrder): NavOrder =>
  ({ primary: [...o.primary], more: [...o.more], footer: [...o.footer], hidden: [...o.hidden] })

/** Where an id currently sits, or null when it is not in the order at all. */
export function findSpot(order: NavOrder, id: string): Spot | null {
  for (const zone of ZONES) {
    const index = order[zone].indexOf(id)
    if (index !== -1) return { zone, index }
  }
  return null
}

/**
 * Move `id` so that it lands at `to`.
 *
 * The index is read AFTER the row is lifted out, which is the whole reason this is a function
 * rather than a splice at the call site: dragging a row down inside its own list, the target
 * index counts the row itself, and inserting at that number leaves it one place short of
 * where it was dropped. Every off-by-one in a drag list is this one.
 */
export function moveTo(order: NavOrder, id: string, to: Spot): NavOrder {
  const from = findSpot(order, id)
  if (!from) return order
  const next = clone(order)
  next[from.zone].splice(from.index, 1)
  const shift = from.zone === to.zone && from.index < to.index ? 1 : 0
  const at = Math.max(0, Math.min(to.index - shift, next[to.zone].length))
  next[to.zone].splice(at, 0, id)
  return next
}

/**
 * One step up or down, treating the three lists as ONE column.
 *
 * The steppers are the touch and keyboard route, so they have to reach everywhere a drag can,
 * and that includes across a zone boundary: stepping off the bottom of the main column puts
 * the row at the top of the group, and off the bottom of the group puts it in the footer.
 * Stopping at each boundary would leave rows that can be dragged into the footer but never
 * walked there.
 */
export function step(order: NavOrder, id: string, dir: -1 | 1): NavOrder {
  const from = findSpot(order, id)
  if (!from) return order
  const zoneAt = ZONES.indexOf(from.zone)
  const target = from.index + dir

  if (target >= 0 && target <= order[from.zone].length - 1) {
    return moveTo(order, id, { zone: from.zone, index: dir === 1 ? target + 1 : target })
  }
  const nextZone = ZONES[zoneAt + dir]
  if (!nextZone) return order
  return moveTo(order, id, { zone: nextZone, index: dir === 1 ? 0 : order[nextZone].length })
}

// ----- what the search key prints -----------------------------------------------------

/**
 * The palette's chord, and how to print it.
 *
 * Both are here for the reason the class strings are: the server draws the rail's search key
 * and cannot import anything under `src/admin`, where the shortcut table lives. `editorKeys.ts`
 * re-exports `printChord` so the editor's own sheet keeps one spelling of every chord.
 *
 * `mac` is a PARAMETER rather than a platform test inside the function, because the server has
 * no platform to test: it renders both spellings into the markup and the no-flash script picks
 * one before the first paint. A control that printed `Ctrl` for a second and then became `⌘`
 * is worse than either, since the chord is the whole reason the control is visible.
 */
export const PALETTE_CHORD = 'Mod-Shift-k'

export function printChord(chord: string, mac: boolean): string {
  const parts = chord.split('-')
  // The letter goes UP. Every keyboard prints its letters as capitals and every shortcut
  // sheet ever written follows: `⌘S`, not `⌘s`, which reads as a typo next to `⌘⇧H`.
  // ONE character only — a named key is not a letter, and `Enter` upper-cased to `ENTER`
  // shouted one row of the sheet at the reader.
  const printed = parts.map((part, i) => {
    if (part === 'Mod') return mac ? '⌘' : 'Ctrl'
    if (part === 'Shift') return mac ? '⇧' : 'Shift'
    if (part === 'Alt') return mac ? '⌥' : 'Alt'
    return i === parts.length - 1 && part.length === 1 ? part.toUpperCase() : part
  })
  return printed.join(mac ? '' : '+')
}

/**
 * The platform test, in one place.
 *
 * `navigator.platform` is deprecated but still the only thing that answers on every browser
 * this admin runs in; `userAgentData` is Chromium-only and undefined in Safari and Firefox,
 * which is half the people reading the shortcut sheet.
 */
export const onMac = (platform: string): boolean => /mac|iphone|ipad/i.test(platform)

// ----- what the browser remembers about the rail --------------------------------------

/**
 * The three device preferences, and the band that overrides one of them.
 *
 * DEVICE preferences, so they live in `localStorage` rather than in site settings — the same
 * reason the collapse state is not a setting. Nothing about the blog changes; this is how one
 * person's rail looks on one machine. (The row ORDER is the opposite and goes to the server:
 * it is a decision about the product, not about this screen.)
 *
 * Named here so the server's no-flash script and the island read one set of strings. They
 * were two copies of three string literals, and a typo in either is a preference that is
 * written and never read back.
 */
export const RAIL_KEYS = {
  /** The rail is shut to 72px of glyphs. */
  collapsed: 'quireink-admin-nav-collapsed',
  /** Glyphs are drawn BESIDE THE LABELS. Absent means on, so the test is against '0'. */
  icons: 'quireink-admin-nav-icons',
  /** "Everything else" stands open. */
  more: 'quireink-admin-nav-more',
} as const

/**
 * The band where the rail costs more than it returns: wide enough that a rail belongs on
 * screen at all, but not wide enough to spend 208px of it on words. An iPad in landscape and a
 * foldable opened and turned both land here.
 *
 * Measured on the Settings screen: at 1024 the full rail leaves the form 816px and the icon
 * rail leaves it 952. That 136px is the whole reason this exists.
 *
 * It forces the rail shut WITHOUT writing localStorage. The stored value is what the owner
 * chose, and a window that happens to be 1100px wide is not them changing their mind; leaving
 * the band puts their own choice back. Clicking the control inside the band still persists,
 * because that IS them changing their mind.
 */
export const NARROW = '(min-width: 64rem) and (max-width: 79.9375rem)'

/**
 * The rail's width at each state, published as `--admin-nav-w` so fixed chrome (the settings
 * save bar) can offset past it.
 *
 * THE SAME THREE NUMBERS the rail's own class list carries, and they have to stay that way: a
 * rail that is 16rem wide while the variable still says 13 puts that bar 48px into the rail it
 * is supposed to clear.
 */
export const RAIL_WIDTH = { shut: '4.5rem', open: '13rem', arranging: '16rem' } as const

// ----- what a row WEARS ---------------------------------------------------------------
//
// The class strings, here rather than in `admin/components/headerActions.ts`, because both
// faces draw the same rail and only one of them may import from `src/admin`. They are still
// the rule that file states: a new item on this rail reuses one of these, it never hand-rolls
// a class list, and that is what stops the column drifting into a set of near-identical rows.

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
/**
 * ⚠️ 15px/500, up from 14px/400 on 2026-09-07, and the rail is the one place in this admin
 * where a step up is worth its cost. It is the first thing read on every visit and it was
 * set at the same size as a table cell and a hint — measured 2026-09-07: four destinations
 * and a group, every row 40px of 14px grey, nothing on the column but text at one size.
 */
export const SIDEBAR_NAV_QUIET =
  'relative flex h-10 w-full items-center rounded-lg px-3 text-left text-[0.9375rem] font-medium text-neutral-500 transition-colors disabled:opacity-50 dark:text-neutral-400 active:translate-y-px active:duration-0 motion-reduce:active:translate-y-0 active:shadow-[inset_0_1.5px_2.5px_rgba(0,0,0,.15)] dark:active:shadow-[inset_0_1.5px_2.5px_rgba(0,0,0,.5)]'

// `neutral-200/70`, not `neutral-100`: the rail sits on the PAPER canvas (#f7f6f4), and
// neutral-100 (#f5f5f5) is two points away from it — a hover nobody can see. Measured the
// day the owner reported the rail had no hover at all.
// 120ms, written out rather than left to `--dur-fast` (150): a rail row is the control the
// pointer crosses most often on the way to somewhere else, and the shorter curve is what
// keeps a sweep down the column from lighting up behind the cursor like a trail.
const SIDEBAR_NAV_HOVER =
  'duration-[120ms] hover:bg-neutral-200/70 hover:text-neutral-900 hover:shadow-[inset_0_1.5px_2.5px_rgba(0,0,0,.12)] dark:hover:bg-neutral-800 dark:hover:text-white dark:hover:shadow-[inset_0_1.5px_2.5px_rgba(0,0,0,.4)]'

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
// The row is a KEY, so the current page is a key HELD DOWN — in the SAME full pen the
// active tab wears, carved with the SAME inset. It was a 30% wash for one evening, and the
// owner read the two marks side by side as two different inks; where-you-are is one ink at
// one strength wherever it appears, held down.
//
// The INK on it flips with the theme, and only the ink. In light the pen is #d5f856 and the
// mark is written in near-black, as a highlighter over a page is. In dark the pen is #7e7028
// — a highlighter seen under low light, not a lime slab — and near-black on it measured
// 3.8:1, under the 4.5 a label has to clear, which is why it read as grey smeared on
// mustard. White on that same olive measures 5.0:1.
// THE BAR AT THE RAIL'S EDGE, added 2026-09-07, and it is drawn OUTSIDE the key.
//
// The wash alone is a mark you have to be looking at the rail to read — a pale field on a pale
// column — so the row gains a 3px stroke in `--pen-edge`, the same ink an active TAB strokes
// under its label (`tabs.tsx`): where-you-are is one shape in two orientations rather than two
// ideas. It goes on the PAPER, in the rail's own 12px gutter, and that placement is measured
// rather than chosen: inside the key the stroke would be #c3e844 on #d5f856, four points of
// lightness apart and invisible in a screenshot; on the canvas at #f7f6f4 it is the second
// loudest thing in the column after the key itself.
//
// CENTRED IN THAT GUTTER, at 7.5px: the stroke is 3px, the gutter is 12, and 12 - 7.5 leaves
// it at 4.5 with 4.5 of paper each side. It was `-left-3`, which put it at 0 — hard against
// the window's own edge, where it read as a sliver bleeding off the glass rather than as a
// mark on the rail.
export const SIDEBAR_NAV_ACTIVE =
  'bg-[var(--pen)] font-medium text-neutral-950 dark:text-white shadow-[inset_0_2px_3px_rgba(0,0,0,.3),inset_0_-1px_0_rgba(255,255,255,.35)] before:absolute before:-left-[7.5px] before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-full before:bg-[var(--pen-edge)] before:content-[\'\']' 

// The rail's UTILITY register. The footer's rows (theme, cache, sign out) are CONTROLS,
// and for a while they wore SIDEBAR_NAV — four more destinations, one apparently a page
// named "Light". A control is smaller and quieter than a place, and it always draws its
// glyph: the glyph is what says "this does something" when the word alone reads as a name.
export const SIDEBAR_UTIL =
  'relative flex h-8 w-full items-center rounded-md px-3 text-left text-xs text-neutral-500 transition-colors hover:bg-neutral-200/70 hover:text-neutral-700 hover:shadow-[inset_0_1.5px_2.5px_rgba(0,0,0,.12)] disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-300 active:translate-y-px active:duration-0 motion-reduce:active:translate-y-0 active:shadow-[inset_0_1.5px_2.5px_rgba(0,0,0,.15)] dark:active:shadow-[inset_0_1.5px_2.5px_rgba(0,0,0,.5)]'

// THE UTILITY STRIP at the rail's foot: one row of icon keys, each naming itself in a tooltip.
//
// It was six full-width labelled rows — Collapse sidebar, Rearrange sidebar, Light, Hide icons,
// Clear cache, Sign out — under the four destinations, in a column where a full-width row with
// a word in it is what a PLACE looks like. "Light" was the clearest symptom: read down the
// rail it is a page you can go to. A control that fits in its own glyph should be one, and a
// strip of them says "these are the tool's own switches" by being a different shape entirely.
export const SIDEBAR_ICON =
  'relative grid h-8 w-8 shrink-0 place-items-center rounded-md text-neutral-500 transition-colors duration-[120ms] hover:bg-neutral-200/70 hover:text-neutral-900 disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white active:translate-y-px active:duration-0 motion-reduce:active:translate-y-0'

// The group row that folds the second half of the rail out. An EYEBROW, not a destination:
// it names no page, and at the destinations' 15px/500 it read as a fifth place to go.
export const SIDEBAR_GROUP =
  'relative flex h-8 w-full items-center rounded-lg px-3 text-left text-xs font-medium uppercase tracking-[0.04em] text-neutral-500 transition-colors duration-[120ms] hover:bg-neutral-200/70 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200'
