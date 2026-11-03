// A renamed category, tag or series takes its address with it.
//
// Renaming rewrote the posts' terms and nothing that pointed at the term (2026-11-03): the front
// page's strip for a category is stored by NAME and drew nothing under the new one, a menu item
// pointing at `/category/old` became a 404, and the old listing — which the sitemap had been
// handing to search engines — answered 404 with no redirect, where renaming a post has always left
// a 301. All three follow the rename here, after the rows have moved.
//
// The same rule as for a post (`savePost`): live content wins. The new address loses any redirect
// it had (a rename back would otherwise be refused as a loop, and `/a` would keep sending readers
// to a listing that no longer exists), and a published post that carries an old name again takes
// its address back (`clearTermRedirects`).
import type { MenuItem, SiteSettings } from '@/types'
import { getSettings, saveSettings } from '@/content/settings'
import { termSlug } from '@/content/taxonomy'
import { seriesSlug } from '@/content/series-order'
import { clearRedirectForPath, saveRedirect, RedirectInputError } from '@/server/redirects'
import { normalizePath } from '@/server/redirect-path'

export type RenamedKind = 'category' | 'tag' | 'series'

const BASE: Record<RenamedKind, string> = { category: '/category', tag: '/tag', series: '/series' }

/** The listing a term is published at, as the public pages link it. */
export const termPath = (kind: RenamedKind, name: string): string =>
  `${BASE[kind]}/${kind === 'series' ? seriesSlug(name) : termSlug(name)}`

const pointsAt = (item: MenuItem, path: string): boolean =>
  item.href.startsWith('/') && normalizePath(item.href) === path

export async function followRename(kind: RenamedKind, from: string, to: string): Promise<void> {
  const was = termPath(kind, from)
  const now = termPath(kind, to)
  const settings = await getSettings()
  const patch: Partial<SiteSettings> = {}

  const strips = settings.home.front.strips
  if (kind === 'category' && strips.some((s) => s.category === from)) {
    patch.home = {
      ...settings.home,
      front: { ...settings.home.front, strips: strips.map((s) => (s.category === from ? { ...s, category: to } : s)) },
    }
  }
  if (was !== now && settings.menu.some((m) => pointsAt(m, was))) {
    // The label moves too when it was the term's own name; one the owner wrote is theirs.
    patch.menu = settings.menu.map((m) => (pointsAt(m, was) ? { label: m.label === from ? to : m.label, href: now } : m))
  }
  if (Object.keys(patch).length > 0) await saveSettings(patch)

  if (was === now) return
  await clearRedirectForPath(now)
  try {
    await saveRedirect({ source: was, destination: now, permanent: true })
  } catch (error) {
    // A rule the owner made on that path wins; the rename stands without its redirect.
    if (!(error instanceof RedirectInputError)) throw error
    console.error(`[WARN] term-rename.followRename(${was} → ${now}): ${error.message}`)
  }
}

/** A published post carries these terms: their listings are live, and no redirect may shadow them. */
export async function clearTermRedirects(post: { categories: string[]; tags: string[]; series?: string | null }): Promise<void> {
  for (const c of post.categories) await clearRedirectForPath(termPath('category', c))
  for (const t of post.tags) await clearRedirectForPath(termPath('tag', t))
  if (post.series) await clearRedirectForPath(termPath('series', post.series))
}
