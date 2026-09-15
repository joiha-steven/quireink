// Settings → Appearance: HOW THE SITE LOOKS. What kind of publication it is, what shape
// everything is, what colour, what face — and the owner's own CSS when the knobs run out.
//
// ⚠️ THREE CARDS LEFT ON 2026-09-07 (ADR 0041), and the measurement is why. This tab carried
// 137 controls over 2,825px while five other tabs sat within 31px of 1,236 — 36% of every
// control on the settings screen behind one word. Tables and the pen went to Posts, because
// both draw INSIDE a post's body and neither is a palette decision; text rendering, motion, the
// key sounds and the autosave interval went to Account, because they describe the TOOL and this
// tab is about what a reader sees.
//
// ADR 0054: the server draws it. The palette editor is `settings-appearance-theme.ts` and the
// type scale is `settings-appearance-type.ts` — three files because one would be past the
// 400-line cap before the first colour field, not because the three are three subjects.
//
// ⚠️ THREE KEYS HERE CANNOT BE SAID IN A DOTTED PATH, and each rides a hidden input the island
// writes: `enabledPalettes` (a list), `customFont` (a family and a variable-length array of
// faces) and `themePreset` (no control of its own). `settings-form.ts` has to learn `data-k-list`
// and `data-k-json` before any of the three saves — see the notes at each one.
//
// Save-all: every key here goes through the sheet's one Save key.
import type { AdminStrings } from '@/i18n/admin-i18n'
import type { SiteSettings } from '@/types'
import type { ThemePreset } from '@/content/themes'
import { CHROME_FONTS, FONT_PRESETS, FONT_WEIGHTS } from '@/content/themes'
import { PROMISED_SELECTORS, PROMISED_VARS } from '@/content/appearance-contract'
import { formatCount } from '@/i18n/format'
import { escapeAttr, escapeHtml } from '@/utils'
import { braceBalance } from '@/admin-shared/css-brace'
import { SHEET_TOOL, buttonClass } from '@/admin-shared/kit'
import { NOTE_TEXT, SETTING_GAP, UTIL } from '@/admin-shared/scale'
import { panelCard, settingRow } from '@/web/admin/fields'
import { PANEL } from '@/web/admin/fields-box'
import { choice } from '@/web/admin/fields-pick'
import { COL, GRID } from '@/web/admin/screens/settings-shell'
import { palettes } from '@/web/admin/screens/settings-appearance-theme'
import { typeResetKey, typeScale } from '@/web/admin/screens/settings-appearance-type'

/** What this tab needs that is not a setting: the six palettes it offers to edit. */
export type AppearanceTabView = {
  presets: ThemePreset[]
}

// --- Looks like, and shape ------------------------------------------------------------------

/**
 * WHAT KIND OF PUBLICATION THIS IS, before what shape it is and what colour: the look decides
 * the furniture round the words, and everything else on this tab decides the words.
 *
 * It was a boolean called "IDE chrome", filed under Account beside anti-aliasing and the
 * autosave interval — a public-site decision living in the card that describes this admin, and
 * the coarsest look decision the product has, filed as a rendering detail.
 *
 * NO LABEL ON THE STRIP: the card's own title is `t.lookLabel` and so was the control's, which
 * is the exact drift `fields.ts` exists to stop — one name, said twice, 40px apart.
 */
const look = (t: AdminStrings, s: SiteSettings): string =>
  choice({
    k: 'look', note: t.lookDesc, value: s.look,
    options: [
      ['plain', t.lookPlain], ['code', t.lookCode], ['paper', t.lookPaper], ['notes', t.lookNotes],
    ],
  })

/**
 * Density, corners and headline weight — the three knobs that change SHAPE rather than colour.
 *
 * Measured across three live blogs on 2026-08-29: with 84 colour fields and 27 typography
 * numbers available to them, the entire visible difference between the three was two colour
 * values nobody can see. Shape is what an eye uses to tell two blogs apart, and until this card
 * there was no way to change any of it.
 *
 * ⚠️ `normal` / `soft` / `normal` is TODAY, exactly — not a middle option chosen to look tidy.
 * `content/settings-shape.ts` holds the numbers and the reason each one is what it is.
 */
