// Per-role type editor: every text role (h1–h5, body, small, caption, code) has
// its own size (rem), line-height, and letter-spacing (em) — the full set of CSS
// vars the site renders from. One reset restores all roles to the tuned defaults
// FOR THE CHOSEN READING FONT. Parent owns state + save.
import type { TypographySettings, TypeRole, TypeStyle } from '@/types'
import { getFontPreset, TYPE_ROLES } from '@/content/themes'
import { useAdminT } from './I18nProvider'
import type { AdminStrings } from '@/i18n/admin-i18n'
import { CONTROL_CHROME, INSET, NOTE, READING } from './kit'

const ROLE_LABEL: Record<TypeRole, keyof AdminStrings> = {
  h1: 'typoH1',
  h2: 'typoH2',
  h3: 'typoH3',
  h4: 'typoH4',
  h5: 'typoH5',
  body: 'typoBody',
  small: 'typoSmall',
  caption: 'typoCaption',
  code: 'typoCode',
}

// One numeric cell. `dim` keys map to the TypeStyle fields with their own ranges.
function Cell({
  value,
  step,
  min,
  max,
  onChange,
}: {
  value: number
  step: number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  return (
    <input
      type="number"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className={`${CONTROL_CHROME} w-16 px-1.5 py-1 text-right text-xs`}
    />
  )
}

type Props = {
  typography: TypographySettings
  /** The chosen reading font, so Reset restores ITS setup and not another font's. */
  fontPreset: string
  onChange: (typography: TypographySettings) => void
  /** Filled with the reset handler, so the CARD HEADER can carry the button (see below). */
  resetRef?: { current: (() => void) | null }
}

export function TypographyFields({ typography, fontPreset, onChange, resetRef }: Props) {
  const t = useAdminT()
  const setStyle = (role: TypeRole, patch: Partial<TypeStyle>) =>
    onChange({ ...typography, roles: { ...typography.roles, [role]: { ...typography.roles[role], ...patch } } })
  // Reset every role's size/line/spacing; keep the smoothing toggle (Advanced tab).
  //
  // To the CHOSEN FONT's tuning, not DEFAULT_TYPOGRAPHY. Every preset carries a reading
  // setup tuned for its own face — a serif runs small and wants tighter leading than a
  // sans, and the two book serifs zero out the sans's negative heading tracking. Reset used
  // DEFAULT_TYPOGRAPHY unconditionally, which is Inter's setup: an owner reading in
  // Literata who pressed Reset silently got the sans's numbers, and the only way back was
  // to notice and re-pick the font tile. `getFontPreset` falls back to Inter, so an
  // unrecognised id still resets to something sane.
  const resetAll = () =>
    onChange({ ...typography, roles: structuredClone(getFontPreset(fontPreset).typography.roles) })
  // The card header owns the button, so the handler has to travel up. A ref rather than a
  // callback prop: the parent renders the button and only needs to CALL this, and lifting
  // the reset itself would move `fontPreset` and `structuredClone` up with it.
  if (resetRef) resetRef.current = resetAll

  return (
    <div className="space-y-4">
      {/* The note runs the full width, and Reset is NOT beside it. It used to be, and at
          this column width the note wrapped to two lines while the button floated against
          its first — so the one control on the card sat on no line of its own and lined up
          with nothing. The Light mode and Dark mode panels put Reset on the TITLE row; this
          card now does the same through `SettingsView`'s Card actions slot, so all three
          reset buttons on the tab sit on the same rail. */}
      <p className={`${READING} text-sm leading-6 text-neutral-500 dark:text-neutral-400`}>{t.typographyHint}</p>

      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-y-1 text-sm">
          <thead>
            <tr className="text-xs text-neutral-500 dark:text-neutral-400">
              <th className="text-left font-medium" />
              <th className="px-1 text-right font-medium">{t.colSize}</th>
              <th className="px-1 text-right font-medium">{t.colLine}</th>
              <th className="px-1 text-right font-medium">{t.colSpacing}</th>
            </tr>
          </thead>
          <tbody>
            {TYPE_ROLES.map((role) => {
              const s = typography.roles[role]
              return (
                <tr key={role}>
                  <td className="pr-2 text-neutral-700 dark:text-neutral-300">{t[ROLE_LABEL[role]] as string}</td>
                  <td className="px-1 text-right">
                    <Cell value={s.size} step={0.01} min={0.5} max={6} onChange={(v) => setStyle(role, { size: v })} />
                  </td>
                  <td className="px-1 text-right">
                    <Cell value={s.line} step={0.05} min={0.8} max={3} onChange={(v) => setStyle(role, { line: v })} />
                  </td>
                  <td className="px-1 text-right">
                    <Cell value={s.spacing} step={0.005} min={-0.2} max={0.5} onChange={(v) => setStyle(role, { spacing: v })} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className={NOTE}>{t.typographyUnits}</p>

      {/* Live preview of the heading roles + body, each at its own style.
          `reading-font` + `data-specimen`: these samples ARE the reader's roles, so they show
          the reading face at the size the reader will get — not the admin's normalised one
          (`admin.css`, "font-size-adjust"). A preview of a size control that quietly resizes
          is the one preview that must not. */}
      <div className={`space-y-1.5 ${READING} ${INSET}`} data-specimen>
        {(['h1', 'h2', 'h3'] as const).map((k) => (
          <p
            key={k}
            className="truncate font-semibold text-neutral-900 dark:text-white"
            style={{ fontSize: `${typography.roles[k].size}rem`, lineHeight: typography.roles[k].line, letterSpacing: `${typography.roles[k].spacing}em` }}
          >
            {k.toUpperCase()} · {t.typographyPreview}
          </p>
        ))}
        <p
          className="text-neutral-500 dark:text-neutral-400"
          style={{ fontSize: `${typography.roles.body.size}rem`, lineHeight: typography.roles.body.line }}
        >
          {t.typographyPreviewBody}
        </p>
      </div>
    </div>
  )
}