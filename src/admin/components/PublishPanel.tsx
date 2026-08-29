// The attributes, and the moment they arrive.
//
// This panel is the same fields it always was — slug, date, terms, series, the two images,
// the SEO overrides. What changed is WHEN (ADR 0024, step 5): it opens when Publish is
// pressed on something never published, and it carries the button that finishes the job.
//
// And since 2026-08-17, WHERE: it slides in from the right over a scrim, the Writing Desk
// mock's `pubsheet`, instead of docking as a 340px column. The column version squeezed the
// writing to make room for the questions, which is precisely the layout the step existed to
// end; a sheet ON TOP of the page borrows the space and gives it back.
import type { ReactNode } from 'react'
import { Button } from '@/admin/ui/Button'
import { PostSettings, type Draft } from './PostSettings'
import { SlideOver } from './SlideOver'
import { useAdminT } from './I18nProvider'

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
  onClose,
  links,
  bottom,
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
  onClose: () => void
  /** History / view-post, which belong to the post rather than to its attributes. */
  links: ReactNode
  /** Rendered at the FOOT of the panel body, under its own rule. */
  bottom?: ReactNode
}) {
  const t = useAdminT()
  return (
    <SlideOver
      label={asking ? t.pubTitle : t.attributes}
      intro={asking ? t.publishReview : undefined}
      headerRight={links}
      onClose={onClose}
      // The footer holds the pair the mock names: walk away, or finish it. A plain
      // attributes visit gets only the walk-away, since nothing is being decided.
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>
            {asking ? t.pubLater : t.hideAttributes}
          </Button>
          {asking && (
            <Button onClick={onPublish} disabled={saving}>
              {scheduled ? t.schedule : t.publish}
            </Button>
          )}
        </>
      }
    >
      <PostSettings
        draft={draft}
        update={update}
        allCategories={allCategories}
        allTags={allTags}
        allSeries={allSeries}
        onPickFeatured={onPickFeatured}
        onPickCover={onPickCover}
      />
      {bottom}
    </SlideOver>
  )
}
