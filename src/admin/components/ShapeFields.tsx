// Density, corners and headline weight (Admin → Settings → Appearance).
//
// The three knobs that change SHAPE rather than colour. Measured across three live blogs on
// 2026-08-29: with 84 colour fields and 27 typography numbers available to them, the entire
// visible difference between the three was two colour values nobody can see. Shape is what
// an eye uses to tell two blogs apart, and until this card there was no way to change any.
//
// ⚠️ `normal` / `soft` / `normal` is TODAY, exactly — not a middle option chosen to look
// tidy. `content/settings-shape.ts` holds the numbers and the reason each one is what it is
// (the density multiplier is 1, the soft radius is the `.5rem` literal the sheets already
// carried, and the weight step moves the post-title/card-title PAIR because those two were
// never the same number).

import type { ShapeSettings } from '@/types'
import { NOTE_TEXT, SETTING_GAP } from './kit'
import { Choice } from './Choice'
import { useAdminT } from './I18nProvider'

export function ShapeFields({ shape, onChange }: {
  shape: ShapeSettings
  onChange: (s: ShapeSettings) => void
}) {
  const t = useAdminT()

  return (
    <div className={SETTING_GAP}>
      <p className={NOTE_TEXT}>{t.shapeHint}</p>

      <Choice
        label={t.shapeDensity}
        note={t.shapeDensityHint}
        value={shape.density}
        options={[
          { value: 'compact', label: t.shapeCompact },
          { value: 'normal', label: t.shapeNormal },
          { value: 'relaxed', label: t.shapeRelaxed },
        ]}
        onChange={(density) => onChange({ ...shape, density })}
      />

      <Choice
        label={t.shapeRadius}
        note={t.shapeRadiusHint}
        value={shape.radius}
        options={[
          { value: 'square', label: t.shapeSquare },
          { value: 'soft', label: t.shapeSoft },
          { value: 'round', label: t.shapeRound },
        ]}
        onChange={(radius) => onChange({ ...shape, radius })}
      />

      <Choice
        label={t.shapeHeading}
        note={t.shapeHeadingHint}
        value={shape.headingWeight}
        options={[
          { value: 'light', label: t.shapeLight },
          { value: 'normal', label: t.shapeRegular },
          { value: 'bold', label: t.shapeBold },
        ]}
        onChange={(headingWeight) => onChange({ ...shape, headingWeight })}
      />
    </div>
  )
}
