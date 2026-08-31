// The four settings groups that are pure DATA: what a fresh install believes before anybody
// opens Settings.
//
// Moved out of `settings.ts` on 2026-08-29, when that file reached its 400-line ceiling for
// the fourth time. The seam is the one the previous three were cut on — by AUDIENCE.
// `settings.ts` answers "what is stored and how is it read back"; these four answer nothing,
// they are the answer. No logic, no imports but the types, and every one of them is read by
// `DEFAULT_SETTINGS` and by the sanitizer beside it.
//
// `settings.ts` re-exports all four, so no import site moved.

import type { SeoSettings, BackupSettings, FeatureSettings, CommentSettings } from '@/types'

export const DEFAULT_SEO: SeoSettings = {
  autoSchema: true,
  sitemap: true,
  llms: true,
  robots: true,
  rss: true,
  ogImage: true,
  ogFallbackImage: '',
}

export const DEFAULT_BACKUPS: BackupSettings = {
  // ON since 2026-08-29. It shipped off, which meant the product's least-technical
  // audience — the person who installs from a NAS container store and never opens
  // Settings → System — ran without a single snapshot until the day they needed one.
  // `keep` bounds the disk (4 snapshots, pruned), so the cost of on-by-default is a few
  // hundred MB ceiling; the cost of off-by-default is somebody's writing. An owner who
  // SAVED settings before this ships keeps their stored `false` — the default only
  // reaches installs that never chose.
  enabled: true,
  intervalDays: 4,
  keep: 4,
}

export const DEFAULT_FEATURES: FeatureSettings = {
  search: true,
  toc: true,
  related: true,
  readingTime: true,
  progressBar: true,
  activityLog: true,
  // ON, matching the dwell time it is stored beside: both are per-visit measurements of
  // the visit itself rather than of the person, and a switch that ships off is a feature
  // nobody finds. An owner who wants less kept turns it off and the column stays NULL.
  transferStats: true,
  sidebar: true,
  sidebarSeries: true,
  sidebarCategories: true,
  sidebarTags: true,
  sidebarArchive: true,
  leadPost: true,
  categoryLabel: true,
  deck: true,
  penUnderline: true,
  penRing: true,
  bookText: false,
  bookMode: true,
  readNext: true,
  resume: true,
  infiniteScroll: false,
  gridView: true,
  archive: true,
  offline: false,
}

export const DEFAULT_COMMENTS: CommentSettings = {
  enabled: false,
  turnstile: false,
  googleAuth: false,
}
