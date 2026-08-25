// What `/` serves, and what happens to the post list when it is no longer there. ADR 0014.
//
// The branch lives here rather than in `app.ts` for two reasons. The obvious one is size:
// `app.ts` is a route table and was already near its 400-line cap. The real one is that
// NEITHER of these decisions can be made when the routes are registered. `createApp()` runs
// once, at boot, and the owner changes the mode at runtime — so a route table built from
// settings would need a restart to take effect, and would silently serve the old shape until
// it got one. Both branches are therefore resolved per request, inside routes that already
// exist: `/` and the `/{slug}` catch-all.

import { getPublicPosts } from '@/content/posts'
import { getSettings, resolveSiteUrl } from '@/content/settings'
import { websiteSchema } from '@/render/schema'
import { t } from '@/i18n/i18n'
import { renderArticle } from '@/web/article'
import { listingPage, renderFeedBody } from '@/web/listing-page'
import { renderFront } from '@/web/front'

/**
 * Page N of the post list, wherever it currently lives.
 *
 * Lifted out of `app.ts` unchanged except for the canonical, which now has to ask where the
 * list is: page 1 is `/` while the list owns the homepage and `listPath` once it does not.
 * Deeper pages keep `/page/{n}`, which ADR 0014 deliberately leaves where it is.
 */
export async function renderPostList(page: number): Promise<string | null> {
  const settings = await getSettings()
  const built = await renderFeedBody(await getPublicPosts(), page, {
    basePath: '', empty: t(settings.language).emptyPosts,
  })
  if (!built) return null
  const listRoot = settings.home.mode === 'list' ? '/' : settings.home.listPath
  // `WebSite` belongs to the home page and only to the home page — page 2 of the list is not
  // the site. When the list is NOT the homepage (`front` mode owns `/`), this surface is a
  // listing like any other and `renderFront` carries the object instead.
  const isHome = page === 1 && listRoot === '/'
  return listingPage({
    title: page === 1 ? settings.title : `${settings.title} · page ${page}`,
    jsonLd: isHome && settings.seo.autoSchema
      ? websiteSchema(settings, resolveSiteUrl(settings)) ?? undefined
      : undefined,
    body: built.body,
    css: built.css,
    canonicalPath: page === 1 ? listRoot : `/page/${page}`,
  })
}

/**
 * The body of `/`.
 *
 * A chosen page renders through `renderArticle`, the same function the `/{slug}` catch-all
 * uses, so the reading view, the rail and the markup are the page's own rather than a second
 * rendering of it that could drift.
 *
 * A page that is missing, unpublished, trashed or simply unset falls back to the list. This
 * is the one place where falling back beats being correct: `renderArticle` returns null for
 * all four cases, and the honest response to a null would be a 404 — on the homepage, which
 * is every crawler's entry point and the first thing a reader sees. A slug can stop being
 * public without anybody revisiting this setting (trash it, unpublish it, schedule it
 * forward), so the failure is ordinary rather than exotic.
 */
export async function renderHome(): Promise<string | null> {
  const { home } = await getSettings()
  if (home.mode === 'page' && home.page) {
    const page = await renderArticle(home.page)
    if (page !== null) return page
  }
  if (home.mode === 'front') {
    const front = await renderFront()
    if (front !== null) return front
  }
  return renderPostList(1)
}

/**
 * What a `/{slug}` request means once `/` may belong to something else.
 *
 * `list` — the slug is where the post list now lives.
 * `home` — the slug IS the homepage, so `/` is its canonical URL and this is a duplicate.
 * `null` — an ordinary post or page; the caller carries on as before.
 */
export type SlugRole = 'list' | 'home' | null

export async function slugRole(slug: string): Promise<SlugRole> {
  const { home } = await getSettings()
  if (home.mode === 'list') return null
  // The list first. If the owner points the list at the same slug as the homepage the list
  // wins, because the homepage is still reachable at `/` and the list would otherwise have
  // no URL at all.
  if (slug === home.listPath.slice(1)) return 'list'
  return home.mode === 'page' && home.page && slug === home.page ? 'home' : null
}

// `listSlug()` used to live here, and its own comment named two callers it did not have:
// the slug guard and the sitemap each derive the fact inline, in the file that owns the
// concern, and each needs a different shape of it (`slugs.ts` wants the bare slug, the
// sitemap wants the path with its slash). A shared helper that neither would use is not
// deduplication, it is a third place to keep in step.
