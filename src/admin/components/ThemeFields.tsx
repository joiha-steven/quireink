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
import { CHECK, INSET, Select, Setting, SETTING_GAP } from './kit'

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

// A tiny live preview of one mode: background with a heading bar, a body line,
// and a link dot — enough to read the palette's character at a glance.
function MiniMode({ c }: { c: ThemeColors }) {
  return (
    <div className="flex-1 space-y-1 p-2" style={{ background: c.bg }}>
      <div className="h-1.5 w-3/4 rounded-full" style={{ background: c.heading }} />
      <div className="h-1 w-full rounded-full" style={{ background: c.text, opacity: 0.6 }} />
      <div className="h-1 w-1/2 rounded-full" style={{ background: c.link }} />
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
        className={`block w-full rounded-lg border p-2 text-left transition ${state}`}
      >
        <div className={`flex h-12 overflow-hidden rounded-lg transition ${shown ? '' : 'grayscale opacity-60'}`}>
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
      <label className={`mt-1.5 flex items-center gap-1.5 px-1 text-xs ${isDefault ? 'cursor-not-allowed text-neutral-400 dark:text-neutral-600' : 'cursor-pointer text-neutral-600 dark:text-neutral-400'}`}>
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

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-sm text-neutral-700 dark:text-neutral-300">{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="h-9 w-14 rounded-lg border border-neutral-300 ring-1 ring-inset ring-black/5 dark:border-neutral-700"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-24 rounded-lg border border-neutral-300 px-2 py-1 text-sm uppercase outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
        />
      </span>
    </label>
  )
}

function ModeBox({
  title,
  colors,
  onChange,
  onReset,
  t,
}: {
  title: string
  colors: ThemeColors
  onChange: (key: ColorKey, value: string) => void
  onReset: () => void
  t: AdminStrings
}) {
  return (
    <div className={`space-y-3 ${INSET}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">{title}</h3>
        <button type="button" onClick={onReset} className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white">
          {t.resetDefault}
        </button>
      </div>
      {FIELDS.map((f) => (
        <ColorRow key={f.key} label={t[f.label] as string} value={colors[f.key]} onChange={(v) => onChange(f.key, v)} />
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
  const resetMode = (mode: keyof ThemeSettings) =>
    onChangeThemes({ ...themes, [editingId]: { ...theme, [mode]: { ...builtin[mode] } } })
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
      <Setting label={t.defaultScheme} note={t.defaultSchemeHint}>
        <Select
          value={scheme}
          onChange={(e) => onChangeScheme(e.target.value as SchemeDefault)}
        >
          {SCHEMES.map((id) => (
            <option key={id} value={id}>{t.schemeNames[id]}</option>
          ))}
        </Select>
      </Setting>
      {/* THREE notes about the same control used to be spread around it: one above in a
          larger size, two below in a smaller one. They say what a reader needs before
          clicking a palette, so they belong together, above, in one voice. */}
      <Setting
        label={t.themePreset}
        note={`${t.appearanceHint} ${t.themePresetHint} ${t.paletteVisibilityHint}`}
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

      <ModeBox
        title={t.modeLight}
        colors={theme.light}
        onChange={(k, v) => setColor('light', k, v)}
        onReset={() => resetMode('light')}
        t={t}
      />
      <ModeBox
        title={t.modeDark}
        colors={theme.dark}
        onChange={(k, v) => setColor('dark', k, v)}
        onReset={() => resetMode('dark')}
        t={t}
      />
    </div>
  )
}