function shape(t: AdminStrings, s: SiteSettings): string {
  const a = s.shape
  return `<div class="${SETTING_GAP}">`
    + `<p class="${NOTE_TEXT}">${escapeHtml(t.shapeHint)}</p>`
    + choice({
      k: 'shape.density', label: t.shapeDensity, note: t.shapeDensityHint, value: a.density,
      options: [['compact', t.shapeCompact], ['normal', t.shapeNormal], ['relaxed', t.shapeRelaxed]],
    })
    + choice({
      k: 'shape.radius', label: t.shapeRadius, note: t.shapeRadiusHint, value: a.radius,
      options: [['square', t.shapeSquare], ['soft', t.shapeSoft], ['round', t.shapeRound]],
    })
    + choice({
      k: 'shape.headingWeight', label: t.shapeHeading, note: t.shapeHeadingHint,
      value: a.headingWeight,
      options: [['light', t.shapeLight], ['normal', t.shapeRegular], ['bold', t.shapeBold]],
    })
    + `</div>`
}

// --- The two font pickers, and the uploader --------------------------------------------------

/**
 * A TILE IN A FONT PICKER: sunken, not inverted.
 *
 * A solid ink tile can show neither relief nor — worse, on a FONT picker — the face it is
 * selling. The chosen tile is a key pressed into the card, wearing its own specimen in its own
 * ink. The two faces are the segmented strip's job in every other card on this screen; here the
 * skin is different and the PROTOCOL is the same, so `data-choice-track` / `data-choice` /
 * `aria-pressed` carry it and the island's `pickChoice` moves it with no new code.
 */
const TILE_BASE = 'rounded-lg border transition-colors'
const TILE_ON = 'border-neutral-400 bg-neutral-200 font-semibold text-neutral-950'
  + ' shadow-[inset_0_2px_3px_rgba(0,0,0,.18)] dark:border-neutral-500 dark:bg-neutral-950'
  + ' dark:text-white dark:shadow-[inset_0_2px_3px_rgba(0,0,0,.6)]'
const TILE_OFF = 'border-neutral-300 text-neutral-700 hover:border-neutral-500'
  + ' dark:border-neutral-700 dark:text-neutral-300'

const tile = (v: string, on: boolean, cls: string, style: string, body: string): string =>
  `<button type="button" data-choice="${escapeAttr(v)}" aria-pressed="${on}"`
  + ` class="${TILE_BASE} ${cls} ${on ? TILE_ON : TILE_OFF}"`
  + ` style="font-family:${escapeAttr(style)}">${body}</button>`

/**
 * The two font pickers.
 *
 * The TOP grid sets `fontPreset` — the reading font — AND drops that font's tuned typography
 * into the roles below, because a serif runs small and wants a tighter leading than a sans, so
 * the reading setup travels with the font. The BOTTOM row sets `chromeFont` independently: pick
 * a code font for the furniture while the body stays readable.
 *
 * These tiles are painted in the face they offer, at one `font-size`, and the difference in
 * apparent size is part of the answer: Source Serif 4 renders 11% smaller than JetBrains Mono at
 * the same size, and a picker that hid that would be lying about the choice.
 *
 * ⚠️ THEY CARRIED A `data-specimen` HOOK TO OPT OUT OF THE ADMIN'S x-height NORMALISATION, and
 * that normalisation left `admin.css` when `font-size-adjust` did — it broke every leading it
 * touched. The hook outlived the rule by long enough that its note still described it.
 *
 * The note sits ABOVE the grid it explains, where it sat below both pickers. Two columns in the
 * chrome row, matching the reading grid: it was three, and `CHROME_FONTS` grew to four when
 * JetBrains Mono was added, so the fourth choice sat alone on a second row at half the width.
 */
function fonts(t: AdminStrings, s: SiteSettings): string {
  const reading = FONT_PRESETS.map((f) => tile(f.id, f.id === s.fontPreset, 'px-3 py-2 text-left',
    f.stack,
    `<span class="block text-base leading-tight">${escapeHtml(f.name)}</span>`
    // ONE shade for the second line, where React had two. `pickChoice` repaints the BUTTON it
    // pressed and not the words inside it, and a second pair of hidden spans per tile to carry
    // one step of grey is four nodes for something the sunken tile already says.
    + `<span class="block text-xs text-neutral-500 dark:text-neutral-400">Aa · 1793</span>`)).join('')
  const chrome = CHROME_FONTS.map((f) => tile(f.id, f.id === s.chromeFont,
    'px-2 py-2 text-center text-sm', f.sans ?? `'Inter'`,
    escapeHtml(f.id === 'reading' ? t.chromeFontReading : f.name))).join('')
  const grid = (body: string, k: string, was: string): string =>
    `<div class="grid grid-cols-2 gap-2" data-choice-track`
    + ` data-k="${escapeAttr(k)}" data-was="${escapeAttr(was)}">${body}</div>`
  return `<div class="${SETTING_GAP}">`
    + settingRow({ note: t.fontPresetHint, control: grid(reading, 'fontPreset', s.fontPreset) })
    + `<div class="border-t border-neutral-200 pt-5 dark:border-neutral-800">`
    + settingRow({
      label: t.chromeFontLabel, note: t.chromeFontHint,
      control: grid(chrome, 'chromeFont', s.chromeFont),
    })
    + `</div></div>`
}

