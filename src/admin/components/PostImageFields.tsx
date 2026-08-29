// Whether a post's own picture is ever shown, and where (Admin → Settings → Layout).
//
// The picture already exists — a cover is stored, resized and served, and until this setting
// arrived the only place it could appear was a share card. These two switches do not add a
// feature, they stop hiding one.
//
// ⚠️ BOTH ARRIVE OFF. A hero that shipped switched on would put a picture at the top of every
// archived article during an upgrade, which is the one thing an upgrade may never do.
//
// It sits on LAYOUT rather than Appearance because the question is where a thing sits, not what
// colour it is — the same question `FigureFields` and `GalleryFields` answer two cards away.
//
// NO SHAPE CONTROL ANYWHERE, and that is the design: a cover is 3:2, a thumbnail beside the
// words is a square, a thumbnail above the title is 3:2. One blog's pictures should look like
// one blog's pictures, and choosing that is the design's job rather than a question put to the
// owner three times. A ratio picker existed for an hour on 2026-08-29 and came out again.

import type { PostImageSettings } from '@/types'
import { NOTE_TEXT, SETTING_GAP } from './kit'
import { Choice } from './Choice'
import { useAdminT } from './I18nProvider'

export function PostImageFields({ postImage, onChange }: {
  postImage: PostImageSettings
  onChange: (p: PostImageSettings) => void
}) {
  const t = useAdminT()

  return (
    <div className={SETTING_GAP}>
      <p className={NOTE_TEXT}>{t.postImageHint}</p>

      <Choice
        label={t.postImageHero}
        note={t.postImageHeroHint}
        value={postImage.hero}
        // TWO values, not three. A `wide` hero existed for an afternoon and was measured
        // out again: at contentWidth 672 on a 1440 viewport it started at 264 while the
        // left rail ran 126-376, so it printed over the table of contents — and the band
        // between the rails does not grow with the viewport, because the rails are
        // positioned against the column. `types-settings.ts` carries the numbers.
        options={[
          { value: 'none', label: t.piOff },
          { value: 'inline', label: t.piHeroInline },
        ]}
        onChange={(hero) => onChange({ ...postImage, hero })}
      />

      <Choice
        label={t.postImageThumb}
        note={t.postImageThumbHint}
        value={postImage.thumb}
        options={[
          { value: 'none', label: t.piOff },
          { value: 'side', label: t.piThumbSide },
          { value: 'top', label: t.piThumbTop },
        ]}
        onChange={(thumb) => onChange({ ...postImage, thumb })}
      />
    </div>
  )
}
