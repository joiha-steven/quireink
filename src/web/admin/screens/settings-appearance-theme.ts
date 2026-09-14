// Settings → Appearance → THE PALETTES: six of them, the one a first-time visitor opens in,
// and the seven colours each is made of.
//
// ADR 0054. In React this card had one piece of local state — which palette the table below is
// editing — and drew ONE table from it. The server has no state, so ALL SIX TABLES SHIP DRAWN
// and an attribute picks (`docs/admin-one-dom.md`). They live in ONE wrapper, which is trap 5:
// a stack of six boxes where five are `hidden` would give whichever one precedes a hidden
// sibling a `space-y` margin it has not earned, because Tailwind writes that gap as
// `& > :not(:last-child)` and `:last-child` counts a node nobody can see.
//
// ⚠️ WHICH PALETTE IS BEING EDITED IS NOT A SETTING, so no card carries `data-k`. What IS a
// setting is which palette is the DEFAULT (`themePreset`) and which ones a visitor may switch
// between (`enabledPalettes`) — and neither has a control that can hold it, so both ride on a
// hidden input the island writes, the way `pickedImage` carries a URL.
import type { AdminStrings } from '@/i18n/admin-i18n'
import type { SiteSettings, ThemeColors, ThemeSettings } from '@/types'
import type { ThemePreset } from '@/content/themes'
import { SCHEMES } from '@/content/themes'
import { escapeAttr, escapeHtml } from '@/utils'
import { SHEET_TOOL } from '@/admin-shared/kit'
import { META, SETTING_GAP } from '@/admin-shared/scale'
import { hiddenField, settingRow } from '@/web/admin/fields'
import { INSET } from '@/web/admin/fields-box'
import { checkField, colourField, pick } from '@/web/admin/fields-pick'

/** The colour cell's width, so a column of them lines up with the head above it. */
const CELL = 'w-[8.25rem]'

/** The seven, in the order the table lists them — which is the order the hint used to recite. */
const colours = (t: AdminStrings): [keyof ThemeColors, string][] => [
  ['bg', t.colorBg], ['text', t.colorText], ['heading', t.colorHeading], ['meta', t.colorMeta],
  ['link', t.colorLink], ['accent', t.colorAccent], ['rule', t.colorRule],
]

/**
 * A tiny live page in one mode — and it shows ALL SEVEN colours, because the four it used to
 * show were the four that barely differ between palettes.
 *
 * It drew the background, the heading, the body and the link. Six of those seven values are
 * near-white or near-black in every built-in palette; the ONE that carries a palette's identity
 * is its accent, and that was a half-width 4px bar. Measured on the Sepia card at 1440px:
 * 144x48 = 6,912px² of swatch, of which the only genuinely coloured element was 28x4 = 112px²
 * per mode — **3.2% of the card**. Mono, Sepia and Forest were three near-identical grey-and-
 * white stripes, which is what the owner was looking at when he said the palettes had lost
 * their colour.
 *
 * So the accent gets AREA — a dot, not a hairline — the secondary text and the rule appear at
 * all, and a reader can tell the six apart without reading the names under them. `meta` is the
 * real token and not the body colour at 60%: the palettes that tune their secondary text
 * (Sepia warms it, Ocean cools it) were showing the body colour faded.
 */
const miniMode = (c: ThemeColors): string =>
  `<div class="flex-1 space-y-[3px] p-2" style="background:${escapeAttr(c.bg)}">`
  + `<div class="h-[5px] w-3/5 rounded-full" style="background:${escapeAttr(c.heading)}"></div>`
  + `<div class="h-[3px] w-full rounded-full" style="background:${escapeAttr(c.text)}"></div>`
  + `<div class="h-[3px] w-3/4 rounded-full" style="background:${escapeAttr(c.meta)}"></div>`
  + `<div class="h-px w-full" style="background:${escapeAttr(c.rule)}"></div>`
  + `<div class="flex items-center gap-1.5 pt-px">`
  + `<div class="h-[5px] flex-1 rounded-full" style="background:${escapeAttr(c.link)}"></div>`
  + `<div class="h-2 w-2 shrink-0 rounded-full" style="background:${escapeAttr(c.accent)}"></div>`
  + `</div></div>`

/**
 * The card is a KEY, so being edited is being HELD DOWN — sunk into the card on a real inset,
 * with the ground one step darker, because a thin dark border alone did not read as chosen at
 * a glance.
 *
 * ⚠️ HIDDEN IS DRAWN ON THE CARD'S EDGE, NEVER ON THE COLOURS. The swatch carried `grayscale
 * opacity-60` while a palette was unchecked, so hiding Sepia from the visitor's switcher turned
 * Sepia grey ON THIS SCREEN — `grayscale()` is a filter, so it repaints the one thing this card
 * exists to show, on a palette that is still perfectly editable. `admin-design.md` had already
 * written the rule: palette cards stay readable in every state. A dashed edge says "not in the
 * switcher" in the neutral scale, and the tick under the card says it in words either way.
 *
 * The two faces are handed to the island in `data-card-on` / `data-card-off` ON THE TRACK,
 * once, rather than being copied off whichever sibling happens to be pressed: `border-dashed`
 * is per-card, so a face read off a neighbour would spread one palette's visibility to all six.
 */
