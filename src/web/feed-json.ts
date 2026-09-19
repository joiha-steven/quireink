// JSON Feed 1.1 — the same subscription as `/feed.xml`, in the format a modern reader would
// rather parse. https://www.jsonfeed.org/version/1.1/
//
// It is NOT a second content API. The fields here are the ones a reader's app needs to list
// an entry and open it; anything that wants the writing itself has the site, the RSS feed,
// or (when the owner switches it on) the content API. Keeping it to that is what stops this
// document quietly becoming an unversioned API somebody builds on.
//
// ⚠️ NO CHARACTER SWEEP HERE, and that is not an omission. RSS is XML, and XML 1.0 forbids
// a handful of characters outright — `feeds.ts` replaces them with a space because a feed
// carrying one is rejected WHOLE by a conforming reader. JSON forbids none of them:
// `JSON.stringify` escapes a control character, and since ES2019 it escapes a lone surrogate
// too, so the document it writes is always well-formed. Sweeping them here would mean the
// two feeds disagreed about what the owner wrote, which is a worse fault than a vertical tab.

import type { SiteSettings } from '@/types'
import { FEED_MAX, type FeedChannel, type FeedItem } from '@/web/feeds'

/** RFC 3339, which is what `date_published` takes. */
const rfc3339 = (iso: string) => new Date(iso).toISOString()

/**
 * The document, as a string.
 *
 * Built through `JSON.stringify` rather than by hand: every escaping fault this file could
 * have is one that function does not have, and a feed assembled from template literals is
 * the same class of mistake as HTML assembled from them.
 */
export function renderJsonFeed(
  entries: FeedItem[], settings: SiteSettings, site: string, channel?: FeedChannel,
): string {
  const { title, description, path } = channel
    ?? { title: settings.title, description: settings.description, path: '/feed.json' }
  // The author block is omitted entirely when there is no name, rather than sent empty: a
  // reader's app prints whatever is in `authors[0].name`, and an empty string there shows as
  // a byline with nothing after it.
  const name = settings.author.name.trim()
  const authors = name
    ? [settings.author.url.trim() ? { name, url: settings.author.url.trim() } : { name }]
    : undefined
  return `${JSON.stringify({
    version: 'https://jsonfeed.org/version/1.1',
    title,
    home_page_url: site,
    feed_url: `${site}${path}`,
    description,
    language: settings.language,
    ...(authors ? { authors } : {}),
    items: entries.slice(0, FEED_MAX).map((e) => ({
      // The entry's own URL. `id` has to be unique and permanent, and a renamed slug leaves
      // a 301 behind (`server/redirects.ts`), so the address a reader already has keeps
      // working — which is the whole of what permanent means here.
      id: e.url,
      url: e.url,
      title: e.title,
      date_published: rfc3339(e.date),
      ...(e.summary ? { summary: e.summary } : {}),
    })),
  }, null, 2)}\n`
}
