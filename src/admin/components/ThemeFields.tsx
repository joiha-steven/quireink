// Per-palette color editor. The 6 built-in palettes are each independently
// customizable: the picker chooses WHICH palette you're editing; its light+dark
// colors are saved under settings.themes[id]; "reset" restores that palette's
// built-in colors. One palette is marked the visitor default (settings.themePreset)
// — switchable here with "Set as default". Parent owns state + save.
import { useState } from 'react'
import type { ThemeColors, ThemeSettings } from '@/types'
import type { SchemeDefault, ThemePreset } from '@/content/themes'
import { getPreset, SCHEMES } from '@/content/themes'
import { useAdminT } from './I18nProvider'
import type { AdminStrings } from '@/i18n/admin-i18n'
import { CHECK, CONTROL_CHROME, INSET, META, ResetButton, Select, Setting, SETTING_GAP } from './kit'

type ColorKey = keyof ThemeColors

const FIELDS: { key: ColorKey; label: keyof AdminStrings }[] = [
  { key: 'bg', label: 'colorBg' },
  { key: 'text', label: 'colorText' },
  { key: 'heading', label: 'colorHeading' },
  { key: 'meta', label: 'colorMeta' },
  { key: 'link', label: 'colorLink' },
  { key: 'accent', label: 'colorAccent' },
  { key: 'rule', label: 'colorRule' },
]

/**
 * A tiny live page in one mode — and it shows ALL SEVEN colours, because the four it used to
 * show were the four that barely differ between palettes.
 *
 * It drew the background, the heading, the body and the link. Six of those seven values are
 * near-white or near-black in every built-in palette; the ONE that carries a palette's
 * identity is its accent, and that was the half-width 4px bar. Measured on the Sepia card at
 * 1440px: 144x48 = 6,912px² of swatch, of which the only genuinely coloured element was
 * 28x4 = 112px² per mode. **3.2% of the card.** Mono, Sepia and Forest were three near
 * identical grey-and-white stripes, which is what the owner was looking at when he said the
 * palettes had lost their colour.
 *
 * So the accent gets AREA — a dot, not a hairline — the secondary text and the rule appear at
 * all, and a reader can tell the six apart without reading the names under them.
 */
function MiniMode({ c }: { c: ThemeColors }) {
  return (
    <div className="flex-1 space-y-[3px] p-2" style={{ background: c.bg }}>
      <div className="h-[5px] w-3/5 rounded-full" style={{ background: c.heading }} />
      <div className="h-[3px] w-full rounded-full" style={{ background: c.text }} />
      {/* The real `meta` token, not the body colour at 60% — the palettes that tune their
          secondary text (Sepia warms it, Ocean cools it) were showing the body colour faded. */}
      <div className="h-[3px] w-3/4 rounded-full" style={{ background: c.meta }} />
      <div className="h-px w-full" style={{ background: c.rule }} />
      <div className="flex items-center gap-1.5 pt-px">
        <div className="h-[5px] flex-1 rounded-full" style={{ background: c.link }} />
        <div className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.accent }} />
      </div>
    </div>
  )
}

function PresetCard({
  name,
  theme,
  editing,
  isDefault,
  defaultLabel,
  shown,
  shownLabel,
  onPick,
  onToggleShown,
}: {
  name: string
  theme: ThemeSettings
  editing: boolean
  isDefault: boolean
  defaultLabel: string
  shown: boolean // listed in the visitor's palette switcher
  shownLabel: string
  onPick: () => void
  onToggleShown: () => void
}) {
  const state = editing
    ? 'border-neutral-900 bg-neutral-50 dark:border-white dark:bg-neutral-800'
    : 'border-neutral-200 bg-white hover:border-neutral-400 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-600 dark:hover:bg-neutral-800'
  return (
    <div className="group">
      <button
        type="button"
        onClick={onPick}
        aria-pressed={editing}
        /**
         * HIDDEN IS DRAWN ON THE CARD'S EDGE, NEVER ON THE COLOURS.
         *
         * The swatch carried `grayscale opacity-60` while a palette was unchecked, so hiding
         * Sepia from the visitor switcher turned Sepia grey ON THIS SCREEN — the owner's
         * report was, exactly, that some of the palettes had lost their colour. They had:
         * `grayscale()` is a filter, so it repaints the one thing this card exists to show,
         * and it does it to a palette that is still perfectly editable and still has every
         * colour it ever had. `admin-design.md` had already written the rule — *"Palette
         * cards stay readable in every state. Use neutral border/surface hierarchy for
         * selected, available and hidden; never lower opacity on a whole card or its
         * labels"* — and this shipped against it.
         *
         * A dashed edge says "not in the switcher" in the neutral scale, which is where a
         * state belongs; the checkbox under the card says it in words either way.
         */
        className={`block w-full rounded-lg border p-2 text-left transition ${shown ? '' : 'border-dashed'} ${state}`}
      >
        <div className="flex h-14 overflow-hidden rounded-lg">
          <MiniMode c={theme.light} />
          <MiniMode c={theme.dark} />
        </div>
        <div className="mt-2 flex min-h-5 items-center justify-between gap-1 px-0.5">
          <span className={`text-xs ${editing ? 'font-semibold text-neutral-900 dark:text-white' : 'font-medium text-neutral-500 dark:text-neutral-400'}`}>
            {name}
          </span>
          {isDefault && (
            <span className="rounded-md bg-neutral-900 px-1.5 py-0.5 text-xs font-medium text-white dark:bg-white dark:text-neutral-900">
              {defaultLabel}
            </span>
          )}
        </div>
      </button>
      {/* Visibility toggle. The default palette is always shown (locked), so the
          visitor never ends up with zero palettes. */}
      <label className={`mt-1.5 flex items-center gap-1.5 px-1 text-xs ${isDefault ? 'cursor-not-allowed text-neutral-500 dark:text-neutral-600' : 'cursor-pointer text-neutral-600 dark:text-neutral-400'}`}>
        <input
          type="checkbox"
          checked={shown}
          disabled={isDefault}
          onChange={onToggleShown}
          className={`h-3.5 w-3.5 rounded border-neutral-300 dark:border-neutral-600 ${CHECK}`}
        />
        {shownLabel}
      </label>
    </div>
  )
}

