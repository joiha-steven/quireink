// WHAT AN ARTICLE PAGE'S HEAD SAYS — title, description, canonical, card, schema, language.
//
// Split out of `article.ts` on 2026-09-19, when that file reached its 400-line ceiling. The
// seam is between what a page IS and what it SAYS ABOUT ITSELF: everything left in `article.ts`
// assembles the article a reader sees, and this assembles the block only a crawler, a scraper
// and a screen reader ever read. They meet at one call.

import type { Head } from '@/web/layout'
import type { Post, SiteLang, SiteSettings } from '@/types'
import type { Sibling } from '@/content/translations'
import { alternateLinks } from '@/content/translations'
import { clampExcerpt } from '@/utils'
import { formatDate } from '@/i18n/i18n'
import { ogImageUrl } from '@/render/og'
import { blogPostingSchema } from '@/render/schema'
import { PUBLIC_SHEET } from '@/web/assets'

/** How much of a post the share card carries: six lines at the card's body size. A card is
 *  read whole, so it is not bound by where a search result stops. */
const OG_DESC_MAX = 320

export function articleHead(a: {
  settings: SiteSettings
  site: string
  /** The post or the page, whichever this address answered with. */
  item: { slug: string; title: string; content: string }
  /** Set only for a post: a page has no card type, no schema and no cover. */
  post: (Post & { content: string }) | null
  canonicalPath?: string
  description: string
  /** The body as plain text, computed once by the caller and memoised there. */
  plainBody: () => string
  selfPath: string
  pieceLang: SiteLang
  siblings: readonly Sibling[]
}): Head {
  const { settings, site, item, post, canonicalPath, description, plainBody } = a
  return {
    title: `${post?.metaTitle || item.title} · ${settings.title}`,
    description,
    canonical: site ? `${site}${canonicalPath ?? `/${item.slug}`}` : undefined,
    lang: a.pieceLang,
    // hreflang, and this piece is in its own set — `content/translations.ts` says why an
    // asymmetric set is one a crawler may ignore whole.
    extra: alternateLinks({ lang: a.pieceLang, path: a.selfPath }, a.siblings, site, settings.language),
    // Absolute, always: `resolveSiteUrl` falls back to SITE_URL and then to localhost,
    // and a relative og:image is ignored by every scraper.
    image: ogImageUrl(settings, site, {
      title: post?.metaTitle || item.title,
      featuredImage: post?.featuredImage,
      // The CARD's description, which is not the search snippet and should not be capped
      // like one. `description` above is bounded by META_DESC_MAX (157) because a
      // meta description longer than that is truncated by the engine anyway; the card has
      // six lines of its own to fill, and a share preview that stops mid-thought after two
      // of them is the reason it looked thin. An AUTHORED meta description still wins --
      // those are words somebody chose -- and only the derived case runs longer.
      desc: post ? clampExcerpt(post.metaDescription || plainBody(), OG_DESC_MAX) : undefined,
      date: post ? formatDate(post.date, settings.language, settings.timezone) : undefined,
    }),
    ogType: post ? 'article' : 'website',
    // Only a POST, and only when the owner has the setting on. A page (About, Colophon)
    // gets none: a `WebPage` object restating the title and the canonical tells a crawler
    // nothing the tags beside it did not already say.
    jsonLd: post && settings.seo.autoSchema
      ? blogPostingSchema(post, settings, site, {
          description,
          // The same card the OG tags point at, so the two never disagree about what the
          // picture for this post is.
          image: ogImageUrl(settings, site, {
            title: post.metaTitle || item.title,
            featuredImage: post.featuredImage,
          }),
        }) ?? undefined
      : undefined,
    stylesheet: PUBLIC_SHEET,
  }
}
