// Posts grouped by the year they were published.
//
// In `content/` rather than beside the page that draws it, because two surfaces read it and
// they sit on opposite sides of the render: `web/archive-page.ts` builds the page, and
// `web/sidebar.ts` builds the way in. Importing one from the other would close a cycle
// through `web/listing-page.ts`, which renders the sidebar.

import type { Post } from '@/types'
import { zonedDay } from '@/i18n/i18n'

/** The anchor for a year heading. Prefixed, because an HTML id may not begin with a digit. */
export const yearAnchor = (year: number) => `y${year}`

export type ArchiveYear = { year: number; posts: Post[] }

/**
 * Public posts grouped by calendar year, newest year first, newest post first inside it.
 *
 * The year is the SITE's, which is neither the server's nor UTC's. `new Date(...)
 * .getFullYear()` reads the machine, and slicing the ISO string reads UTC; both are a day
 * out for part of every year in any zone that is not UTC, and the row printed beside the
 * heading has always been in the site's zone. So the same `zonedDay` the feed groups by,
 * and the zone travels in rather than being read from a global.
 */
export function byYear(posts: Post[], tz = ''): ArchiveYear[] {
  const years = new Map<number, Post[]>()
  for (const p of posts) {
    const year = Number(zonedDay(p.date, tz).slice(0, 4))
    if (!Number.isInteger(year)) continue
    const bucket = years.get(year)
    if (bucket) bucket.push(p)
    else years.set(year, [p])
  }
  return [...years]
    .sort(([a], [b]) => b - a)
    .map(([year, list]) => ({
      year,
      posts: [...list].sort((a, b) => b.date.localeCompare(a.date)),
    }))
}
