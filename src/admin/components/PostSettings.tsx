// Right-hand settings panel of the editor screen.
import type { PostStatus } from '@/types'
import { DateField } from '@/admin/ui/DateField'
import { Input, Textarea } from '@/admin/ui/Input'
import { Button } from '@/admin/ui/Button'
import { isScheduled } from '@/utils'
import { MultiSelect } from './MultiSelect'
import { Combobox } from './Combobox'
import { useAdminT } from './I18nProvider'
import { CHECK, NOTE_TEXT } from './kit'

export type Draft = {
  title: string
  slug: string
  date: string // datetime-local value (local time, no zone)
  status: PostStatus
  categories: string[]
  tags: string[]
  series: string
  seriesOrder: number
  featuredImage: string
  coverImage: string
  metaTitle: string
  metaDescription: string
  excerpt: string
  content: string
}

type Props = {
  draft: Draft
  update: (partial: Partial<Draft>) => void
  allCategories: string[]
  allTags: string[]
  allSeries: string[]
  onPickFeatured: () => void
  onPickCover: () => void
}

export function PostSettings({ draft, update, allCategories, allTags, allSeries, onPickFeatured, onPickCover }: Props) {
  const t = useAdminT()
  return (
    <div className="space-y-5">
      <Input
        label={t.slug}
        value={draft.slug}
        onChange={(e) => update({ slug: e.target.value })}
        placeholder="tu-dong-tu-tieu-de"
      />

      <div className="space-y-1.5">
        <DateField
          label={t.publishDate}
          value={draft.date}
          onChange={(date) => update({ date })}
        />
        {isScheduled(draft.status, draft.date) && (
          <p className={NOTE_TEXT}>
            {t.scheduledForPrefix} {new Date(draft.date).toLocaleString()}
          </p>
        )}
      </div>

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

      <MultiSelect
        label={t.categories}
        value={draft.categories}
        options={allCategories}
        onChange={(categories) => update({ categories })}
      />

      <MultiSelect
        label={t.tags}
        value={draft.tags}
        options={allTags}
        onChange={(tags) => update({ tags })}
        lowercase
      />

      <div className="space-y-3">
        <Combobox
          label={t.seriesField}
          value={draft.series}
          onChange={(series) => update({ series })}
          placeholder={t.seriesPlaceholder}
          options={allSeries}
        />
        {draft.series.trim() && (
          <Input
            label={t.seriesOrder}
            type="number"
            value={String(draft.seriesOrder)}
            onChange={(e) => update({ seriesOrder: Number(e.target.value) || 0 })}
            className="w-24"
          />
        )}
      </div>

      <div className="space-y-1.5">
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{t.featuredImage}</span>
        <p className={NOTE_TEXT}>{t.featuredImageHint}</p>
        {draft.featuredImage ? (
          <img src={draft.featuredImage} alt="" className="aspect-video w-full rounded-lg object-cover" />
        ) : (
          <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-neutral-100 text-xs text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500 dark:text-neutral-500">
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

      <Textarea
        label={t.excerpt}
        rows={3}
        maxLength={200}
        value={draft.excerpt}
        onChange={(e) => update({ excerpt: e.target.value })}
        placeholder={t.excerptPlaceholder}
      />

      <div className="space-y-1.5">
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{t.coverImageLabel}</span>
        <p className={NOTE_TEXT}>{t.coverImageHint}</p>
        {draft.coverImage ? (
          <img src={draft.coverImage} alt="" className="aspect-video w-full rounded-lg object-cover" />
        ) : (
          <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-neutral-100 text-xs text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500">
            {t.noImageSelected}
          </div>
        )}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onPickCover} type="button">
            {t.chooseImage}
          </Button>
          {draft.coverImage && (
            <Button variant="ghost" onClick={() => update({ coverImage: '' })} type="button">
              {t.removeSelection}
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-3 border-t border-neutral-200 pt-4 dark:border-neutral-800">
        <p className={NOTE_TEXT}>{t.seoSectionHint}</p>
        <Input
          label={t.metaTitleLabel}
          value={draft.metaTitle}
          onChange={(e) => update({ metaTitle: e.target.value })}
          placeholder={draft.title || t.titlePlaceholder}
          maxLength={70}
        />
        <Textarea
          label={t.metaDescriptionLabel}
          rows={2}
          maxLength={200}
          value={draft.metaDescription}
          onChange={(e) => update({ metaDescription: e.target.value })}
          placeholder={t.excerptPlaceholder}
        />
      </div>
    </div>
  )
}
