// The admin's two SCALES: every size the tool sets in type, and every gap it sets in space.
//
// Split out of `kit.tsx` on 2026-08-15, and the seam is not the 400-line cap that forced it.
// The kit is the SURFACES — what a card is, what a table is, what a tab strip is. This is the
// MEASUREMENTS those surfaces are built from. A component asks "what am I"; a scale asks "how
// big, and how far apart", and the answer has to be the same everywhere or there is no scale.
//
// (It was briefly `type.ts` carrying only the type half, with the gaps left behind in the kit.
// That is the filing mistake `docs/conventions/` was reorganised to fix — a rule filed by where
// its control sits rather than by what it governs.)
//
// ── Why there is a scale at all ──────────────────────────────────────────────────────────
//
// There was not one. Measured on the running admin before this file existed: a page title at
// 1.65rem/600, a card title at 15px/600, a label at 14px/500, a hint at 12px/20px and a stat
// figure at 1.65rem/600 — five sizes with no ratio between any two of them, and the page title
// the SAME SIZE as the number in a stat tile. A screen therefore had no largest thing and no
// smallest thing; it had five middling ones. That is what reads as unconsidered, and it is
// what the owner meant by "typography quá tệ" on 2026-08-15.
//
// So: a ratio of about 1.25, four steps, and each step used for exactly one kind of thing.
//
//   30px  FIGURE   a number that IS the content — a stat tile, and nothing else
//   22px  TITLE    the page's own name, once per screen
//   14px  SECTION  a card's title, and the label on a setting
//   13px  NOTE     the sentence explaining a setting
//   12px  META     the machine's smallest print: table heads, counts, timestamps
//
// ⚠️ The page title went DOWN, from 26.4px to 22px, and that is the deliberate half. A tool's
// page title is a location, not a headline; the reading site's headlines are the ones that
// carry a voice. Making the title quieter is what lets the tile figure be the loudest thing
// on a dashboard, which is correct, because the figure is the thing the owner came to read.
//
// ── One face ─────────────────────────────────────────────────────────────────────────────
//
// The admin is set in Inter and nothing else, at the owner's instruction on 2026-08-15:
// *"admin chỉ xài 1 font thôi, inter"*. The reading face is now confined to the EDITOR, which
// is WYSIWYG and must write in the face it publishes in — the writing surface and the title
// field, and the font picker's own preview tiles. `admin.css` carries the reasoning.
//
// So the ranking here is done entirely by SIZE and WEIGHT. That is the harder way to build a
// hierarchy and the right one for a tool: a second typeface asks the reader to notice a
// difference in KIND, which is a thing a reader has time for on a page and does not on a form.

/**
 * The reading face — the EDITOR ONLY, and there are exactly two holders.
 *
 * `PostForm`'s title field, because it is the published headline being typed, and
 * `TypographyFields`' specimen tiles, which paint themselves in the family they offer. Every
 * other surface in the admin is Inter. Adding a third holder means re-opening the 2026-08-15
 * decision, not reaching for a class.
 */
export const READING = 'reading-font'

/**
 * A page's own name. Once per screen, placed by `PageHeader`.
 *
 * `font-medium`, not `font-semibold`: at 22px on paper, 600 is a shout and 500 is a statement.
 * The tracking is negative because Inter at this size opens up without it.
 */
export const TITLE = 'text-[1.375rem] font-medium leading-tight tracking-[-0.014em] text-neutral-900 dark:text-neutral-50'

/** A card's title, and any heading inside a page. One step above the body it introduces. */
export const SECTION = 'text-sm font-semibold tracking-[-0.006em] text-neutral-900 dark:text-neutral-100'

/** The label on one setting. Same size as SECTION, one weight down — a peer, not a heading. */
export const SETTING_LABEL = 'block text-sm font-medium text-neutral-800 dark:text-neutral-200'