/**
 * The custom typeface: one slot per weight, all four sharing one family.
 *
 * Two to a line. Four weights, one per full-width row, put a two-word label at one end and its
 * Upload key at the other with ~400px of nothing between them — measured 2026-08-31, the same
 * hole the pen card had. A weight and its key are a pair; the grid keeps them a pair.
 *
 * ⚠️ `customFont` IS A FAMILY AND AN ARRAY, and a dotted path can only ever ADD to an array —
 * removing the 600 face is not something `customFont.faces.2` can say. So the whole value rides
 * on one hidden input as JSON and `settings-form.ts` has to learn `data-k-json`; until it does,
 * `typed()` sends the STRING and `sanitizeFont` reads it as nothing at all.
 *
 * Every state of a slot ships drawn: the word beside the key has both faces in one wrapper, and
 * the key carries its three labels — choose, replace, and the one it wears while a file is on
 * the wire — rather than the island holding a string the server already had translated.
 */
function fontUpload(t: AdminStrings, s: SiteSettings): string {
  const label: Record<number, string> = {
    400: t.fontWeight400, 500: t.fontWeight500, 600: t.fontWeight600, 700: t.fontWeight700,
  }
  const slot = (w: number): string => {
    const has = s.customFont.faces.some((f) => f.weight === w)
    return `<div class="flex items-center justify-between gap-3 p-3" data-font-slot="${w}">`
      + `<span class="text-sm font-medium text-neutral-700 dark:text-neutral-300"`
      + ` style="font-weight:${w}">${escapeHtml(label[w] ?? String(w))} · ${w}</span>`
      + `<span class="flex items-center gap-2">`
      + `<span class="text-xs text-neutral-500 dark:text-neutral-400" data-font-state="on"`
      + `${has ? '' : ' hidden'}>${escapeHtml(t.fontUploaded)}</span>`
      + `<span class="text-xs text-neutral-500 dark:text-neutral-600" data-font-state="off"`
      + `${has ? ' hidden' : ''}>—</span>`
      + `<button type="button" data-font-pick="${w}" class="${buttonClass('secondary', 'sm')}"`
      + ` data-off="${escapeAttr(t.fontChoose)}" data-on="${escapeAttr(t.fontReplace)}"`
      + ` data-busy="${escapeAttr(t.loading)}">${escapeHtml(has ? t.fontReplace : t.fontChoose)}`
      + `</button>`
      + `<button type="button" data-font-remove="${w}" class="${buttonClass('ghost', 'sm')}"`
      + `${has ? '' : ' hidden'}>${escapeHtml(t.removeSelection)}</button>`
      + `</span></div>`
  }
  return `<div class="space-y-3" data-font-upload>`
    + `<p class="${NOTE_TEXT}">${escapeHtml(t.fontHint)}</p>`
    + `<div class="text-sm">`
    + `<span class="text-neutral-500 dark:text-neutral-400">${escapeHtml(t.fontFamilyLabel)}: </span>`
    + `<span class="font-medium text-neutral-800 dark:text-neutral-200" data-font-family>`
    + `${escapeHtml(s.customFont.family || t.fontDefault)}</span></div>`
    + `<input type="hidden" data-k="customFont" data-k-json`
    + ` value="${escapeAttr(JSON.stringify(s.customFont))}" data-was="${escapeAttr(JSON.stringify(s.customFont))}">`
    + `<input type="file" hidden data-font-file`
    + ` accept=".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf">`
    + `<div class="${PANEL} sm:grid sm:grid-cols-2">${FONT_WEIGHTS.map(slot).join('')}</div>`
    + `</div>`
}

// --- The door: the owner's own CSS -----------------------------------------------------------

/** One promised name, as a key that writes itself at the cursor. */
const nameKey = (n: { name: string; note: string }): string =>
  `<button type="button" data-css-insert="${escapeAttr(n.name)}" title="${escapeAttr(n.note)}"`
  // ⚠️ `text-xs`, NOT `text-[0.6875rem]`. 11px left this admin on 2026-09-07 and `check:admin-kit`
  // fails a file that hand-types it — but the guard matches `text-[11px]`, and the same size
  // spelled in rem walked straight past it. Three sites were still at 11px because of that.
  + ` class="rounded border border-neutral-200 bg-white px-1.5 py-0.5 font-mono text-xs`
  + ` text-neutral-600 hover:border-neutral-400 hover:text-neutral-900 dark:border-neutral-700`
  + ` dark:bg-neutral-950 dark:text-neutral-300 dark:hover:text-white">`
  + `${escapeHtml(n.name)}</button>`

