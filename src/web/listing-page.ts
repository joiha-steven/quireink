// A list of posts, as a whole page: the shell around `renderListing`, and the decision
// about whether the list is paginated or one continuous timeline.
//
// Split out of `app.ts` when the sidebar landed and pushed that file past 400 lines. The
// router keeps the routing; this keeps what a listing page IS.

import type { SiteSettings } from '@/types'
import { t } from '@/i18n/i18n'
import { escapeHtml } from '@/utils'
import { getSettings, resolveSiteUrl } from '@/content/settings'
import { paginate } from '@/content/paginate'
import { pageCache } from '@/server/cache'
import { renderDocument, pageStyles } from '@/web/layout'
import { renderListing, type ListingView } from '@/web/listing'
import type { ReadyImages } from '@/web/front-card'
import { getMediaRefs } from '@/media/media-refs'
import { collapseBlob } from '@/media/blob'
import { renderSidebar } from '@/web/sidebar'
import { timelineCss } from '@/render/rail-css'
import { ogCardUrl, siteDomain } from '@/render/og'
import { chromeLabels, siteFooter, siteHeader } from '@/web/chrome'
import { getMailStatus } from '@/news/mail'
import { PUBLIC_SHEET, scriptTag } from '@/web/assets'

type Posts = ListingView['paged']['items']

export type ListingPage = {
  title: string
  body: string
  /**
   * The meta description, when the page can say something truer than the site's own line.
   *
   * The default is `settings.description`, and for the home page that is exactly right — it
   * IS the site. Everywhere else it was a bug wearing a default: search, every tag, every
   * category, every series and the 404 all shipped the SAME sentence, so four indexable page
   * kinds carried an identical snippet that described none of them.
   */
  description?: string
  /** Keep this page out of the index. A search results page mints one URL per query. */
  noindex?: boolean
  /** JSON-LD payload from `render/schema.ts`; the caller has already checked the setting. */
  jsonLd?: string
  canonicalPath?: string
  cardTitle?: string
  /** A category or tag page marks its own row in the rail. */
  activeHref?: string
  /** Extra geometry this page needs: the gutter timeline. */
  css?: string
  /**
   * Drop the discovery rail and run the body full width.
   *
   * The front page composes its own rows (ADR 0014), so the rail's blocks would appear
   * twice on the same screen: most-viewed beside most-viewed. It is the one listing surface
   * that is not a feed with a sidebar.
   */
  noRail?: boolean
}

/** Wrap listing markup in the site shell. Shared by home, taxonomy, series and search. */
export async function listingPage(
  { title, body, description, noindex = false, jsonLd, canonicalPath, cardTitle, activeHref,
    css = '', noRail = false }: ListingPage,
): Promise<string> {
  const settings = await getSettings()
  const site = resolveSiteUrl(settings)
  const [{ configured: mailConfigured }, rail] = await Promise.all([
    getMailStatus(), renderSidebar(settings, activeHref),
  ])
  const sidebar = noRail ? { html: '', css: '' } : rail
  return renderDocument(
    settings,
    {
      title,
      description: description ?? settings.description,
      // `follow` and not `none`: the links on a results page are the real posts, and telling
      // a crawler to ignore them would waste the one useful thing the page offers.
      robots: noindex ? 'noindex, follow' : undefined,
      jsonLd,
      canonical: site && canonicalPath !== undefined ? `${site}${canonicalPath}` : undefined,
      // A listing card is two explicit lines rather than a post's title/excerpt/date.
      // Home reads as domain over description; a term page as its name over the domain.
      image: ogCardUrl(settings, site, cardTitle === undefined
        ? { title: siteDomain(site), site: settings.description }
        : { title: cardTitle, site: siteDomain(site) }),
      stylesheet: PUBLIC_SHEET,
    },
    pageStyles(settings, [css, sidebar.css].filter(Boolean).join('\n')),
    // The rail is rendered LAST inside `main`: it is absolutely placed, so DOM order is
    // free, and this way the page heading still leads the document outline.
    `<div class="wrap">
${siteHeader(settings, { mailConfigured, menuInHeader: noRail })}
<div class="with-rail"><main id="content">${body}${sidebar.html}</main></div>
${siteFooter(settings, { mailConfigured })}
</div>`,
    // `core` carries the analytics beacon AND the header's controls, all of which are on
    // every public page. A pageview that only fired on posts would undercount the home
    // page and every listing, which between them are most of a blog's traffic.
    { bodyData: chromeLabels(settings), scripts: scriptTag('core') },
  )
}

/**
 * A feed of posts: the home page and every taxonomy archive.
 *
 * With `features.infiniteScroll` on there is no pagination at all — the whole list is one
 * year-grouped timeline and a deep page number is a 404, because it would be duplicate
 * content under a URL the site does not link to. That is the frozen tree's behaviour, and
 * it is why the fetch-based infinite-scroll island was deleted: there is no next page.
 *
 * Returns null when the page number does not exist, which the router turns into a 404.
 */
/**
 * Which originals have responsive variants, for card thumbnails.
 *
 * Same shape and the same one-table-read as `renderFront`'s: a `<picture>` has no fallback
 * when a source 404s, so a variant may only be offered for an original confirmed to have
 * one. Called only when thumbnails are switched on.
 */
