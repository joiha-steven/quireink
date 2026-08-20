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

/** What a reader gets on a POST. */
export function PostFeatureFields({ features, onChange, relatedCount, onRelatedCount }: Props) {
  const t = useAdminT()
  const items: Item[] = [
    { key: 'search', label: t.featSearch, desc: t.featSearchDesc },
    { key: 'toc', label: t.featToc, desc: t.featTocDesc },
    { key: 'related', label: t.featRelated, desc: t.featRelatedDesc },
    { key: 'readingTime', label: t.featReadingTime, desc: t.featReadingTimeDesc },
    { key: 'progressBar', label: t.featProgress, desc: t.featProgressDesc },
    { key: 'deck', label: t.featDeck, desc: t.featDeckDesc },
    { key: 'categoryLabel', label: t.featCategoryLabel, desc: t.featCategoryLabelDesc },
    { key: 'penUnderline', label: t.featPenUnderline, desc: t.featPenUnderlineDesc },
    { key: 'penRing', label: t.featPenRing, desc: t.featPenRingDesc },
    { key: 'bookText', label: t.featBookText, desc: t.featBookTextDesc },
    { key: 'bookMode', label: t.featBookMode, desc: t.featBookModeDesc },
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
