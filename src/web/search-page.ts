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
import { searchPosts } from '@/content/posts'
import { getSettings } from '@/content/settings'
import { t } from '@/i18n/i18n'
import { clientIp, rateLimited } from '@/server/rate-limit'
import { renderListing } from '@/web/listing'
import { listingPage } from '@/web/listing-page'

// The canonical pair, NOT a private copy. The copy that used to live here escaped `& < >`
// and nothing else, and line 45 interpolates the reader's own query into an attribute:
// `/search?q=" onfocus=alert(1) autofocus x="` came back as
// `value="" onfocus=alert(1) autofocus x=""`, which is a live event handler on a public page.
// Reproduced against a local instance before this line was written; there is a test for it.
import { escapeAttr, escapeHtml } from '@/utils'

/** Matches `/api/search`. One feature, one cap, whichever half of it a reader reaches. */
const PER_MINUTE = 60

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
  const body = renderListing({
    heading: escapeHtml(tx.search),
    subheading: q ? tx.searchResults.replace('{n}', String(results.length)).replace('{q}', q) : undefined,
    paged: { items: results, page: 1, totalPages: 1 },
    basePath: '/search',
    empty: q ? tx.searchEmpty : tx.searchHint,
  }, settings)
  const form = `<form class="search" action="/search" method="get" role="search">
<input type="search" name="q" value="${escapeAttr(q)}" aria-label="${escapeAttr(tx.search)}">
<button type="submit">${escapeHtml(tx.search)}</button>
</form>`
  return c.html(await listingPage({
    title: `${tx.search} · ${settings.title}`,
    // Out of the index, and this is the one page on the site that has to say so: `/search?q=`
    // mints a URL per query, so a crawler that follows the form finds an unbounded set of
    // near-duplicate listings. There is no canonical here either (`canonicalPath` is left
    // undefined on purpose), and a page with neither was an invitation.
    noindex: true,
    description: tx.searchHint,
    body: form + body,
  }))
}