/** An eyebrow over a stretch of keys, which is `UTIL`'s whole job — it was a hand-typed 11px
 *  one notch lighter than `UTIL`, on a size the scale calls a contrast limit rather than a taste. */
const nameGroup = (title: string, keys: string): string =>
  `<div><h4 class="mb-1 ${UTIL}">${escapeHtml(title)}</h4>`
  + `<div class="flex flex-wrap gap-1">${keys}</div></div>`

/**
 * THE BOX WHERE THIS PRODUCT STOPS HAVING ANSWERS AND HANDS YOU THE PEN.
 *
 * It was an eight-row `<textarea>`, which is fine for a two-line tweak and wrong for what this
 * box IS: Quire Ink ships no themes, so when the settings run out your own CSS is the whole of
 * the remaining answer. Three things it does, and each is here for a reason:
 *
 *   1. THE CONTRACT IS IN THE BOX. The names the software promises not to rename
 *      (`content/appearance-contract.ts`) are listed beside the editor, one line of explanation
 *      each, and clicking one writes it at the cursor. That list used to exist only in
 *      `docs/appearance.md` on GitHub — so the person most likely to need it, sitting in the
 *      settings screen, was the person furthest from it.
 *   2. IT SAYS WHAT IS WRONG. An unclosed brace is the single most common way a stylesheet does
 *      nothing at all, and the old box gave no sign: you saved, the page did not change, and
 *      nothing anywhere said why.
 *   3. IT SAYS WHAT IT COSTS. This text ships inside every public page, on every request.
 *
 * No highlighting and no dependency: an overlay behind a textarea has to keep two layers in
 * identical wrap for every font, zoom and word, and when it drifts it drifts by a character,
 * which looks like a bug in the editor rather than in the overlay.
 *
 * ⚠️ NO `space-y-*` DOWN THIS STACK. Its last child is the contract panel, which ships hidden —
 * and Tailwind writes that gap as `& > :not(:last-child)`, which counts a node nobody can see
 * (`docs/admin-one-dom.md`, trap 4). The 8px rides on each following block as `mt-2`, because a
 * `display:none` box contributes no margin at all.
 *
 * ⚠️ ALL THREE FACES OF THE STATUS LINE SHIP, and the SERVER picks. `braceBalance` is in
 * `@/admin-shared/css-brace` precisely so that the page and the island reach the same answer
 * from one copy — a stored stylesheet with an unclosed brace says so in the first frame, not
 * after the script lands. The island rewrites the same three spans as the text is typed.
 */
