// The admin's two SCALES: every size it sets in type, every gap it sets in space.
//
// The kit is the SURFACES — what a card is, what a table is. This is the MEASUREMENTS they
// are built from, and the answer has to be the same everywhere or there is no scale.
//
// There was not one. Measured before this file existed: a page title at 1.65rem/600, a card
// title at 15px/600, a label at 14px/500, a hint at 12px/20px and a stat figure at
// 1.65rem/600 — five sizes with no ratio between any two, and the page title the SAME SIZE
// as the number in a stat tile. No largest thing and no smallest thing; five middling ones.
//
// So: a ratio of about 1.25, and each step used for exactly one kind of thing.
//
//   30px  FIGURE         a number that IS the content — a stat tile, nothing else
//   22px  TITLE          the page's own name, once per screen
//   15px  SECTION        a card's title
//   14px  SETTING_LABEL  the label on one setting
//   13px  NOTE           the sentence explaining a setting
//   12px  META           table heads, counts, timestamps
//
// ⚠️ The page title went DOWN, 26.4px to 22px, deliberately: a tool's page title is a
// location, not a headline, and a quieter title is what lets the tile figure be the loudest
// thing on a dashboard — the figure is what the owner came to read.
//
// One face, Inter, since 2026-08-15; the reading face is confined to the EDITOR, which is
// WYSIWYG. So ranking here is done entirely by SIZE and WEIGHT.

/**
 * The reading face — the EDITOR ONLY, and exactly two holders: `PostForm`'s title field (the
 * published headline being typed) and `TypographyFields`' specimen tiles. A third means
 * re-opening the 2026-08-15 decision, not reaching for a class.
 */
export const READING = 'reading-font'

/**
 * A page's own name. Once per screen, placed by `PageHeader`. `font-medium`, not
 * `font-semibold`: at 22px, 600 is a shout and 500 is a statement.
 */
export const TITLE = 'text-[1.375rem] font-medium leading-tight tracking-[-0.014em] text-neutral-900 dark:text-neutral-50'

/**
 * A card's title. One step above the body it introduces.
 *
 * ⚠️ 15px, and the step is the point. `Card panel` — every card on every settings tab —
 * hard-typed `text-[13px]` instead of importing this, so the hierarchy ran BACKWARDS:
 * heading 13px/600 above labels at 14px/500 above notes at 13px/400. 15 / 14 / 13 at
 * 600 / 500 / 400 now, each a step down in both.
 */
export const SECTION = 'text-[0.9375rem] font-semibold tracking-[-0.008em] text-neutral-900 dark:text-neutral-100'

/**
 * A settings GROUP's title — 17px, one step ABOVE `SECTION`, worn only by `SettingsCard`.
 *
 * The fix above got the ORDER right and left the DISTANCE too short. 15/600 over 14/500 is one
 * point of size and one weight step, and the owner read the settings screen on 2026-09-04 and
 * could not pick the group titles out of it: "Bố cục & menu" and the "Trang chủ" label under it
 * were the same object to the eye. Nothing was broken — the hierarchy was simply too quiet to
 * do its job on a screen that holds thirty-seven of these in two columns.
 *
 * NOT a change to `SECTION` itself, and that is deliberate: a settings group is a different
 * thing from a dashboard tile or a Help card, which stand alone rather than being scanned down
 * a column. Widening the step everywhere would have been a redesign of the admin, asked for by
 * nobody.
 */
export const GROUP_TITLE = 'text-[1.0625rem] font-semibold tracking-[-0.008em] text-neutral-900 dark:text-neutral-100'

/** The label on one setting. One step under SECTION — a peer of the other labels, not a heading. */
export const SETTING_LABEL = 'block text-sm font-medium text-neutral-800 dark:text-neutral-200'

/**
 * The hint's TYPE, with no spacing in it. Split from `NOTE` so a hint standing alone in a
 * `space-y` stack need not re-type the list to be rid of one `mt-1` — thirty-eight screens
 * did, and twenty-five drifted to a lighter grey.
 *
 * ⚠️ ITALIC is the only axis left for "quieter". Dimmer is not available: measured `#737373`
 * on white is **4.74:1** against the 4.5:1 a 13px line must clear, and the next neutral step
 * is **2.58:1**. Size cannot give way either — these were once the smallest text on screen,
 * which was the wrong way round. Slant costs no contrast and reads as an aside.
 */
