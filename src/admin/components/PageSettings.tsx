// Right-hand settings panel of the page editor. Pages have no taxonomy or date:
// just slug, status, and an optional featured image.
import type { PostStatus } from '@/types'
import { Input } from '@/admin/ui/Input'
import { Button } from '@/admin/ui/Button'
import { useAdminT } from './I18nProvider'
import { CHECK, NOTE_TEXT } from './kit'

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

      <div className="space-y-1.5">
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{t.featuredImage}</span>
        <p className={NOTE_TEXT}>{t.featuredImageHint}</p>
        {draft.featuredImage ? (
          <img src={draft.featuredImage} alt="" className="aspect-video w-full rounded-lg object-cover" />
        ) : (
          <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-neutral-100 text-xs text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500">
            {t.noImageSelected}
          </div>
        )}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onPickFeatured} type="button">
            {t.chooseImage}
          </Button>
          {draft.featuredImage && (
            <Button variant="ghost" onClick={() => update({ featuredImage: '' })} type="button">
              {t.removeSelection}
            </Button>
          )}
        </div>
      </div>
    </aside>
  )
}
