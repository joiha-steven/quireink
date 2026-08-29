// The machine-readable surfaces: RSS, sitemap, robots and llms.txt.
//
// All four are plain strings built from the same public post list, and all four are
// gated by a setting the owner controls (`settings.seo`). A disabled feed 404s rather
// than serving an empty document: an empty feed looks like a broken site to a reader's
// aggregator, while a 404 looks like what it is.

import type { HomeSettings, Page, Post, SiteSettings } from '@/types'
import { termSlug } from '@/content/taxonomy'
import { toPlainText, clampExcerpt } from '@/utils'

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
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

/** RSS 2.0. Bodies are deliberately NOT included: a description is the excerpt. */
export function renderFeed(
  posts: Post[], settings: SiteSettings, site: string, channel?: FeedChannel,
): string {
  const { title, description, path } = channel
    ?? { title: settings.title, description: settings.description, path: '/feed.xml' }
  const items = posts.slice(0, 50).map((p) => `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${escapeXml(`${site}/${p.slug}`)}</link>
      <guid isPermaLink="true">${escapeXml(`${site}/${p.slug}`)}</guid>
      <pubDate>${rfc822(p.date)}</pubDate>
      <description>${escapeXml(p.excerpt ?? '')}</description>
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
  posts: Post[], pages: Page[], site: string, home: HomeSettings, archive = false,
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
      .map(([slug, when]) => url(`${site}/${kind}/${slug}`, when))
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
    ...terms('category', (p) => p.categories),
    ...terms('tag', (p) => p.tags),
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
export function renderLlms(posts: Post[], pages: Page[], settings: SiteSettings, site: string): string {
  const line = (title: string, slug: string, summary: string) =>
    `- [${title}](${site}/${slug})${summary ? `: ${summary}` : ''}`
  const postLines = posts.map((p) =>
    line(p.title, p.slug, clampExcerpt(p.excerpt ?? toPlainText(''))))
  const pageLines = pages.map((p) => line(p.title, p.slug, ''))
  return `# ${settings.title}

${settings.description}

## Posts

${postLines.join('\n')}

## Pages

${pageLines.join('\n')}
`
}
