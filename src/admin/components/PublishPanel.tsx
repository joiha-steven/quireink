// The attributes, and the moment they arrive.
//
// This panel is the same fields it always was — slug, date, terms, series, the two images,
// the SEO overrides. What changed is WHEN (ADR 0024, step 5): it used to be open on every
// load, asking all of that while the writer was still mid-sentence and taking 340px of the
// width to do it. Now it opens when Publish is pressed on something never published, and it
// carries the button that finishes the job.
//
// Split out of `PostForm` when that file passed its 400-line cap, and this is the seam
// because it is the one part of the screen that is NOT the writing surface.
import type { ReactNode } from 'react'
import { Button } from '@/admin/ui/Button'
import { PostSettings, type Draft } from './PostSettings'
import { useAdminT } from './I18nProvider'
import { CARD } from './kit'

export function PublishPanel({
  draft,
  update,
  allCategories,
  allTags,
  allSeries,
  onPickFeatured,
  onPickCover,
  /** True while this panel IS the publish sheet: an intro line, and a button that publishes. */
  asking,
  saving,
  scheduled,
  onPublish,
  links,
}: {
  draft: Draft
  update: (patch: Partial<Draft>) => void
  allCategories: string[]
  allTags: string[]
  allSeries: string[]
  onPickFeatured: () => void
  onPickCover: () => void
  asking: boolean
  saving: boolean
  scheduled: boolean
  onPublish: () => void
  /** History / view-post, which belong to the post rather than to its attributes. */
  links: ReactNode
}) {
  const t = useAdminT()
  return (
    <aside className={`p-5 xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto ${CARD}`}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{t.attributes}</h2>
        <div className="flex gap-3 text-xs">{links}</div>
      </div>
      {asking && <p className="mb-4 text-xs text-neutral-500 dark:text-neutral-400">{t.publishReview}</p>}
      <PostSettings
        draft={draft}
        update={update}
        allCategories={allCategories}
        allTags={allTags}
        allSeries={allSeries}
        onPickFeatured={onPickFeatured}
        onPickCover={onPickCover}
      />
      {asking && (
        <div className="mt-5 flex justify-end">
          <Button onClick={onPublish} disabled={saving}>
            {scheduled ? t.schedule : t.publish}
          </Button>
        </div>
      )}
    </aside>
  )
}
