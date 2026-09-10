// Traffic-channel classification, ported from the `analytics_channel(host)` plpgsql
// function: three buckets by referrer host, direct when there is none.
//
// Pure and dependency-free, which is the point: the classification was the one part of
// the SQL function with judgement in it, and it is now directly testable.
//
// Every host pattern is ANCHORED to a label boundary and to the end of the host. The
// original regexes were bare substrings, copied verbatim from the migration, and a
// substring reads too much: `google\.` matched `mail.google.com`, `docs.google.com` and
// Gmail's Android app (`com.google.android.gm`, the host of an `android-app://` referrer)
// as search, and `t\.co` matched `microsoft.com`, `chatgpt.com` and `producthunt.com` as
// social. `(^|\.)host$` matches the host and its subdomains and nothing else.

export type Channel = 'direct' | 'search' | 'social' | 'referral'

/**
 * Google is the exception to "any subdomain": only the search faces count, because the
 * same registrable domain serves Mail, Docs, Drive and Sites, and a link opened from any of
 * those is a referral. The TLD varies by country (`google.com.vn`, `google.co.uk`).
 */
const GOOGLE_SEARCH = /^(www\.)?google\.[a-z]{2,3}(\.[a-z]{2})?$/i

const SEARCH = new RegExp(
  '(^|\\.)('
  + [
    'bing\\.com', 'search\\.yahoo\\.com', 'search\\.yahoo\\.co\\.jp', 'duckduckgo\\.com',
    'yandex\\.(ru|com|com\\.tr)', 'baidu\\.com', 'ecosia\\.org', 'search\\.brave\\.com',
    'startpage\\.com', 'coccoc\\.com', 'naver\\.com',
  ].join('|')
  // `search.` as a leading label keeps the long tail (`search.seznam.cz`, `search.aol.com`)
  // the original's bare `search\.` was there for, minus `research.example.com`.
  + ')$|(^|\\.)search\\.',
  'i',
)

const SOCIAL = new RegExp(
  '(^|\\.)('
  + [
    'facebook\\.com', 'fb\\.com', 'fb\\.me', 'messenger\\.com', 'instagram\\.com', 'threads\\.net',
    'threads\\.com', 'twitter\\.com', 'x\\.com', 't\\.co', 'linkedin\\.com', 'lnkd\\.in',
    'reddit\\.com', 'redd\\.it', 'youtube\\.com', 'youtu\\.be', 'pinterest\\.[a-z]{2,3}(\\.[a-z]{2})?',
    'tiktok\\.com', 'telegram\\.org', 't\\.me', 'whatsapp\\.com', 'vk\\.com', 'zalo\\.me',
  ].join('|')
  // Mastodon has no one host: an instance is `mastodon.social`, `mastodon.online`, …
  + ')$|(^|\\.)mastodon\\.',
  'i',
)

/**
 * The host of an `android-app://` referrer is a package name, and Android sends one when a
 * link is opened from inside an app. None of them ends in a domain, so the patterns above
 * see every one as a referral — right for Gmail, wrong for the apps that ARE a social
 * network or a search box. The Google app is the search one; Gmail is deliberately absent.
 */
const ANDROID_APPS: Record<string, Channel> = {
  'com.google.android.googlequicksearchbox': 'search',
  'com.facebook.katana': 'social',
  'com.facebook.orca': 'social',
  'com.instagram.android': 'social',
  'com.zing.zalo': 'social',
  'com.twitter.android': 'social',
  'com.linkedin.android': 'social',
  'com.reddit.frontpage': 'social',
  'org.telegram.messenger': 'social',
}

/** No referrer host means the visitor typed the URL or came from inside the site. */
export function channelOf(host: string | null | undefined): Channel {
  if (!host) return 'direct'
  const h = host.trim().toLowerCase()
  const app = ANDROID_APPS[h]
  if (app) return app
  if (GOOGLE_SEARCH.test(h) || SEARCH.test(h)) return 'search'
  if (SOCIAL.test(h)) return 'social'
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
