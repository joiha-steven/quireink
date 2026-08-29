// JSON-LD structured data: the `seo.autoSchema` setting, finally attached to something.
//
// The setting shipped in `SeoSettings` with a default of TRUE and a line in the admin
// promising "structured data for Google: WebSite on the home page, BlogPosting on each
// post". Nothing read it. `grep -rn 'ld+json' src/` returned nothing at all, and
// `docs/seo-pwa.md` recorded it honestly under "not carried over" — but the owner's own
// settings screen did not, so it read as a feature that was on. A switch wired to nothing
// is worse than a missing feature: the missing one asks to be built, this one lies.
//
// TWO shapes only, matching what the setting says. Pages (About, Colophon) get none: a
// `WebPage` object that restates the `<title>` and the canonical adds no fact a crawler did
// not already have from the tags beside it, and every object here has to earn its bytes.
//
// ABSOLUTE URLs or nothing. `resolveSiteUrl` returning empty means the owner has not told
// the software where it lives, and the same rule the canonical follows applies here: no
// schema is better than schema full of `http://localhost:3000`. That exact string reached
// production once already, in the feed and the sitemap.

import type { Post, SiteSettings } from '@/types'

/**
 * The payload, ready for a `<script type="application/ld+json">`.
 *
 * `<` becomes its `\u003c` escape so no value can close the script element that carries
 * it. Every string in here is owner-authored — a post title, a site description — exactly
 * the input that reaches this and exactly why it is escaped rather than trusted. JSON
 * string escapes are legal inside JSON-LD, so a reader parses back the original character.
 */
const payload = (obj: Record<string, unknown>): string =>
  JSON.stringify(obj).replace(/</g, '\\u003c')

/**
 * `WebSite`, for the home page and nowhere else.
 *
 * `potentialAction` is the sitelinks search box, and it is offered only when the owner has
 * search switched ON: describing a search endpoint that answers 404 is worse than
 * describing none. The `{search_term_string}` brace pair is Google's template syntax and
 * has to survive verbatim, which is why it is built here and not run through any escaper.
 */
export function websiteSchema(settings: SiteSettings, site: string): string | null {
  if (!site) return null
  const obj: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: settings.title,
    url: `${site}/`,
    inLanguage: settings.language,
  }
  if (settings.description) obj.description = settings.description
  if (settings.features.search) {
    obj.potentialAction = {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${site}/search?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    }
  }
  return payload(obj)
}

/**
 * `BlogPosting`, for one post.
 *
 * `dateModified` is the real one and only when there is one: `updatedAt` is unset until a
 * post has actually been saved again, and repeating `datePublished` into it would tell a
 * crawler every post was edited the moment it appeared. The article's meta line already
 * refuses to print "Updated" for a save within 24 hours of publishing for the same reason —
 * this is that judgement in a second place, and both read the same column.
 *
 * `author` IS emitted now, and only when there is a real name to emit.
 *
 * There was no owner-name setting until 2026-08-29 — single owner (ADR 0002), and the only
 * name on record was `users.username`, which is half a credential and never leaves the
 * server — so every BlogPosting this software had ever produced went out authorless, on
 * every blog. This comment used to say "when a display name exists, an author belongs here
 * as a Person"; `settings.author.name` is that display name, and this is that Person.
 *
 * Absent when the name is '' rather than emitted empty: a blank `author` is a worse claim
 * than no claim. `publisher` carries the site either way, which is true regardless.
 */
export function blogPostingSchema(
  post: Post,
  settings: SiteSettings,
  site: string,
  opts: { description?: string; image?: string },
): string | null {
  if (!site) return null
  const url = `${site}/${post.slug}`
  const obj: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.metaTitle || post.title,
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    datePublished: post.date,
    inLanguage: settings.language,
    publisher: { '@type': 'Organization', name: settings.title },
  }
  if (settings.author.name) {
    // `url` only when the owner gave one — `sameAs` would be the field for a profile
    // elsewhere, and guessing which of the two a link is would be guessing.
    obj.author = settings.author.url
      ? { '@type': 'Person', name: settings.author.name, url: settings.author.url }
      : { '@type': 'Person', name: settings.author.name }
  }
  if (post.updatedAt && post.updatedAt !== post.date) obj.dateModified = post.updatedAt
  if (opts.description) obj.description = opts.description
  if (opts.image) obj.image = opts.image
  if (post.categories.length) obj.articleSection = post.categories[0]
  if (post.tags.length) obj.keywords = post.tags.join(', ')
  return payload(obj)
}
