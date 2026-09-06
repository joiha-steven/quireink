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
 * THE HEAD OF A POST: what stands above the first sentence.
 *
 * Regrouped by POSITION on 2026-09-07 (ADR 0041). It was two lists — "the reader's apparatus"
 * and "what the page puts in front of them" — a distinction that reads well written down and
 * answers no question anybody arrives with. What somebody actually holds is "the date is in
 * the wrong place" or "I want the table of contents gone", and both of those are answered by
 * knowing where on the page the thing appears. The keys are untouched in `FeatureSettings`;
 * only which group renders them moved.
 */
export function PostHeadFields({ features, onChange }: Omit<Props, 'relatedCount' | 'onRelatedCount'>) {
  const t = useAdminT()
  const items: Item[] = [
    { key: 'deck', label: t.featDeck, desc: t.featDeckDesc },
    { key: 'categoryLabel', label: t.featCategoryLabel, desc: t.featCategoryLabelDesc },
    { key: 'readingTime', label: t.featReadingTime, desc: t.featReadingTimeDesc },
  ]
  return <List items={items} features={features} onChange={onChange} />
}

/** THE BODY: what happens between the first sentence and the last. */
export function PostBodyFields({ features, onChange }: Omit<Props, 'relatedCount' | 'onRelatedCount'>) {
  const t = useAdminT()
  const items: Item[] = [
    { key: 'toc', label: t.featToc, desc: t.featTocDesc },
    { key: 'progressBar', label: t.featProgress, desc: t.featProgressDesc },
    { key: 'resume', label: t.featResume, desc: t.featResumeDesc },
    { key: 'penUnderline', label: t.featPenUnderline, desc: t.featPenUnderlineDesc },
    { key: 'penRing', label: t.featPenRing, desc: t.featPenRingDesc },
    { key: 'bookText', label: t.featBookText, desc: t.featBookTextDesc },
    { key: 'bookMode', label: t.featBookMode, desc: t.featBookModeDesc },
  ]
  return <List items={items} features={features} onChange={onChange} />
}

/** THE FOOT: what a reader is offered once the words have run out. */
export function PostEndFields({ features, onChange, relatedCount, onRelatedCount }: Props) {
  const t = useAdminT()
  const items: Item[] = [
    { key: 'related', label: t.featRelated, desc: t.featRelatedDesc },
    { key: 'readNext', label: t.featReadNext, desc: t.featReadNextDesc },
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

/**
 * NEITHER HEAD NOR BODY NOR FOOT: how a post is FOUND, and whether it survives losing the
 * network. Both are about a post and neither appears anywhere on one, which is why they are
 * their own group rather than filed under a position they do not have.
 */
export function PostReachFields({ features, onChange }: Omit<Props, 'relatedCount' | 'onRelatedCount'>) {
  const t = useAdminT()
  const items: Item[] = [
    { key: 'search', label: t.featSearch, desc: t.featSearchDesc },
    { key: 'offline', label: t.featOffline, desc: t.featOfflineDesc },
  ]
  return <List items={items} features={features} onChange={onChange} />
}

/** What a reader gets on the LISTING they arrive from. */
export function ListingFeatureFields({ features, onChange }: Omit<Props, 'relatedCount' | 'onRelatedCount'>) {
  const t = useAdminT()
  const items: Item[] = [
    { key: 'sidebar', label: t.featSidebar, desc: t.featSidebarDesc },
    // One switch per BLOCK on the rail, together and in the order they render. The rail had
    // seven blocks and four ways to influence it, scattered: the whole rail, the series, the
    // archive route, and a count that hid Most viewed at 0 — so categories and tags could
    // not be turned off at all, and the years only by taking /archive down with them.
    { key: 'sidebarCategories', label: t.featSidebarCategories, desc: t.featSidebarCategoriesDesc },
    { key: 'sidebarSeries', label: t.featSidebarSeries, desc: t.featSidebarSeriesDesc },
    { key: 'sidebarArchive', label: t.featSidebarArchive, desc: t.featSidebarArchiveDesc },
    { key: 'sidebarTags', label: t.featSidebarTags, desc: t.featSidebarTagsDesc },
    { key: 'infiniteScroll', label: t.featInfiniteScroll, desc: t.featInfiniteScrollDesc },
    { key: 'gridView', label: t.featGridView, desc: t.featGridViewDesc },
    // Listed here because the listing is where it is most visible, but it is ONE switch for
    // both screens and its description says so.
    { key: 'scrollFade', label: t.featScrollFade, desc: t.featScrollFadeDesc },
    { key: 'archive', label: t.featArchive, desc: t.featArchiveDesc },
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
      <ToggleRow
        label={t.featTransferStats}
        desc={t.featTransferStatsDesc}
        checked={features.transferStats}
        onChange={(v) => onChange({ ...features, transferStats: v })}
      />
    </div>
  )
}
