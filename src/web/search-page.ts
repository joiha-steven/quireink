// GET /search — the same results as `/api/search`, server-rendered.
//
// The HTML half of one feature. A reader with no JavaScript loses the overlay and keeps
// the search, which is the only reason this exists as a page at all.
//
// NOT cached, deliberately: the key would be the query string, which is unbounded, and a
// cache an anonymous visitor can fill is a memory leak with a nicer name. That is also why
// it needs the cap below — an uncached FTS5 query anybody can issue in a loop, on a runtime
// with one thread, is a lever on the whole site rather than on one page.

import type { Context } from 'hono'
import { getPublicPosts, searchPosts } from '@/content/posts'
import { getSettings } from '@/content/settings'
import { formatDate, t } from '@/i18n/i18n'
import type { Dict } from '@/locales/types'
import type { SiteSettings } from '@/types'
import { ICONS } from '@/icons'
import { tagText, termSlug } from '@/content/taxonomy'
import { langAttr } from '@/content/translations'
import { postName } from '@/content/untitled'
import { clientIp, rateLimited } from '@/server/rate-limit'
import { renderListing } from '@/web/listing'
import { listingPage } from '@/web/listing-page'

// The canonical escaper, NOT a private copy. The copy that used to live here escaped `& < >`
// and nothing else, and the form (`searchBox` below) interpolates the reader's
// own query into an attribute: `/search?q=" onfocus=alert(1) autofocus x="` came back as
// `value="" onfocus=alert(1) autofocus x=""`, which is a live event handler on a public page.
// Reproduced against a local instance before this line was written; there is a test for it.
import { escapeAttr, escapeHtml, fill } from '@/utils'

/** Matches `/api/search`. One feature, one cap, whichever half of it a reader reaches. */
const PER_MINUTE = 60

/** How many tags the empty page offers, and how many recent posts under them. */
const TAG_CHIPS = 8
const RECENT_POSTS = 5

/**
 * The search box: one form, the button INSIDE the input's border at its right end.
 * Self-contained (classes in `search-page.css.ts`), so the menu drawer can draw the same
 * thing. The input keeps `aria-label`; the icon button takes its name from `search`.
 * `q` is escaped with the canonical attribute escaper (a reflected query once ran script).
 */
export function searchBox(s: Pick<Dict, 'search'>, q = ''): string {
  const name = escapeAttr(s.search)
  return `<form class="qbox" action="/search" method="get" role="search">`
    + `<input type="search" name="q" value="${escapeAttr(q)}" placeholder="${name}" aria-label="${name}">`
    + `<button type="submit" aria-label="${name}" title="${name}">`
    + `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"`
    + ` stroke-linejoin="round" aria-hidden="true">${ICONS.search}</svg></button></form>`
}

/** With no query: the busiest tags, then the newest public posts. One read of the public posts serves both. */
async function suggestions(tx: Dict, settings: SiteSettings): Promise<string> {
  const posts = await getPublicPosts()
  // Busiest first, ties alphabetical: the order the sidebar's tag list uses.
  const counts = new Map<string, number>()
  for (const p of posts) for (const tag of p.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  const chips = [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, TAG_CHIPS)
  const tagBlock = chips.length
    ? `<h2 class="qs-label">${escapeHtml(tx.tagsTitle)}</h2><ul class="qs-tags">${
      chips.map((c) => `<li><a href="/tag/${escapeAttr(termSlug(c[0]))}">${escapeHtml(tagText(c[0]))}</a></li>`).join('')
    }</ul>`
    : ''
  const recent = posts.slice(0, RECENT_POSTS)
  const recentBlock = recent.length
    ? `<h2 class="qs-label">${escapeHtml(tx.frontLatest)}</h2><ul class="qs-recent">${
      recent.map((p) => {
        const when = formatDate(p.date, settings.language, settings.timezone)
        const cat = settings.features.categoryLabel ? p.categories[0] : undefined
        return `<li><a href="/${escapeAttr(p.slug)}"${langAttr(p, settings.language)}>${escapeHtml(postName(p))}</a>`
          + `<small>${escapeHtml(cat ? `${cat} · ${when}` : when)}</small></li>`
      }).join('')
    }</ul>`
    : ''
  return tagBlock + recentBlock
}

export async function handleSearchPage(c: Context): Promise<Response> {
  if (rateLimited(`search-page:${clientIp(c)}`, PER_MINUTE)) {
    return c.text('Too many requests', 429)
  }
  const settings = await getSettings()
  const tx = t(settings.language)
  const q = (c.req.query('q') ?? '').trim().slice(0, 200)
  const results = q ? await searchPosts(q) : []
  // The count line comes from the locale table. It was assembled here in English, with an
  // English plural rule, on a site that ships six languages — so a Vietnamese blog read
  // "12 results for" under a heading that said "Tìm kiếm". Same class of bug as the
  // hardcoded " min" reading-time suffix, and the same fix.
  // The box UNDER its heading (FIXLIST 8.6): it stood above "Search", the one page where the
  // heading was not the first thing on it.
  const head = `<header class="listing-head"><h1>${escapeHtml(tx.search)}</h1></header>`
  const body = !q ? head + searchBox(tx) + await suggestions(tx, settings) : renderListing({
    headingHtml: escapeHtml(tx.search),
    afterHead: searchBox(tx, q)
      + (q ? `<p class="meta search-count">${escapeHtml(fill(tx.searchResults, { n: results.length, q }))}</p>` : ''),
    paged: { items: results, page: 1, totalPages: 1 },
    basePath: '/search',
    empty: tx.searchEmpty,
  }, settings)
  return c.html(await listingPage({
    title: `${tx.search} · ${settings.title}`,
    // Out of the index, and this is the one page on the site that has to say so: `/search?q=`
    // mints a URL per query, so a crawler that follows the form finds an unbounded set of
    // near-duplicate listings. There is no canonical here either (`canonicalPath` is left
    // undefined on purpose), and a page with neither was an invitation.
    noindex: true,
    noChips: true,
    description: tx.searchHint,
    body,
  }))
}
