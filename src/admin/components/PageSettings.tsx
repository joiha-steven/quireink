// Right-hand settings panel of the page editor. Pages have no taxonomy or date:
// just slug, status, and an optional featured image.
import type { PostStatus } from '@/types'
import { Input } from '@/admin/ui/Input'
import { FeaturedImageField } from './FeaturedImageField'
import { useAdminT } from './I18nProvider'
import { CHECK } from './kit'

export type PageDraft = {
  title: string
  slug: string
  status: PostStatus
  featuredImage: string
  content: string
}

type Props = {
  draft: PageDraft
  update: (partial: Partial<PageDraft>) => void
  onPickFeatured: () => void
}

export function PageSettings({ draft, update, onPickFeatured }: Props) {
  const t = useAdminT()
  return (
    <aside className="space-y-5">
      <Input
        label={t.slug}
        value={draft.slug}
        onChange={(e) => update({ slug: e.target.value })}
        placeholder="gioi-thieu"
      />

      <div className="space-y-1.5">
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{t.status}</span>
        <div className="flex gap-4 text-sm">
          {(['draft', 'published'] as PostStatus[]).map((s) => (
            <label key={s} className="flex items-center gap-1.5">
              <input
                type="radio"
                name="status"
                className={CHECK}
                checked={draft.status === s}
                onChange={() => update({ status: s })}
              />
              {s === 'draft' ? t.statusDraft : t.statusPublished}
            </label>
          ))}
        </div>
      </div>

      <FeaturedImageField
        value={draft.featuredImage}
        onPick={onPickFeatured}
        onClear={() => update({ featuredImage: '' })}
      />
    </aside>
  )
}