/**
 * ONE colour control: the swatch and its hex.
 *
 * The pair below and the ink card's single rows are both built from this, so a colour is
 * entered the same way wherever the admin asks for one. It stays in this file rather than
 * moving to the kit: the kit is the chrome every screen shares, and this is a control two
 * colour editors share.
 */
/**
 * ONE width for a colour cell, so the two column heads sit exactly over the two columns.
 *
 * 148px = a 44px swatch, an 8px gap, and 96px of field. The field was 76px for one build and
 * `#FCFCFC` came out as `#FCFCF(` — seven characters and a hash is the WIDEST thing this
 * control ever holds, so it is what the width is cut for.
 */
const CELL = 'w-[9.25rem]'

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <span className={`flex shrink-0 items-center gap-2 ${CELL}`}>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="h-9 w-11 shrink-0 rounded-lg border border-neutral-300 ring-1 ring-inset ring-black/5 dark:border-neutral-700"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        // `h-9`, matching the colour swatch it sits beside. It was `py-1`, which measured 30px
        // against the swatch's 36 — six pixels out, on ten rows in one column.
        className={`${CONTROL_CHROME} h-9 min-w-0 flex-1 px-2 text-sm uppercase`}
      />
    </span>
  )
}

/**
 * One colour on its own: the label, then the control. The ink card's shape.
 *
 * Exported since 2026-08-24 because the ink card wants the same row, and a second copy of
 * these classes is exactly the drift `check:admin-kit` exists to catch.
 */
export function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-sm text-neutral-700 dark:text-neutral-300">{label}</span>
      <ColorField label={label} value={value} onChange={onChange} />
    </label>
  )
}

/**
 * ONE COLOUR, BOTH MODES, ON ONE LINE.
 *
 * This was two stacked seven-row tables — "Light mode" then "Dark mode", 28 inputs, and the
 * light and dark value of the SAME token roughly 500px apart with a whole other table
 * between them. Nobody sets a background without thinking about the background it inverts
 * to, so the screen was asking for a pair and drawing two lists. `admin-design.md` had
 * already named the failure on the Traffic card: *"Two related numbers go within one glance
 * of each other."*
 *
 * Paired, the block is half as tall and the comparison is free.
 *
 * `flex-wrap` with a full-width label below `sm`: on a phone the two cells take 268px on
 * their own, which leaves a 40px label. There the label takes its own line instead.
 */
function ColorPair({ label, light, dark, onLight, onDark, t }: {
  label: string
  light: string
  dark: string
  onLight: (v: string) => void
  onDark: (v: string) => void
  t: AdminStrings
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span className="w-full min-w-0 text-sm text-neutral-700 sm:w-auto sm:flex-1 dark:text-neutral-300">{label}</span>
      <ColorField label={`${label} — ${t.modeLight}`} value={light} onChange={onLight} />
      <ColorField label={`${label} — ${t.modeDark}`} value={dark} onChange={onDark} />
    </div>
  )
}

/**
 * The seven colours of the palette being edited.
 *
 * The header names THAT PALETTE. Which one the table belongs to used to be carried only by
 * a border on one of six cards above it, so "Light mode" sat over Sepia's colours looking
 * exactly like it would over Mono's — the editor never said what it was editing.
 *
 * ONE reset, for the palette, replacing one per mode. It is what the help text above has
 * always described (*"Reset restores that palette's built-in colors"*, singular), and a
 * palette's built-in light and dark halves are defined together — restoring one of them on
 * its own is not a thing anyone came here to do.
 */
