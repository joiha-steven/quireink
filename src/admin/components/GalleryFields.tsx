// The site-wide default for in-body galleries: what shape the tiles are, and whether the
// captions print.
//
// It exists because of an imported archive. A WordPress import folds each figcaption into
// the alt, and on a site whose alts are filenames that is a hundred and sixty lines of
// `IMG_4032` printed under the photos, across thirty galleries. Fixing that one gallery at
// a time is not a feature, it is a chore, so the default lives here and a gallery only
// overrides it when it has a reason to.
//
// The default is applied as CSS, never as markup. Rendered Markdown is cached under a hash
// of its input, so a default that rewrote the HTML would leave every already-rendered body
// serving the old shape.

import type { GallerySettings } from '@/types'
import { ToggleRow } from '@/admin/ui/Switch'
import { useAdminT } from './I18nProvider'

const LABEL = 'block text-sm font-medium text-neutral-700 dark:text-neutral-300'
const HINT = 'text-xs text-neutral-400 dark:text-neutral-500'

const RATIOS: GallerySettings['ratio'][] = ['', '1x1', '3x2', '4x3']
// Ratios read the same in every language. Only "as shot" is a word.
const RATIO_LABEL: Record<string, string> = { '1x1': '1:1', '3x2': '3:2', '4x3': '4:3' }

export function GalleryFields({ gallery, onChange }: {
  gallery: GallerySettings
  onChange: (g: GallerySettings) => void
}) {
  const t = useAdminT()

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <span className={LABEL}>{t.galleryRatio}</span>
        <div className="inline-flex flex-wrap gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
          {RATIOS.map((r) => (
            <button
              key={r || 'asis'}
              type="button"
              onClick={() => onChange({ ...gallery, ratio: r })}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                gallery.ratio === r
                  ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white'
                  : 'text-neutral-500'
              }`}
            >
              {r ? RATIO_LABEL[r] : t.imgRatioNatural}
            </button>
          ))}
        </div>
        <p className={HINT}>{t.galleryRatioHint}</p>
      </div>

      <ToggleRow
        label={t.galleryCaptions}
        desc={t.galleryCaptionsHint}
        checked={gallery.captions}
        onChange={(captions) => onChange({ ...gallery, captions })}
      />
    </div>
  )
}