const CARD_BASE = 'block w-full rounded-lg border p-2 text-left transition active:translate-y-px'
  + ' active:duration-0 motion-reduce:active:translate-y-0'
const CARD_ON = `${CARD_BASE} border-neutral-400 bg-neutral-200`
  + ' shadow-[inset_0_2px_4px_rgba(0,0,0,.2)] dark:border-neutral-500 dark:bg-neutral-950'
  + ' dark:shadow-[inset_0_2px_4px_rgba(0,0,0,.6)]'
const CARD_OFF = `${CARD_BASE} border-neutral-200 bg-white hover:border-neutral-400`
  + ' hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900'
  + ' dark:hover:border-neutral-600 dark:hover:bg-neutral-800'

const NAME_ON = 'text-xs font-semibold text-neutral-900 dark:text-white'
const NAME_OFF = 'text-xs font-medium text-neutral-500 dark:text-neutral-400'

/** One palette: the miniature page, its name, and whether it is the default. */
function presetCard(t: AdminStrings, p: ThemePreset, s: SiteSettings): string {
  const theme: ThemeSettings = s.themes[p.id] ?? p.theme
  const editing = p.id === s.themePreset
  const isDefault = p.id === s.themePreset
  const shown = s.enabledPalettes.includes(p.id)
  const name = t.paletteNames[p.id] ?? p.name
  // BOTH NAME FACES SHIP, one hidden, in the span that holds them: the island repaints the
  // button it pressed and not the words inside it, and a name that stayed grey under a sunken
  // card is the one part of the state that would not have moved.
  const label = `<span class="min-w-0">`
    + `<span class="${NAME_ON}" data-card-name="on"${editing ? '' : ' hidden'}>${escapeHtml(name)}</span>`
    + `<span class="${NAME_OFF}" data-card-name="off"${editing ? ' hidden' : ''}>${escapeHtml(name)}</span>`
    + `</span>`
  // A quiet outline, not a solid ink block: on a card whose whole job is to show seven colours,
  // a filled black pill was the loudest thing in the frame. All six ship; the island moves the
  // `hidden` when "Set as default" is pressed.
  const pill = `<span class="whitespace-nowrap rounded-full border border-neutral-300 px-1.5`
    + ` py-0.5 text-xs text-neutral-500 dark:border-neutral-600 dark:text-neutral-400"`
    + ` data-card-default${isDefault ? '' : ' hidden'}>${escapeHtml(t.themeDefault)}</span>`
  // The default palette is always shown, so the visitor never ends up with zero palettes — and
  // a locked tick has to LOOK unavailable rather than merely refuse.
  const tick = `<div class="mt-1.5 px-1${isDefault ? ' cursor-not-allowed' : ''}"`
    + ` data-card-tick>`
    + checkField({
      label: t.paletteShown, on: shown,
      attrs: `data-palette-shown="${escapeAttr(p.id)}"${isDefault ? ' disabled' : ''}`,
    }) + `</div>`
  // `data-palette-hidden` records the dash as a FACT the island can read back. The class alone
  // would have to be parsed out of a className the island also rewrites, and a face copied off a
  // sibling card would spread one palette's visibility to all six.
  return `<div class="group" data-palette-card="${escapeAttr(p.id)}"`
    + ` data-palette-hidden="${shown ? '0' : '1'}">`
    + `<button type="button" data-palette-pick="${escapeAttr(p.id)}" aria-pressed="${editing}"`
    + ` class="${editing ? CARD_ON : CARD_OFF}${shown ? '' : ' border-dashed'}">`
    + `<div class="flex h-14 overflow-hidden rounded-lg">`
    + miniMode(theme.light) + miniMode(theme.dark) + `</div>`
    + `<div class="mt-2 flex min-h-5 items-center justify-between gap-1 px-0.5">${label}${pill}</div>`
    + `</button>${tick}</div>`
}

/**
 * ONE COLOUR, BOTH MODES, ON ONE LINE.
 *
 * This was two stacked seven-row tables — "Light mode" then "Dark mode", 28 inputs, and the
 * light and dark value of the SAME token roughly 500px apart with a whole other table between
 * them. Nobody sets a background without thinking about the background it inverts to, so the
 * screen was asking for a pair and drawing two lists. Paired, the block is half as tall and the
 * comparison is free.
 *
 * `flex-wrap` with a full-width label below `sm`: on a phone the two cells take 268px on their
 * own, which leaves a 40px label. There the label takes its own line instead.
 */
function colourPair(t: AdminStrings, id: string, key: keyof ThemeColors, label: string,
  theme: ThemeSettings): string {
  return `<div class="flex flex-wrap items-center gap-x-3 gap-y-1.5">`
    + `<span class="w-full min-w-0 text-sm text-neutral-700 sm:w-auto sm:flex-1`
    + ` dark:text-neutral-300">${escapeHtml(label)}</span>`
    + colourField({ k: `themes.${id}.light.${key}`, value: theme.light[key], label: `${label} — ${t.modeLight}` })
    + colourField({ k: `themes.${id}.dark.${key}`, value: theme.dark[key], label: `${label} — ${t.modeDark}` })
    + `</div>`
}

