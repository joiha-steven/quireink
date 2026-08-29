// Controlled reader-feature toggles, in two groups. Parent owns state + save.
//
// One list of fifteen switches could only ever be one column, which left the Reading tab a
// single card and its neighbour a void. The split is not cosmetic: nine of these change what a
// reader gets on a POST and five change the LISTING they arrive from, and nothing said so.
// `activityLog` is neither, and is now its own small card in `SettingsView`.
//
// The keys stay exactly where they were in `FeatureSettings`; only which group renders them
// moved, so nothing about the stored shape changes.

import type { FeatureSettings } from '@/types'
import { Input } from '@/admin/ui/Input'
import { ToggleRow } from '@/admin/ui/Switch'
import { useAdminT } from './I18nProvider'
import { PANEL_LIST, SETTING_GAP } from './kit'

type Item = { key: keyof FeatureSettings; label: string; desc: string }

type Props = {
  features: FeatureSettings
  onChange: (f: FeatureSettings) => void
  relatedCount: number
  onRelatedCount: (n: number) => void
}

function List({ items, features, onChange }: {
  items: Item[]
  features: FeatureSettings
  onChange: (f: FeatureSettings) => void
}) {
  return (
    <div className={PANEL_LIST}>
      {items.map((f) => (
        <ToggleRow
          key={f.key}
          label={f.label}
          desc={f.desc}
          checked={features[f.key]}
          onChange={(v) => onChange({ ...features, [f.key]: v })}
        />
      ))}
    </div>
  )
}

/**
 * THE AIDS AROUND AN ARTICLE: how a reader finds it, moves through it, and comes back to it.
 *
 * Seven, not thirteen. One undifferentiated list of thirteen switches was the single hardest
 * thing to use on this screen — finding "Table of contents" meant reading thirteen two-line
 * descriptions in a 1,360px column, because nothing on it said which switches were about the
 * same subject. These seven are the reader's apparatus (search it, jump within it, track how
 * far in they are, return where they left); the six in `PageFeatureFields` are what the page
 * itself puts in front of them. Splitting on that line is what lets someone scan for the one
 * they came to change.
 *
 * The keys are untouched in `FeatureSettings` — only which card renders them moved, so the
 * stored shape is exactly what it was.
 */
export function PostFeatureFields({ features, onChange, relatedCount, onRelatedCount }: Props) {
  const t = useAdminT()
  const items: Item[] = [
    { key: 'search', label: t.featSearch, desc: t.featSearchDesc },
    { key: 'toc', label: t.featToc, desc: t.featTocDesc },
    { key: 'related', label: t.featRelated, desc: t.featRelatedDesc },
    { key: 'readNext', label: t.featReadNext, desc: t.featReadNextDesc },
    { key: 'readingTime', label: t.featReadingTime, desc: t.featReadingTimeDesc },
    { key: 'progressBar', label: t.featProgress, desc: t.featProgressDesc },
    { key: 'resume', label: t.featResume, desc: t.featResumeDesc },
  ]
  return (
    <div className={SETTING_GAP}>
      <List items={items} features={features} onChange={onChange} />
      {features.related && (
        <Input
          label={t.relatedCount}
          note={t.relatedCountHint}
          type="number"
          min={0}
          max={12}
          value={relatedCount}
          onChange={(e) => onRelatedCount(Number(e.target.value))}
        />
      )}
    </div>
  )
}

/** What the PAGE itself shows: its own furniture, the pen's marks, and the book. */
export function PageFeatureFields({ features, onChange }: Omit<Props, 'relatedCount' | 'onRelatedCount'>) {
  const t = useAdminT()
  const items: Item[] = [
    { key: 'deck', label: t.featDeck, desc: t.featDeckDesc },
    { key: 'categoryLabel', label: t.featCategoryLabel, desc: t.featCategoryLabelDesc },
    { key: 'penUnderline', label: t.featPenUnderline, desc: t.featPenUnderlineDesc },
    { key: 'penRing', label: t.featPenRing, desc: t.featPenRingDesc },
    { key: 'bookText', label: t.featBookText, desc: t.featBookTextDesc },
    { key: 'bookMode', label: t.featBookMode, desc: t.featBookModeDesc },
  ]
  return <List items={items} features={features} onChange={onChange} />
}

/** What a reader gets on the LISTING they arrive from. */
export function ListingFeatureFields({ features, onChange }: Omit<Props, 'relatedCount' | 'onRelatedCount'>) {
  const t = useAdminT()
  const items: Item[] = [
    { key: 'sidebar', label: t.featSidebar, desc: t.featSidebarDesc },
    { key: 'sidebarSeries', label: t.featSidebarSeries, desc: t.featSidebarSeriesDesc },
    { key: 'infiniteScroll', label: t.featInfiniteScroll, desc: t.featInfiniteScrollDesc },
    { key: 'gridView', label: t.featGridView, desc: t.featGridViewDesc },
    { key: 'leadPost', label: t.featLeadPost, desc: t.featLeadPostDesc },
  ]
  return <List items={items} features={features} onChange={onChange} />
}

/** The admin's own record of what changed. Not a reader feature at all. */
export function ActivityLogField({ features, onChange }: Omit<Props, 'relatedCount' | 'onRelatedCount'>) {
  const t = useAdminT()
  return (
    <div className={PANEL_LIST}>
      <ToggleRow
        label={t.featActivityLog}
        desc={t.featActivityLogDesc}
        checked={features.activityLog}
        onChange={(v) => onChange({ ...features, activityLog: v })}
      />
    </div>
  )
}