/**
 * The hint's TYPE — face, size, leading and colour — with no spacing in it.
 *
 * 13px at 1.55, up from 12px at 20px (1.67 → the same air, one step larger). The hints are the
 * only sentences in the admin and they were the SMALLEST text on every screen, which is the
 * wrong way round: a label can afford to be small, the sentence explaining it cannot. Since
 * 2026-08-15 the size and the leading are ALL of the distinction — this used to also change
 * face, and now nothing in the admin does.
 *
 * Split from `NOTE` because thirty-eight screens hand-typed this list rather than import it,
 * and what stopped them was the `mt-1`: a hint standing alone in a `space-y` stack does not
 * want a top margin, so each re-typed the other classes to be rid of one. They drifted, and
 * TWENTY-FIVE carried `text-neutral-500 dark:text-neutral-400` — lighter than this in light
 * mode and darker in dark mode, so they were the hardest hints to read in both.
 */
export const NOTE_TEXT = 'text-[0.8125rem] leading-[1.55] text-neutral-500 dark:text-neutral-400'

/** A hint directly under the label it explains. `Setting` and `ui/Input` place this one. */
export const NOTE = `${NOTE_TEXT} mt-1.5`

/** The machine's smallest print: a table head, a count, a timestamp, a filename. */
export const META = 'text-xs text-neutral-500 dark:text-neutral-400'

/**
 * The same small print, one notch darker, for text that sits on the CANVAS rather than
 * inside a card.
 *
 * Not a second opinion about the voice — the same voice, on a different ground. The canvas
 * is tinted (#f7f6f4, the paper this admin is printed on) and a card is white, and that tint
 * is worth 0.2 of a contrast ratio: `META` measures 4.61:1 on a card and 4.39:1 on the
 * canvas, either side of the 4.5:1 a 12px line has to clear. Four places sat on the wrong
 * side of it — the version chip, the storage line under the dashboard, Export CSV, the SMTP
 * link — and every one of them was correct except for what happened to be behind it.
 * Dark mode needs no notch: there the canvas is DARKER than the cards, so it helps.
 */
export const META_ON_CANVAS = 'text-xs text-neutral-600 dark:text-neutral-400'

/**
 * A number that is itself the content, in a stat tile.
 *
 * `tabular-nums` so a column of figures lines up, and so a figure does not re-flow as it
 * changes. The loudest thing the admin sets, by one step over the page title.
 */
export const FIGURE = 'text-[1.875rem] font-medium leading-none tracking-[-0.02em] tabular-nums'

// --- The vertical scale ---------------------------------------------------------------------
//
//   40  BAND     one band of a page to the next, and the header to the first of them
//   24  GROUP    two cards, or a card and the sentence introducing it
//   20  SETTING  two settings inside one card (`SETTING_GAP`, below)
//   16  CLUSTER  two controls doing one job — a search field and the filter beside it
//
// The kit used to name only the top two and let every page invent the rest, so the rhythm it
// promised stopped at the band boundary. Measured on Settings at 1440px: header→search 32,
// search→tabs 12, tabs→intro 12, intro→cards 24 — four numbers between five stacked things,
// and only the 24 was ever a step the kit had defined. The others were `mb-8`, `mb-3`, `mb-3`
// typed into the screen. (The older drift, on one Overview column: 12 / 16 / 20 / 28.)
//
// BAND and GROUP both went UP with the flat sheet, for the reason the sheet went flat: with no
// shadow and barely any fill against the paper, the space is the only thing left saying where
// one band ends. 28 was enough when every box was outlined and lifted; it is not now.
export const SECTION_GAP = 'space-y-10'
export const CARD_GAP = 'gap-6'
export const CARD_STACK = 'space-y-6'
export const HEADER_GAP = 'mb-10'
export const GROUP_GAP = 'mb-6'
export const CLUSTER_GAP = 'mb-4'

/** The gap between two settings inside one card. One number, so no card invents its own. */
export const SETTING_GAP = 'space-y-5'