/**
 * The seven colours of ONE palette.
 *
 * The header names THAT PALETTE. Which one the table belonged to used to be carried only by a
 * border on one of six cards above it, so "Light mode" sat over Sepia's colours looking exactly
 * like it would over Mono's — the editor never said what it was editing.
 *
 * ONE reset, for the palette, replacing one per mode: a palette's built-in light and dark
 * halves are defined together, and restoring one of them on its own is not a thing anyone came
 * here to do. `SHEET_TOOL` rather than React's own four-class copy of the same key.
 */
function colourTable(t: AdminStrings, p: ThemePreset, s: SiteSettings): string {
  const theme: ThemeSettings = s.themes[p.id] ?? p.theme
  const open = p.id === s.themePreset
  const head = `<div class="flex items-center justify-between gap-3">`
    + `<h3 class="text-sm font-bold">${escapeHtml(t.paletteNames[p.id] ?? p.name)}</h3>`
    + `<button type="button" data-reset-palette="${escapeAttr(p.id)}" class="${SHEET_TOOL} shrink-0">`
    + `${escapeHtml(t.resetDefault)}</button></div>`
  // Column heads on the row layout only — stacked, each cell is already named by the
  // `aria-label` its two inputs carry.
  const cols = `<div class="hidden items-center gap-x-3 sm:flex"><span class="flex-1"></span>`
    + `<span class="${META} ${CELL} shrink-0">${escapeHtml(t.schemeNames.light ?? 'Light')}</span>`
    + `<span class="${META} ${CELL} shrink-0">${escapeHtml(t.schemeNames.dark ?? 'Dark')}</span></div>`
  return `<div class="space-y-3 ${INSET}" data-palette-table="${escapeAttr(p.id)}"`
    + `${open ? '' : ' hidden'}>${head}${cols}`
    + colours(t).map(([k, label]) => colourPair(t, p.id, k, label, theme)).join('')
    + `</div>`
}

/** The palette card, as the tab's `panelCard` body. */
export function palettes(t: AdminStrings, s: SiteSettings, presets: ThemePreset[]): string {
  // ⚠️ `enabledPalettes` IS A LIST AND NO CONTROL HOLDS A LIST. The ticks above are the
  // interface; this input is the value, and `settings-form.ts` has to learn `data-k-list`
  // (split on spaces) before it saves — until then `typed()` sends the STRING, and
  // `sanitizeEnabledPalettes` reads a non-array as "all six on".
  const enabled = `<input type="hidden" data-k="enabledPalettes" data-k-list`
    + ` value="${escapeAttr(s.enabledPalettes.join(' '))}" data-was="${escapeAttr(s.enabledPalettes.join(' '))}">`
  // The default palette has no visible control either: the key below is what moves it, and the
  // island writes the id here. It ships hidden because the card that opens editing IS the
  // default at first paint, and the key only has something to say once they differ.
  const setDefault = `<div class="mt-3" data-palette-setdefault hidden>`
    + hiddenField('themePreset', s.themePreset)
    + `<button type="button" data-palette-make-default class="${SHEET_TOOL}">`
    + `${escapeHtml(t.themeSetDefault)}</button></div>`
  const grid = `<div class="grid grid-cols-2 gap-3 sm:grid-cols-3" data-palette-track`
    + ` data-card-on="${escapeAttr(CARD_ON)}" data-card-off="${escapeAttr(CARD_OFF)}">`
    + presets.map((p) => presetCard(t, p, s)).join('') + `</div>`
  return `<div class="${SETTING_GAP}">`
    // Light or dark comes BEFORE which palette, because it is the coarser question: a visitor
    // meets one of two pages, and the palette only tints whichever they got. 'System' stays the
    // default — most blogs want to meet a reader where they are — but a blog that IS dark or IS
    // light can now say so.
    + pick({
      k: 'defaultScheme', label: t.defaultScheme, note: t.defaultSchemeHint, inline: true,
      width: 'medium', value: s.defaultScheme,
      options: SCHEMES.map((id) => [id, t.schemeNames[id] ?? id] as [string, string]),
    })
    // TWO notes, not three. `appearanceHint` is the sentence that went — its seven nouns are,
    // in that order, the seven row labels of the table below it. It is not an explanation, it
    // is the table read aloud.
    + settingRow({
      label: t.themePreset, note: `${t.themePresetHint} ${t.paletteVisibilityHint}`,
      control: grid + setDefault + enabled,
    })
    // ALL SIX TABLES, in one wrapper. The wrapper is the trap-5 fix: it is never hidden, so
    // the `space-y-5` above it has one child here whichever palette is open.
    + `<div data-palette-tables>`
    + presets.map((p) => colourTable(t, p, s)).join('')
    + `</div></div>`
}