async function readyThumbs(): Promise<ReadyImages> {
  const ready: ReadyImages = new Set()
  for (const r of await getMediaRefs()) if (r.variants) ready.add(collapseBlob(r.url))
  return ready
}

export async function renderFeedBody(
  posts: Posts, page: number, view: Omit<ListingView, 'paged' | 'timeline'>,
): Promise<{ body: string; css: string } | null> {
  const settings: SiteSettings = await getSettings()
  const timeline = settings.features.infiniteScroll
  if (timeline && page > 1) return null
  const paged = timeline
    ? { items: posts, page: 1, totalPages: 1 }
    : paginate(posts, page, settings.postsPerPage)
  // `paginate` CLAMPS an out-of-range page, so an emptiness check never fires: /page/9
  // would silently serve the last page under a ninth URL, which is duplicate content at
  // every number a crawler tries. Compare against the real total instead.
  if (page > paged.totalPages) return null
  // The media table is read ONLY when the owner asked for thumbnails — the same
  // conditional `renderFront` uses for its picture kind, and for the same reason: it is a
  // full table read, and a text list must not start paying for a feature it does not use.
  const ready = settings.postImage.thumb === 'none' ? undefined : await readyThumbs()
  return {
    body: renderListing({ ...view, paged, timeline, ready }, settings),
    // The timeline appears at a MUCH lower width than the sidebar: a date label needs far
    // less gutter than a 250px rail, so it shows on an ordinary laptop.
    css: timeline ? timelineCss(settings.contentWidth) : '',
  }
}

/**
 * The page a reader gets for a URL that is not here.
 *
 * It is a real page in the site shell, and that is not a cosmetic point. A `text/plain` body
 * carries no viewport meta, so a phone laid the two words out at the default 980px desktop
 * width and let the reader pan the page sideways: measured at 390px, the document was 980px
 * wide. Every public HTML miss comes through here, so that is fixed in one place.
 *
 * Never cached, in either cache. `cacheHeaders` already refuses a shared cache anything that
 * is not a 200, and nothing is written to `pageCache`: one entry per URL a crawler invents
 * would fill the map with pages that do not exist.
 */
export async function notFoundPage(): Promise<Response> {
  const settings = await getSettings()
  const s = t(settings.language)
  const html = await listingPage({
    title: `${s.notFoundTitle} · ${settings.title}`,
    description: s.notFoundText,
    // The archive heading, the empty-state voice and the site's one link signature: a miss
    // is an empty listing, so it is dressed as one rather than as a new kind of page.
    body: `<div class="listing-head"><h1>${escapeHtml(s.notFoundTitle)}</h1></div>
<p class="empty">${escapeHtml(s.notFoundText)}</p>
<p class="mt-3"><a class="link-accent" href="/">${escapeHtml(s.backHome)}</a></p>`,
  })
  return new Response(html, {
    status: 404,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })
}

/**
 * The page a reader gets when a handler threw.
 *
 * Until now they got `{"error":"Internal error"}` in the browser window, because `onError`
 * answered every route the same way and every route includes the reading pages. The three
 * strings for this page have been in all six locales since the port and nothing printed
 * them, which is how it was found.
 *
 * Dressed exactly like the 404 for the same reason that one is: it is a real page in the
 * site shell, so a phone gets the viewport meta and does not lay it out at 980px.
 *
 * The fallback is not defensive padding. This runs BECAUSE something threw, and the most
 * likely thing to have thrown is the database — which is what `getSettings` reads. A 500
 * handler that throws gives the reader a blank connection reset, so the second failure
 * answers with a fixed, dependency-free page instead.
 */
export async function errorPage(): Promise<Response> {
  const headers = { 'content-type': 'text/html; charset=utf-8' }
  try {
    const settings = await getSettings()
    const s = t(settings.language)
    const html = await listingPage({
      title: `${s.errorTitle} · ${settings.title}`,
      description: s.errorText,
      body: `<div class="listing-head"><h1>${escapeHtml(s.errorTitle)}</h1></div>
<p class="empty">${escapeHtml(s.errorText)}</p>
<p class="mt-3"><a class="link-accent" href="/">${escapeHtml(s.backHome)}</a></p>`,
    })
    return new Response(html, { status: 500, headers })
  } catch {
    return new Response(
      '<!DOCTYPE html><html><head><meta charset="utf-8">'
      + '<meta name="viewport" content="width=device-width, initial-scale=1">'
      + '<title>Error</title></head><body><h1>Error</h1>'
      + '<p>Something went wrong. Please try again.</p></body></html>',
      { status: 500, headers },
    )
  }
}

/**
 * Serve an HTML route from the page cache, so the cache rule lives in ONE place.
 *
 * The owner can switch the cache off (Settings -> System). Off means neither read nor
 * WRITE: a cache that keeps filling while it is disabled would hand back an hour-old page
 * the moment it was switched back on, which is the opposite of what somebody turning it off
 * is asking for. The shared-cache half of the same switch is in `cache-headers.ts`.
 */
export function cached(key: string, render: () => Promise<string | null>) {
  return async (): Promise<Response> => {
    const on = (await getSettings()).cache.enabled
    const hit = on ? pageCache.get(key) : undefined
    if (hit !== undefined) {
      return new Response(hit, { headers: { 'content-type': 'text/html; charset=utf-8' } })
    }
    const html = await render()
    if (html === null) return notFoundPage()
    if (on) pageCache.set(key, html)
    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
  }
}
