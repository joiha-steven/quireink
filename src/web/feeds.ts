// The machine-readable surfaces: RSS, sitemap, robots and llms.txt.
//
// All four are plain strings built from the same public post list, and all four are
// gated by a setting the owner controls (`settings.seo`). A disabled feed 404s rather
// than serving an empty document: an empty feed looks like a broken site to a reader's
// aggregator, while a 404 looks like what it is.

import type { HomeSettings, Page, Post, SiteSettings, Note } from '@/types'
import { termSlug } from '@/content/taxonomy'
import { seriesSlug } from '@/content/series-order'
import { clampExcerpt } from '@/utils'

/**
 * ⚠️ CHARACTERS XML FORBIDS OUTRIGHT, which no escape can rescue.
 *
 * XML 1.0 admits tab, newline, carriage return and then nothing below `\u0020`. Everything
 * else in that range — a vertical tab, a form feed, an escape, a NUL — is not a character the
 * format has a spelling for, and neither is half a surrogate pair or `\uFFFE`. A document
 * holding one is rejected WHOLE by a conforming reader: not the item, the feed.
 *
 * So one post whose title carries a stray `\u000B` stops every subscriber's reader updating,
 * and the owner sees nothing wrong — HTML takes the same character without complaint, so the
 * post's own page looks perfect. Measured 2026-09-19: eight such characters in `/feed.xml`
 * from four posts. They arrive by import (old exports and anything pasted out of a word
 * processor carry them), over MCP, and off a clipboard.
 *
 * A SPACE, not a deletion: `\u000B` stands where a break was meant, and dropping it joins the
 * two words either side of it into one.
 */
// eslint-disable-next-line no-control-regex
const XML_FORBIDS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g

const escapeXml = (s: string) =>
  s.replace(XML_FORBIDS, ' ')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;')

const rfc822 = (iso: string) => new Date(iso).toUTCString()
const isoDay = (iso: string) => new Date(iso).toISOString().slice(0, 10)

/**
 * One feed's own identity: the whole site, or a single archive within it.
 *
 * `path` is both the document's URL and its `atom:link rel="self"`, and getting those two
 * out of step is the classic RSS fault — an aggregator that follows `self` to subscribe
 * would land back on the site feed and quietly replace the term the reader chose.
 */
export type FeedChannel = { title: string; description: string; path: string }

/**
 * ONE ENTRY, in the few fields RSS and JSON Feed both need.
 *
 * The builders take this rather than a `Post`, because a note is not a post (ADR 0044) and
 * yet subscribes exactly the same way. Two RSS builders would drift, and the one that
 * drifted would be the notebook's — the one nobody is looking at while testing the other.
 */
export type FeedItem = { title: string; url: string; date: string; summary: string }

/** How many entries a feed carries. One number, so the two formats cannot disagree. */
export const FEED_MAX = 50

export const postItems = (posts: Post[], site: string): FeedItem[] =>
  posts.map((p) => ({
    title: p.title, url: `${site}/${p.slug}`, date: p.date, summary: p.excerpt ?? '',
  }))

/**
 * A note's title, and its kept passage as the summary.
 *
 * Both fall back exactly as the notebook's own cards and `llms.txt` already do —
 * `title || sourceTitle || slug`, and the quote when there is one. Three places describe a
 * note and they describe it the same way; a fourth opinion here is how a subscriber ends up
 * reading a different notebook from the one on the site.
 *
 * There is no body in a note's summary, and deliberately: `getPublicNotes` returns metadata,
 * so filling one would mean a read per note on a document a crawler fetches BECAUSE it is
 * cheap. The sitemap's image rule turns down the same trade for the same reason.
 */
export const noteItems = (notes: Note[], site: string): FeedItem[] =>
  notes.map((n) => ({
    title: n.title || n.sourceTitle || n.slug,
    url: `${site}/notes/${n.slug}`,
    date: n.date,
    summary: n.quote ? clampExcerpt(n.quote) : '',
  }))

