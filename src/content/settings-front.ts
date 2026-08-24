// The composed front page, validated. Split out of `settings-sanitize.ts` on 2026-08-25 at
// that file's 400-line cap.
//
// It is the right piece to move rather than the most convenient one: every other sanitiser
// in there answers a question with one or two fields, and this one validates a LAYOUT
// GRAMMAR — a lead block, a featured row, named strips, a popular row and a latest row, each
// with its own source, count and column rules. It is a subject, not a setting.
import type { FrontSettings, FrontStrip } from '@/types'
import { bool, clampNumber } from '@/content/settings-sanitize'

/** Columns in a row: 1, 2 or 3. Anything else is the fallback rather than a broken grid. */
const columns = (v: unknown, fallback: number): number =>
  v === 1 || v === 2 || v === 3 ? v : fallback

export function sanitizeFront(input: unknown, fallback: FrontSettings): FrontSettings {
  const o = (input ?? {}) as Partial<FrontSettings>
  const lead = (o.lead ?? {}) as Partial<FrontSettings['lead']>
  const featured = (o.featured ?? {}) as Partial<FrontSettings['featured']>
  const popular = (o.popular ?? {}) as Partial<FrontSettings['popular']>
  const latest = (o.latest ?? {}) as Partial<FrontSettings['latest']>
  return {
    // `fallback.kind`, for the same reason `mode` takes its fallback: a partial save must
    // not turn a text-led front page back into an image-led one just by not mentioning it.
    kind: o.kind === 'text' || o.kind === 'image' ? o.kind : fallback.kind,
    lead: {
      on: bool(lead.on, fallback.lead.on),
      source: lead.source === 'pinned' || lead.source === 'latest' ? lead.source : fallback.lead.source,
      slug: typeof lead.slug === 'string' ? lead.slug.trim().replace(/^\/+/, '').slice(0, 200) : fallback.lead.slug,
      secondary: clampNumber(lead.secondary, 0, 3, fallback.lead.secondary),
    },
    featured: {
      on: bool(featured.on, fallback.featured.on),
      count: clampNumber(featured.count, 1, 12, fallback.featured.count),
      columns: columns(featured.columns, fallback.featured.columns),
    },
    // Capped at eight rows. A front page that scrolls past every category is an archive
    // with extra steps, and each strip costs a reader a screen.
    strips: Array.isArray(o.strips)
      ? o.strips
        .filter((s): s is FrontStrip => !!s && typeof s.category === 'string' && !!s.category.trim())
        .slice(0, 8)
        .map((s) => ({
          category: s.category.trim().slice(0, 100),
          count: clampNumber(s.count, 1, 12, 3),
          columns: columns(s.columns, 3),
        }))
      : fallback.strips,
    popular: {
      on: bool(popular.on, fallback.popular.on),
      count: clampNumber(popular.count, 1, 12, fallback.popular.count),
      // Three windows, not a free number: 7, 30, or all time. A window nobody can name is a
      // window nobody can reason about when the row looks wrong.
      days: popular.days === 7 || popular.days === 30 || popular.days === 0
        ? popular.days
        : fallback.popular.days,
    },
    latest: {
      on: bool(latest.on, fallback.latest.on),
      count: clampNumber(latest.count, 1, 24, fallback.latest.count),
      columns: columns(latest.columns, fallback.latest.columns),
    },
    showDate: bool(o.showDate, fallback.showDate),
    showReadingTime: bool(o.showReadingTime, fallback.showReadingTime),
    tagLinks: bool(o.tagLinks, fallback.tagLinks),
  }
}

/**
 * What a fresh install serves at `/`, and what a front page looks like before anybody has
 * configured one. ADR 0014.
 *
 * `list` is what `/` has always been, so an install that upgrades into this feature sees no
 * change at all. `strips` starts EMPTY because a category row can only be chosen by the
 * owner: guessing one would put an arbitrary category on somebody's front page.
 */