function ColorTable({ name, theme, onChange, onReset, t }: {
  name: string
  theme: ThemeSettings
  onChange: (mode: keyof ThemeSettings, key: ColorKey, value: string) => void
  onReset: () => void
  t: AdminStrings
}) {
  return (
    <div className={`space-y-3 ${INSET}`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold">{name}</h3>
        <ResetButton onClick={onReset} label={t.resetDefault} />
      </div>
      {/* Column heads, on the row layout only — stacked, each cell is already labelled by
          the `aria-label` its inputs carry. */}
      <div className="hidden items-center gap-x-3 sm:flex">
        <span className="flex-1" />
        <span className={`${META} ${CELL} shrink-0`}>{t.schemeNames.light}</span>
        <span className={`${META} ${CELL} shrink-0`}>{t.schemeNames.dark}</span>
      </div>
      {FIELDS.map((f) => (
        <ColorPair
          key={f.key}
          label={t[f.label] as string}
          light={theme.light[f.key]}
          dark={theme.dark[f.key]}
          onLight={(v) => onChange('light', f.key, v)}
          onDark={(v) => onChange('dark', f.key, v)}
          t={t}
        />
      ))}
    </div>
  )
}

type Props = {
  presets: ThemePreset[]
  themes: Record<string, ThemeSettings>
  defaultId: string
  enabled: string[]
  scheme: SchemeDefault
  onChangeThemes: (themes: Record<string, ThemeSettings>) => void
  onSetDefault: (id: string) => void
  onChangeEnabled: (ids: string[]) => void
  onChangeScheme: (scheme: SchemeDefault) => void
}

export function ThemeFields({ presets, themes, defaultId, enabled, scheme, onChangeThemes, onSetDefault, onChangeEnabled, onChangeScheme }: Props) {
  const t = useAdminT()
  // Which palette is being edited (local UI state — start at the visitor default).
  const [editingId, setEditingId] = useState(defaultId)
  const theme = themes[editingId] ?? getPreset(editingId).theme
  const builtin = getPreset(editingId).theme
  const enabledSet = new Set(enabled)

  const setColor = (mode: keyof ThemeSettings, key: ColorKey, value: string) =>
    onChangeThemes({ ...themes, [editingId]: { ...theme, [mode]: { ...theme[mode], [key]: value } } })
  // Both halves, because a palette's built-in colours are defined as a pair (see ColorTable).
  const resetPalette = () =>
    onChangeThemes({ ...themes, [editingId]: { light: { ...builtin.light }, dark: { ...builtin.dark } } })
  // Flip one palette's visibility; the default is always kept on (preset order).
  const toggleShown = (id: string) => {
    const on = new Set(enabledSet)
    if (on.has(id)) on.delete(id)
    else on.add(id)
    on.add(defaultId)
    onChangeEnabled(presets.filter((p) => on.has(p.id)).map((p) => p.id))
  }

  return (
    <div className={SETTING_GAP}>
      {/* Light or dark comes BEFORE which palette, because it is the coarser question: a
          visitor meets one of two pages, and the palette only tints whichever they got.
          'System' stays the default — most blogs want to meet a reader where they are —
          but a blog that IS dark or IS light can now say so. */}
      <Setting inline label={t.defaultScheme} note={t.defaultSchemeHint}>
        <Select
          value={scheme}
          onChange={(e) => onChangeScheme(e.target.value as SchemeDefault)}
        >
          {SCHEMES.map((id) => (
            <option key={id} value={id}>{t.schemeNames[id]}</option>
          ))}
        </Select>
      </Setting>
      {/* TWO notes, not three. They were spread around this control in two sizes and were
          gathered here into one voice, which was right; what survived the gathering was a
          four-line paragraph before you reach the first palette.
          `appearanceHint` is the sentence that went — *"Customize colors for light and dark
          mode: background, text, headings, secondary text, links, horizontal rule"* — because
          those seven nouns are, in that order, the seven row labels of the table directly
          below it. It is not an explanation, it is the table read aloud. */}
      <Setting
        label={t.themePreset}
        note={`${t.themePresetHint} ${t.paletteVisibilityHint}`}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {presets.map((p) => (
            <PresetCard
              key={p.id}
              name={t.paletteNames[p.id] ?? p.name}
              theme={themes[p.id] ?? p.theme}
              editing={p.id === editingId}
              isDefault={p.id === defaultId}
              defaultLabel={t.themeDefault}
              shown={enabledSet.has(p.id)}
              shownLabel={t.paletteShown}
              onPick={() => setEditingId(p.id)}
              onToggleShown={() => toggleShown(p.id)}
            />
          ))}
        </div>
        {editingId !== defaultId && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => onSetDefault(editingId)}
              className="text-xs font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white"
            >
              {t.themeSetDefault}
            </button>
          </div>
        )}
      </Setting>

      <ColorTable
        name={t.paletteNames[editingId] ?? getPreset(editingId).name}
        theme={theme}
        onChange={setColor}
        onReset={resetPalette}
        t={t}
      />
    </div>
  )
}