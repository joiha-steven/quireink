// Rendering/behaviour toggles: font smoothing (anti-aliasing), the IDE chrome, the site-wide
// motion engine, and how often the editor keeps a local copy of what you are typing. Per-role
// size/line/spacing live in TypographyFields (Appearance); custom CSS is a sibling card.
// Parent owns save.
import { useRef } from 'react'
import type { TypographySettings, MotionSettings, KeyFeedback } from '@/types'
import { Input } from '@/admin/ui/Input'
import { Button } from '@/admin/ui/Button'
import { Range } from '@/admin/ui/Range'
import { ToggleRow } from '@/admin/ui/Switch'
import { playPhrase, previewKey } from './key-sound'
import { useAdminT } from './I18nProvider'
import { FIELD_W, PANEL_LIST, Select, Setting } from './kit'

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
  // A volume you cannot hear while you set it is a trip to the editor and back for every
  // nudge, so the control plays the key it is describing. Throttled, because a drag fires
  // `change` on every pixel and forty overlapping clicks is not a volume, it is a noise.
  const lastHeard = useRef(0)
  const hear = (sound: { mode: KeyFeedback; volume: number }) => {
    const now = performance.now()
    if (now - lastHeard.current < 110) return
    lastHeard.current = now
    previewKey(sound)
  }
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
      {/* A CHOICE, not a switch, since 2026-08-24: three instruments and silence. It sits in
          the row's own padding for the same reason the autosave field below does — every
          other child of this list is a ToggleRow, which carries `p-4` inside its Setting. */}
      <div className="p-4">
        <Setting label={t.keyFeedbackLabel} note={t.keyFeedbackDesc}>
          <Select
            className={FIELD_W.medium}
            value={motion.keys}
            onChange={(e) => {
              const keys = e.target.value as KeyFeedback
              onMotion({ ...motion, keys })
              // Picking one plays it. Three names mean nothing on a page — the difference
              // between these is a difference you hear or it does not exist.
              playPhrase({ mode: keys, volume: motion.keyVolume })
            }}
          >
            <option value="off">{t.keyFeedbackOff}</option>
            <option value="woody">{t.keyFeedbackWoody}</option>
            <option value="crisp">{t.keyFeedbackCrisp}</option>
            <option value="deep">{t.keyFeedbackDeep}</option>
          </Select>
        </Setting>
      </div>
      {/* Kept visible while the instrument is off rather than hidden: a row that vanishes
          takes the knowledge that it exists with it, and somebody who turned the sound off
          last month has no way left to learn there was ever a volume. Disabled says the
          same thing and leaves the door marked. */}
      <div className="p-4">
        <Setting label={t.keyVolumeLabel} note={t.keyVolumeDesc}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <Range
              min={0}
              max={100}
              step={5}
              value={motion.keyVolume}
              disabled={motion.keys === 'off'}
              readout={`${motion.keyVolume}%`}
              onChange={(e) => {
                const keyVolume = Number(e.target.value)
                if (!Number.isFinite(keyVolume)) return
                onMotion({ ...motion, keyVolume })
                hear({ mode: motion.keys, volume: keyVolume })
              }}
            />
            {/* The button is not a convenience. The drag DOES play a key — measured at 0.61
                of full scale on the deployed build — and the owner still reported silence,
                because one 40ms tick at most every 110ms is a sound you have to already be
                listening for. Six keys and a space is a sound nobody can miss, and a run is
                the only way to hear what actually separates these three. */}
            <Button
              variant="secondary"
              disabled={motion.keys === 'off'}
              onClick={() => playPhrase({ mode: motion.keys, volume: motion.keyVolume })}
            >
              {t.keyHear}
            </Button>
          </div>
        </Setting>
      </div>
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