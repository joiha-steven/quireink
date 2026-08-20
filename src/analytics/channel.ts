// Traffic-channel classification, ported from the `analytics_channel(host)` plpgsql
// function. The three regexes are copied verbatim from the migration so a visitor that
// counted as "search" yesterday still counts as "search" tomorrow; the only change is
// Postgres `~*` becoming a JavaScript case-insensitive test.
//
// Pure and dependency-free, which is the point: the classification was the one part of
// the SQL function with judgement in it, and it is now directly testable.

export type Channel = 'direct' | 'search' | 'social' | 'referral'

const SEARCH = /google\.|bing\.|yahoo\.|duckduckgo|yandex|baidu|ecosia\.|brave\.|startpage|search\./i
const SOCIAL = /facebook|fb\.com|instagram|twitter|(^|\.)x\.com|t\.co|linkedin|reddit|youtu|pinterest|tiktok|threads\.net|mastodon|telegram|t\.me|whatsapp|(^|\.)vk\.com/i

/** No referrer host means the visitor typed the URL or came from inside the site. */
export function channelOf(host: string | null | undefined): Channel {
  if (!host) return 'direct'
  if (SEARCH.test(host)) return 'search'
  if (SOCIAL.test(host)) return 'social'
  return 'referral'
}

/**
 * Subdomain labels that are plumbing, not identity: `l.facebook.com` is Facebook's link
 * shim, `m.` and `touch.` are its phone faces, `out.` and `away.` are redirectors, `amp.`
 * is a cache. A reader arriving through any of them arrived from the same place, and the
 * Top-referrers list splitting one source five ways made the site's largest source look
 * like five small ones — Facebook was rows 1, 4, 5, 6 and 8 of manhhung.me's list.
 *
 * A closed set, deliberately. Folding EVERY subdomain to the registrable domain would
 * merge `news.google.com` (a real, distinct source) into `google.com`, and computing
 * registrable domains needs the public-suffix list, which is a dependency this feature
 * does not earn. An unknown label stays: wrong is worse than long.
 */
const PLUMBING = new Set(['www', 'm', 'l', 'lm', 'mobile', 'touch', 'web', 'out', 'away', 'amp', 'old', 'new', 'np'])

/**
 * The host a reader would NAME as the source: lowercased, trailing dot dropped, and
 * plumbing labels peeled while what remains is still a domain (`l.m.facebook.com` →
 * `facebook.com`, but `www.com` keeps its `www`, because peeling it would leave a TLD).
 *
 * Display-time only. The stored `referrer_host` stays exactly as the browser sent it, so
 * this can be corrected later without having destroyed anything — and so folding applies
 * to every row already in the table, not just rows written after the fold existed.
 */
export function canonicalHost(host: string): string {
  let h = host.trim().toLowerCase().replace(/\.$/, '')
  for (;;) {
    const dot = h.indexOf('.')
    const label = dot === -1 ? '' : h.slice(0, dot)
    const rest = h.slice(dot + 1)
    if (!label || !PLUMBING.has(label) || !rest.includes('.')) return h
    h = rest
  }
}
