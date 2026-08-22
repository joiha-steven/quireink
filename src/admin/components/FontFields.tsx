// Two font pickers. The TOP grid sets `fontPreset` (the reading font: article body,
// title, comments, editor) AND drops that font's tuned typography into the editable
// roles below — a serif runs small and wants a tighter leading than a sans, so the
// reading setup travels with the font. An uploaded custom font (below) overrides it.
// The BOTTOM row sets `chromeFont` (the system-chrome font: header/footer/rail/meta/
// admin) INDEPENDENTLY — pick a code font here while the body stays readable.
import type { TypographySettings } from '@/types'
import { FONT_PRESETS, CHROME_FONTS } from '@/content/themes'
import { useAdminT } from './I18nProvider'
import { Setting, SETTING_GAP } from './kit'

export function FontFields({
  value,
  onChange,
  chromeFont,
  onChromeFont,
}: {
  value: string
  onChange: (fontPreset: string, typography: TypographySettings) => void
  chromeFont: string
  onChromeFont: (v: string) => void
}) {
  const t = useAdminT()
  return (
    <div className={SETTING_GAP}>
      {/* Note ABOVE the grid it explains. It sat below both pickers, which is the exact
          drift `Setting` exists to stop: the card's own title names this group, so this one
          needs no label of its own. */}
      <Setting note={t.fontPresetHint}>
      {/* `data-specimen`: these tiles are painted in the face they offer, and the admin
          normalises the x-height of any face that is not the chrome font (`admin.css`,
          "font-size-adjust"). Normalising a SPECIMEN would render all four options at one
          apparent size, which is the whole of what is being chosen between — Source Serif 4
          is 11% smaller than JetBrains Mono at the same `font-size`, and a picker that hides
          that is lying about the choice. */}
      <div className="grid grid-cols-2 gap-2" data-specimen>
        {FONT_PRESETS.map((f) => {
          const active = f.id === value
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => onChange(f.id, f.typography)}
              aria-pressed={active}
              className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                active
                  ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900'
                  : 'border-neutral-300 text-neutral-700 hover:border-neutral-500 dark:border-neutral-700 dark:text-neutral-300'
              }`}
              style={{ fontFamily: f.stack }}
            >
              <span className="block text-base leading-tight">{f.name}</span>
              <span className={`block text-xs ${active ? 'opacity-70' : 'text-neutral-400 dark:text-neutral-500'}`}>
                Aa · 1793
              </span>
            </button>
          )
        })}
      </div>
      </Setting>
      <div className="border-t border-neutral-200 pt-5 dark:border-neutral-800">
        <Setting label={t.chromeFontLabel} note={t.chromeFontHint}>
        {/* Two columns, matching the reading grid above. It was three, and CHROME_FONTS
            grew to four when JetBrains Mono was added — so the fourth choice sat alone on
            a second row, half the width of the others. */}
        <div className="grid grid-cols-2 gap-2" data-specimen>
          {CHROME_FONTS.map((f) => {
            const active = f.id === chromeFont
            const label = f.id === 'reading' ? t.chromeFontReading : f.name
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => onChromeFont(f.id)}
                aria-pressed={active}
                className={`rounded-lg border px-2 py-2 text-center text-sm transition-colors ${
                  active
                    ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900'
                    : 'border-neutral-300 text-neutral-700 hover:border-neutral-500 dark:border-neutral-700 dark:text-neutral-300'
                }`}
                style={{ fontFamily: f.sans ?? `'Inter'` }}
              >
                {label}
              </button>
            )
          })}
        </div>
        </Setting>
      </div>
    </div>
  )
}