const NOTE_SHAPE = 'text-[0.8125rem] italic leading-[1.55]'
/**
 * `admin-note` is a HANDLE, not a style — it declares nothing and exists so one CSS rule in
 * `admin.css` can put every explanation on the settings screen out of sight at once.
 *
 * It rides on the token because the alternative was marking up the call sites: notes are
 * printed both by `Setting`/`ui/Input` and, about twenty times, as a loose paragraph at the
 * top of a card. Two dozen files would each have had to remember an attribute, and the one
 * that forgot would have left a stray sentence hanging on an otherwise quiet screen with
 * nothing to say why.
 *
 * ⚠️ On `NOTE_TEXT` and NOT on `NOTE_SHAPE`, so `NOTE_ALERT` does not inherit it. An alert is
 * a hint the owner must ACT on before the thing it describes will work — a refused key, a
 * connection that did not answer. Hiding one to tidy the screen would hide the reason
 * something is broken.
 */
export const NOTE_TEXT = `${NOTE_SHAPE} admin-note text-neutral-500 dark:text-neutral-400`

/**
 * The same note, in the admin's one "look at this" ink: a hint the owner has to act on
 * before the thing it describes will work — a key the provider refused, a connection that
 * did not answer. NOT for a destroyed thing, which is red's job and red's alone.
 *
 * It exists because the colour has to be swapped rather than added. A caller writing
 * `${NOTE_TEXT} text-amber-700` ships two colour classes in one list, and which one wins is
 * decided by the order they happen to sit in the stylesheet — so the shape is shared above
 * and each ink states its own.
 */
export const NOTE_ALERT = `${NOTE_SHAPE} text-amber-700 dark:text-amber-500`

/** A hint directly under the label it explains. `Setting` and `ui/Input` place this one. */
export const NOTE = `${NOTE_TEXT} mt-1.5`

/** The machine's smallest print: a table head, a count, a timestamp, a filename. */
export const META = 'text-xs text-neutral-500 dark:text-neutral-400'

/**
 * The same small print, one notch darker, for text on the CANVAS rather than in a card.
 * The tint (#f7f6f4) is worth 0.2 of a ratio: `META` measures 4.61:1 on a card and 4.39:1 on
 * the canvas, either side of the 4.5:1 a 12px line must clear. Dark mode needs no notch.
 */
export const META_ON_CANVAS = 'text-xs text-neutral-600 dark:text-neutral-400'

/**
 * A number that IS the content, in a stat tile. `tabular-nums` so a column lines up and a
 * figure does not re-flow as it changes. The loudest thing the admin sets.
 */
export const FIGURE = 'text-[1.875rem] font-medium leading-none tracking-[-0.02em] tabular-nums'

// --- The vertical scale ---------------------------------------------------------------------
//
//   40  BAND     one band of a page to the next, and the header to the first of them
//   24  GROUP    two cards, or a card and the sentence introducing it
//   20  SETTING  two settings inside one card (`SETTING_GAP`, below)
//   16  CLUSTER  two controls doing one job — a search field and the filter beside it
//
// The kit named only the top two and let every page invent the rest. Measured on Settings at
// 1440px: header→search 32, search→tabs 12, tabs→intro 12, intro→cards 24 — four numbers
// between five stacked things, and only the 24 was ever defined.
//
// BAND and GROUP went UP with the flat sheet: with no shadow and barely any fill, the space
// is the only thing left saying where one band ends.
export const SECTION_GAP = 'space-y-10'
export const CARD_GAP = 'gap-6'
export const CARD_STACK = 'space-y-6'
export const HEADER_GAP = 'mb-10'
export const GROUP_GAP = 'mb-6'
export const CLUSTER_GAP = 'mb-4'

/** The gap between two settings inside one card. One number, so no card invents its own. */
export const SETTING_GAP = 'space-y-5'
