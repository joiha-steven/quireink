// Rendering/behaviour toggles: font smoothing (anti-aliasing), the IDE chrome, the site-wide
// motion engine, and how often the editor keeps a local copy of what you are typing. Per-role
// size/line/spacing live in TypographyFields (Appearance); custom CSS is a sibling card.
// Parent owns save.
import type { TypographySettings, MotionSettings } from '@/types'
import { Input } from '@/admin/ui/Input'
import { ToggleRow } from '@/admin/ui/Switch'
import { useAdminT } from './I18nProvider'
import { PANEL_LIST } from './kit'

type Props = {
  typography: TypographySettings
  onTypography: (t: TypographySettings) => void
  ideChrome: boolean
  onIdeChrome: (v: boolean) => void
  motion: MotionSettings
  onMotion: (m: MotionSettings) => void
  autosaveSeconds: number
  onAutosaveSeconds: (n: number) => void
}

export function AdvancedFields({
  typography, onTypography, ideChrome, onIdeChrome, motion, onMotion,
  autosaveSeconds, onAutosaveSeconds,
}: Props) {
  const t = useAdminT()
  return (
    <div className={PANEL_LIST}>
      <ToggleRow
        label={t.fontSmoothing}
        desc={t.fontSmoothingDesc}
        checked={typography.smoothing}
        onChange={(smoothing) => onTypography({ ...typography, smoothing })}
      />
      {/* One switch for a whole look, because it is a taste rather than a feature: the
          chrome reads as source code while the reading column stays analogue. Off leaves
          no trace - every rule behind it hangs off one attribute selector. */}
      <ToggleRow
        label={t.ideChromeLabel}
        desc={t.ideChromeDesc}
        checked={ideChrome}
        onChange={onIdeChrome}
      />
      <ToggleRow
        label={t.motionLabel}
        desc={t.motionDesc}
        checked={motion.enabled}
        onChange={(enabled) => onMotion({ ...motion, enabled })}
      />
      <ToggleRow
        label={t.typewriterLabel}
        desc={t.typewriterDesc}
        checked={motion.typewriter}
        onChange={(typewriter) => onMotion({ ...motion, typewriter })}
      />
      {/* The floor is 15s and it is enforced by the settings sanitiser, not only here: the
          editor also flushes on hide, on leave and on unmount, and those are what make a long
          interval safe. A very short one would make the interval the whole safety net again.

          WRAPPED IN THE ROW'S OWN PADDING, and that is the fix rather than decoration. Every
          other child of PANEL_LIST is a ToggleRow, which carries `p-4` inside its Setting;
          a bare Input has none, so this row alone sat flush against the divider and the
          panel edge while the four above it were inset — reported as "chỗ này bị bể". The
          divider draws between children, so the padding has to be on the child. */}
      <div className="p-4">
      <Input
        label={t.autosaveLabel}
        note={t.autosaveHint}
        type="number"
        min={15}
        max={600}
        step={15}
        value={autosaveSeconds}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (Number.isFinite(n)) onAutosaveSeconds(Math.min(600, Math.max(15, Math.round(n))))
        }}
      />
      </div>
    </div>
  )
}