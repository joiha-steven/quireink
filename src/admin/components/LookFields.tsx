// Settings → Appearance → Looks like: which dialect the PUBLIC site is dressed in.
//
// It was a boolean called "IDE chrome", filed under Account beside anti-aliasing and the
// autosave interval — a public-site decision living in the card that describes this admin,
// and the coarsest look decision the product has, filed as a rendering detail. It is four
// answers now, and it sits first on the tab that is about what a reader sees: what shape
// everything is comes after what kind of publication this is.
//
// The control is the kit's own `Choice`, so this file draws nothing of its own.
import type { SiteLook } from '@/types'
import { Choice } from './Choice'
import { useAdminT } from './I18nProvider'

export function LookFields({ look, onChange }: {
  look: SiteLook
  onChange: (look: SiteLook) => void
}) {
  const t = useAdminT()
  return (
    <Choice
      label={t.lookLabel}
      note={t.lookDesc}
      value={look}
      options={[
        { value: 'plain', label: t.lookPlain },
        { value: 'code', label: t.lookCode },
        { value: 'paper', label: t.lookPaper },
        { value: 'notes', label: t.lookNotes },
      ] as const}
      onChange={onChange}
    />
  )
}
