// Posts grouped by the year they were published.
//
// In `content/` rather than beside the page that draws it, because two surfaces read it and
// they sit on opposite sides of the render: `web/archive-page.ts` builds the page, and
// `web/sidebar.ts` builds the way in. Importing one from the other would close a cycle
// through `web/listing-page.ts`, which renders the sidebar.

import type { Post } from '@/types'

/** The anchor for a year heading. Prefixed, because an HTML id may not begin with a digit. */
export const yearAnchor = (year: number) => `y${year}`

export type ArchiveYear = { year: number; posts: Post[] }

/**
 * Public posts grouped by calendar year, newest year first, newest post first inside it.
 *
 * The year comes from the ISO date's first four characters rather than from a `Date`: the
 * stored value is UTC, `new Date(...).getFullYear()` reads it in the SERVER's zone, and a
 * post published on 1 January at 02:00 UTC files itself under the previous year on a machine
 * set to UTC-7. The string is the value the rest of the site sorts and displays by.
 */
export function byYear(posts: Post[]): ArchiveYear[] {
  const years = new Map<number, Post[]>()
  for (const p of posts) {
    const year = Number(p.date.slice(0, 4))
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