/** RSS 2.0. Bodies are deliberately NOT included: a description is the excerpt. */
export function renderFeed(
  entries: FeedItem[], settings: SiteSettings, site: string, channel?: FeedChannel,
): string {
  const { title, description, path } = channel
    ?? { title: settings.title, description: settings.description, path: '/feed.xml' }
  const items = entries.slice(0, FEED_MAX).map((e) => `    <item>
      <title>${escapeXml(e.title)}</title>
      <link>${escapeXml(e.url)}</link>
      <guid isPermaLink="true">${escapeXml(e.url)}</guid>
      <pubDate>${rfc822(e.date)}</pubDate>
      <description>${escapeXml(e.summary)}</description>
    </item>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${escapeXml(site)}</link>
    <description>${escapeXml(description)}</description>
    <language>${escapeXml(settings.language)}</language>
    <atom:link href="${escapeXml(`${site}${path}`)}" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`
}

/** The image sitemap extension. Declared on the `<urlset>` ONLY when an entry uses it. */
const IMAGE_NS = 'http://www.google.com/schemas/sitemap-image/1.1'

/**
 * A post's own images, absolute, for `<image:image>`.
 *
 * The two image FIELDS only — the visible hero and the SEO-only featured image — and
 * nothing scraped out of the body. The frozen tree read every post's full markdown here
 * (`extractImageUrls`) and got away with it because Next cached the sitemap for an hour;
 * this route builds on request, so doing the same would mean one body read per post on
 * every crawl of a document a crawler fetches precisely because it is cheap.
 *
 * Stored refs are store-relative (Invariant 3) and `getPublicPosts` has already expanded
 * them, which leaves either an absolute URL or a root-relative `/uploads/…` path. A
 * sitemap takes absolute URLs only, so the second shape is prefixed with the site.
 */
function postImages(p: Post, site: string): string[] {
  const refs = [p.coverImage, p.featuredImage].filter((u): u is string => Boolean(u))
  return [...new Set(refs)].map((u) => (u.startsWith('/') ? `${site}${u}` : u))
}

export function renderSitemap(
  posts: Post[], pages: Page[], site: string, home: HomeSettings, archive = false, notes: Note[] = [],
): string {
  const url = (loc: string, lastmod?: string, images: string[] = []) =>
    `  <url><loc>${escapeXml(loc)}</loc>${lastmod ? `<lastmod>${isoDay(lastmod)}</lastmod>` : ''}${
      images.map((i) => `<image:image><image:loc>${escapeXml(i)}</image:loc></image:image>`).join('')
    }</url>`
  // Once `/` belongs to a page, that page has two URLs and its own slug 301s to `/`
  // (ADR 0014). Naming both here asks a crawler to index a redirect, so the slug goes and
  // the root stays. The post list, meanwhile, has moved somewhere that is not in either
  // table and would otherwise appear nowhere.
  const homeSlug = home.mode === 'page' ? home.page : ''
  const ownsArchiveSlug = [...posts, ...pages].some((d) => d.slug === 'archive')

  /**
   * Every archive page a reader can reach, with the date of the newest post on it.
   *
   * Terms are read off the PUBLIC posts passed in, never `getCategories`/`getTags`: those
   * two read the whole index, drafts included, while `/category/x` resolves against the
   * public list and 404s otherwise — so a term that survives only on a draft would be a
   * sitemap URL that answers 404. Keyed by SLUG rather than by name, because two names can
   * slugify to one URL and that URL must appear once.
   *
   * `lastmod` is the freshest post in the term: what a term page shows IS its posts, so it
   * changed when the newest of them did. Restored 2026-08-29 with the rest of the parity
   * sitemap; until then a blog's archives appeared nowhere in it.
   */
  const terms = (kind: 'category' | 'tag', pick: (p: Post) => string[]): string[] => {
    const latest = new Map<string, string>()
    for (const p of posts) {
      const when = p.updatedAt ?? p.date
      for (const name of pick(p)) {
        const slug = termSlug(name)
        const seen = latest.get(slug)
        // ISO 8601 in a fixed shape, so a string compare is a date compare.
        if (seen === undefined || when > seen) latest.set(slug, when)
      }
    }
    return [...latest]
      .sort(([a], [b]) => a.localeCompare(b))
      // ENCODED HERE, and only here. A term that no script can slugify keeps its own letters
      // (`content/taxonomy.ts`), which is right for an href a browser encodes on the way out and
      // wrong for a `<loc>`: the sitemap protocol wants the URL escaped as it would be fetched.
      .map(([slug, when]) => url(`${site}/${kind}/${encodeURIComponent(slug)}`, when))
  }

  /**
   * SERIES, on the same terms as a tag — and missing from here until 2026-09-19.
   *
   * `/series/:slug` is a public route with a feed of its own (`web/term-routes.ts`), and no
   * decision anywhere says it should be kept out of the index. It simply was not listed, so a
   * crawler reached a series only by following a link from a post in it.
   *
   * The slug is `seriesSlug`, which keeps the raw name when nothing can be slugified from it,
   * so the encoding above matters here for the same reason.
   */
  const seriesUrls = (): string[] => {
    const latest = new Map<string, string>()
    for (const p of posts) {
      if (!p.series) continue
      const when = p.updatedAt ?? p.date
      const slug = seriesSlug(p.series)
      const seen = latest.get(slug)
      if (seen === undefined || when > seen) latest.set(slug, when)
    }
    return [...latest]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([slug, when]) => url(`${site}/series/${encodeURIComponent(slug)}`, when))
  }

  const entries = [
    url(site),
    ...(home.mode === 'list' ? [] : [url(`${site}${home.listPath}`)]),
    // The archive carries no `lastmod`: it lists every post, so it changed when the newest
    // of them did — which is the date already on the first entry below, and repeating it
    // here would be a second thing to keep in step for no gain.
    //
    // Skipped when a page or post already owns the slug, because then the route serves THAT
    // and the URL is about to be listed below as the document it really is. Naming it twice
    // is a duplicate `<loc>`, which is a sitemap error and not a cosmetic one.
    ...(archive && !ownsArchiveSlug ? [url(`${site}/archive`)] : []),
    ...posts.filter((p) => p.slug !== homeSlug)
      .map((p) => url(`${site}/${p.slug}`, p.updatedAt ?? p.date, postImages(p, site))),
    ...pages.filter((p) => p.slug !== homeSlug).map((p) => url(`${site}/${p.slug}`)),
    // The notebook (ADR 0044): its index once there is anything in it, and each note under
    // its own address. Never mixed into the post entries above.
    ...(notes.length ? [url(`${site}/notes`, notes[0]!.updatedAt ?? notes[0]!.date)] : []),
    ...notes.map((n) => url(`${site}/notes/${n.slug}`, n.updatedAt ?? n.date)),
    ...terms('category', (p) => p.categories),
    ...terms('tag', (p) => p.tags),
    ...seriesUrls(),
  ]
  const body = entries.join('\n')
  // Declared only when it is used: a namespace on a document with no element in it is an
  // unread line on every sitemap a blog without a single image ever serves.
  const ns = body.includes('<image:image>') ? `\n        xmlns:image="${IMAGE_NS}"` : ''
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${ns}>
${body}
</urlset>
`
}

// ----- robots.txt ------------------------------------------------------------------
//
// Three groups, restored 2026-08-29 from the frozen tree's `robots.ts` (tag `v1-final`,
// `v1/src/app/robots.txt/route.ts`) — until then every crawler got one allow-all group.
//
// **Nothing here blocks an AI crawler, and that is deliberate.** The AI list is part of the
// ALLOWED group, exactly as 1.x had it: this software ships `/llms.txt` for those readers,
// and whether a blog wants to be in a model's training set is the OWNER's decision about
// their own writing, not a default a platform gets to make for them. Turning it into a
// block therefore needs a setting and a switch in Settings → SEO beside the others, which
// is a change to the admin, not to this file.
//
// What IS turned away is the SEO/backlink mining tier: they crawl heavily, send no readers,
// and exist to sell the blog's own links back to somebody else.
//
// robots.txt is a politeness contract, not a security control. Only a well-behaved bot
// reads it, which is the whole of what it can shape: crawl budget and bandwidth.

/** Major search engines, named so the welcome is visible in the file rather than implied. */
const SEARCH_BOTS = ['Googlebot', 'Bingbot', 'DuckDuckBot', 'Applebot', 'YandexBot']

/** Answer engines and model crawlers. ALLOWED — see the note above. */
const AI_BOTS = [
  'GPTBot', 'ChatGPT-User', 'OAI-SearchBot', // OpenAI
  'ClaudeBot', 'Claude-Web', 'anthropic-ai', // Anthropic
  'PerplexityBot', 'Perplexity-User', // Perplexity
  'Google-Extended', // Gemini / Vertex AI
  'Applebot-Extended', // Apple Intelligence
  'CCBot', // Common Crawl
  'cohere-ai', 'Meta-ExternalAgent', 'DuckAssistBot', // Cohere, Meta AI, DuckDuckGo AI
]

/** SEO/backlink miners: heavy crawl, no referral value. */
const SCRAPER_BOTS = [
  'AhrefsBot', 'SemrushBot', 'MJ12bot', 'DotBot', 'DataForSeoBot',
  'BLEXBot', 'PetalBot', 'Barkrowler', 'serpstatbot', 'ZoominfoBot',
  'MauiBot', 'magpie-crawler', 'Bytespider', 'ImagesiftBot', 'SeekportBot',
]

export function renderRobots(settings: SiteSettings, site: string): string {
  // One group: its user-agent lines, then its directives.
  const group = (agents: string[], directives: string[]): string =>
    [...agents.map((a) => `User-agent: ${a}`), ...directives].join('\n')
  // The admin is owner-gated anyway; keeping it out of the crawl budget is the point.
  const offLimits = ['Disallow: /admin', 'Disallow: /api']
  const blocks = [
    group([...SEARCH_BOTS, ...AI_BOTS], ['Allow: /', ...offLimits]),
    group(SCRAPER_BOTS, ['Disallow: /']),
    // Everyone else, including whatever good crawler is named next week.
    group(['*'], ['Allow: /', ...offLimits]),
  ]
  if (settings.seo.sitemap) blocks.push(`Sitemap: ${site}/sitemap.xml`)
  return `${blocks.join('\n\n')}\n`
}

/**
 * `llms.txt`: the site as an index a model can read, newest first. Titles and one-line
 * summaries, not bodies — a model that wants the body follows the link.
 */
export function renderLlms(posts: Post[], pages: Page[], settings: SiteSettings, site: string, notes: Note[] = []): string {
  const line = (title: string, slug: string, summary: string) =>
    `- [${title}](${site}/${slug})${summary ? `: ${summary}` : ''}`
  // No excerpt, no summary. It used to fall back to `toPlainText('')`, which is the empty
  // string with two function calls in front of it.
  const postLines = posts.map((p) => line(p.title, p.slug, p.excerpt ? clampExcerpt(p.excerpt) : ''))
  const pageLines = pages.map((p) => line(p.title, p.slug, ''))
  return `# ${settings.title}

${settings.description}

## Posts

${postLines.join('\n')}

## Pages

${pageLines.join('\n')}
${notes.length ? `
## Notes

${notes.map((n) => line(n.title || n.sourceTitle || n.slug, `notes/${n.slug}`, n.quote ? clampExcerpt(n.quote) : '')).join('\n')}
` : ''}`
}