function cssEditor(t: AdminStrings, s: SiteSettings): string {
  const value = s.customCss
  const lines = value.split('\n').length
  const bytes = new TextEncoder().encode(value).length
  const depth = braceBalance(value)
  const STATUS = 'text-xs tabular-nums'
  const GUTTER = 'max-h-80 shrink-0 select-none overflow-hidden border-r border-neutral-200'
    + ' bg-neutral-50 px-2 py-2 text-right font-mono text-xs leading-5 text-neutral-400'
    + ' dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-600'
  const AREA = 'max-h-80 min-h-40 w-full resize-y bg-white px-3 py-2 font-mono text-xs leading-5'
    + ' text-neutral-900 placeholder:text-neutral-400 focus:outline-none dark:bg-neutral-950'
    + ' dark:text-neutral-100 dark:placeholder:text-neutral-600'
  // The gutter scrolls WITH the text rather than being painted into it, so a wrapped line keeps
  // ONE number — which is what a line number means. It ships with the numbers this value needs.
  const numbers = Array.from({ length: lines }, (_, i) => `<div>${i + 1}</div>`).join('')
  const reference = `<div class="mt-2 space-y-3 rounded-md border border-neutral-200 bg-neutral-50`
    + ` p-3 dark:border-neutral-800 dark:bg-neutral-900" data-css-names hidden>`
    + `<p class="${NOTE_TEXT}">${escapeHtml(t.cssNamesNote)}</p>`
    + PROMISED_VARS.map((g) => nameGroup(g.group, g.vars.map(nameKey).join(''))).join('')
    + nameGroup(t.cssStructure, PROMISED_SELECTORS.map(nameKey).join(''))
    + `</div>`
  return `<div>`
    + `<div class="flex overflow-hidden rounded-md border border-neutral-300`
    + ` focus-within:border-neutral-400 dark:border-neutral-700">`
    + `<div aria-hidden="true" data-css-gutter class="${GUTTER}">${numbers}</div>`
    + `<textarea data-k="customCss" data-css-editor rows="10" spellcheck="false"`
    + ` aria-label="${escapeAttr(t.customCss)}" class="${AREA}"`
    + ` placeholder="${escapeAttr(':root { --c-accent: #b4472a }\n\n.prose h2 { letter-spacing: -0.01em }')}">`
    + `${escapeHtml(value)}</textarea></div>`
    + `<div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">`
    // ONE hook over the three faces: what the box says RIGHT NOW is one sentence to anything
    // reading it, and three siblings with two of them hidden is three things to ask about.
    // React had a single `[data-css-status]`, and the tour reads it.
    + `<span data-css-status>`
    + `<span class="${STATUS} text-neutral-500 dark:text-neutral-400" data-css-count`
    + `${depth === 0 ? '' : ' hidden'}>`
    + `${lines} ${escapeHtml(t.cssLines)} · ${escapeHtml(formatCount(bytes, s.language))}`
    + ` ${escapeHtml(t.cssBytes)}</span>`
    + `<span class="${STATUS} text-[var(--pen-edge)]" data-css-unclosed`
    + `${depth > 0 ? '' : ' hidden'}>${escapeHtml(t.cssUnclosed)} `
    + `<span data-css-depth>${depth > 0 ? depth : 1}</span></span>`
    + `<span class="${STATUS} text-[var(--pen-edge)]" data-css-stray`
    + `${depth < 0 ? '' : ' hidden'}>${escapeHtml(t.cssStrayBrace)}</span></span>`
    + `<button type="button" data-css-reference aria-expanded="false" class="${SHEET_TOOL} ml-auto`
    + ` underline-offset-2 hover:underline" data-off="${escapeAttr(t.cssShowNames)}"`
    + ` data-on="${escapeAttr(t.cssHideNames)}">${escapeHtml(t.cssShowNames)}</button></div>`
    + reference + `</div>`
}

/**
 * The tab.
 *
 * ⚠️ SHAPE IS IN THE LEFT COLUMN, and it was in the right one on the measured grounds that the
 * left stack was the taller of the two. Pairing the light and dark colour tables took 363px out
 * of the left stack and that stopped being true — measured at 1440px, left 2,224 against right
 * 2,992. Moving it back puts them at 2,752 and 2,464 and leaves the right column as exactly one
 * subject: type.
 *
 * ⚠️ CUSTOM CSS IS ON THE RIGHT, and that was measured too. The right column was type and ONLY
 * type, which cost, at 1440 on 2026-09-12: left 1,534 against right 535, so the tab ended in
 * 999px of blank paper beside the palette table — the hole the two-column rule exists to close.
 * Custom CSS is the one card here that belongs to no subject in particular and is the right
 * size to move: 1,187 against 882 with it over there. Re-measure before moving either again.
 *
 * TYPE SIZES STAND ALONE, full width, under both columns.
 */
export function appearanceTab(t: AdminStrings, s: SiteSettings, view: AppearanceTabView): string {
  return `<div class="space-y-5"><div class="${GRID}">`
    + `<div class="${COL}">`
    + panelCard({ title: t.lookLabel, body: look(t, s) })
    + panelCard({ title: t.cardShape, body: shape(t, s) })
    // ⚠️ ONE NOTE, NOT A TINTED CALLOUT AND A PARAGRAPH. `themeAdminNote` shipped in a grey
    // rounded box above a card that then carried plain notes under every row — the second note
    // style `fields.ts` names as the drift it exists to stop. It is the card's own sentence, so
    // it is the card's own note.
    + panelCard({
      title: t.navAppearance,
      body: `<p class="${NOTE_TEXT} mb-4">${escapeHtml(t.themeAdminNote)}</p>`
        + palettes(t, s, view.presets),
    })
    + `</div><div class="${COL}">`
    + panelCard({
      title: t.cardFont,
      body: fonts(t, s)
        + `<div class="mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">`
        + fontUpload(t, s) + `</div>`,
    })
    + panelCard({
      title: t.customCss,
      body: `<div class="space-y-1.5">${cssEditor(t, s)}`
        + `<p class="${NOTE_TEXT}">${escapeHtml(t.customCssHint)}</p></div>`,
    })
    + `</div></div>`
    + panelCard({ title: t.cardTypography, actions: typeResetKey(t), body: typeScale(t, s) })
    + `</div>`
}
