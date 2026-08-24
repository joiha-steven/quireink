// The pen's colours (Admin → Settings → Appearance).
//
// Owner's call, 2026-08-24: *"mấy cái màu sắc này, kể cả màu đánh dấu highlight hay khoanh
// tròn, nên cho người dùng customize, những gì đang có sẽ là màu mặc định, có thể reset về
// mặc định hết"*. It amends ADR 0018's "the colours are NOT a setting" — that decision's
// argument is that a highlighter must not restyle itself per PALETTE, and it still holds:
// one pen for the whole site, whatever the reader picks. WHICH pen is now his.
//
// EMPTY IS THE DEFAULT, and the swatch shows the built-in while the value stays empty, so
// the measured inks live in the code where they can still be corrected rather than being
// copied into every install's database. Reset writes empty back to all nine.
import type { InkSettings } from '@/types'
import { PEN_AUX_LIGHT, PEN_LIGHT } from '@/render/pen'
import { contrastRatio } from '@/render/pen-derive'
import { NOTE_TEXT, SETTING_GAP, Setting } from './kit'
import { ColorRow } from './ThemeFields'
import { useAdminT } from './I18nProvider'

/** The five, in the order the toolbar offers them. */
const PIGMENTS = ['yellow', 'green', 'pink', 'blue', 'orange'] as const

/** AA for body text, and the number ADR 0018 audited the five built-in inks against. */
const AA = 4.5

export function InkFields({ inks, bodyText, selectionDefaults, onChange }: {
  inks: InkSettings
  /** The default palette's light body colour, so the warning below is about this site. */
  bodyText: string
  /** What a selection is drawn in when neither field is set. */
  selectionDefaults: { light: string; dark: string }
  onChange: (inks: InkSettings) => void
}) {
  const t = useAdminT()
  const set = (key: keyof InkSettings, value: string) => onChange({ ...inks, [key]: value })
  const shown = (key: keyof InkSettings, fallback: string) => inks[key] || `#${fallback.replace(/^#/, '')}`

  // A pigment dark enough to swallow the words under it. The stroke multiplies onto the
  // page, so the WORST case is the densest part of it, which is the pigment itself.
  const tooDark = PIGMENTS.filter((ink) => inks[ink] && contrastRatio(bodyText, inks[ink]) < AA)

  return (
    <div className={SETTING_GAP}>
      <p className={NOTE_TEXT}>{t.inkHelp}</p>

      <Setting label={t.inkHighlighter}>
        <div className="space-y-2.5">
          {PIGMENTS.map((ink) => (
            <ColorRow
              key={ink}
              label={t[`ink${ink[0]!.toUpperCase()}${ink.slice(1)}` as 'inkYellow']}
              value={shown(ink, PEN_LIGHT[ink])}
              onChange={(v) => set(ink, v)}
            />
          ))}
        </div>
      </Setting>

      {tooDark.length > 0 && (
        // Said rather than prevented: it is the owner's pen. But a stroke this dark puts the
        // words under it below the contrast this repository has audited itself against, and
        // a setting that quietly discards that audit is worse than no setting.
        <p className="text-[0.8125rem] leading-[1.55] text-neutral-900 dark:text-neutral-100">
          {t.inkTooDark}
        </p>
      )}

      <Setting label={t.inkLines} note={t.inkLinesHint}>
        <div className="space-y-2.5">
          <ColorRow label={t.inkRing} value={shown('ring', PEN_AUX_LIGHT.red)} onChange={(v) => set('ring', v)} />
          <ColorRow label={t.inkUnderline} value={shown('underline', PEN_AUX_LIGHT.graphite)} onChange={(v) => set('underline', v)} />
        </div>
      </Setting>

      <Setting label={t.inkSelection} note={t.inkSelectionHint}>
        <div className="space-y-2.5">
          <ColorRow label={t.inkSelectionLight} value={shown('selection', selectionDefaults.light)} onChange={(v) => set('selection', v)} />
          <ColorRow label={t.inkSelectionDark} value={shown('selectionDark', selectionDefaults.dark)} onChange={(v) => set('selectionDark', v)} />
        </div>
      </Setting>
    </div>
  )
}
