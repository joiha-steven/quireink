// Privacy-light, self-hosted page-view recording.
//
// WHY this design:
// - No cookies, no localStorage, no third party. A visitor is identified only by a salted
//   hash of (IP + user-agent), so NO raw IP / PII is ever stored — just an opaque token
//   used to count uniques. The salt never leaves the server, so the token is stable enough
//   for accurate unique counts and useless outside this instance.
// - One row per view, plus two privacy-light source fields: the external referrer HOST
//   only (never the full URL/path/query; NULL for direct/internal) and the ISO country
//   code from the edge. No IP, no fingerprint.
// - Bots are dropped by user-agent. Admin/API paths are never tracked, and the owner's own
//   visits are excluded by the route.
// - Retention: events are kept FOREVER (no purge) — the owner wants the full history.
// - Scroll depth: a separate `analytics_scroll` table holds one "% of page reached before
//   leaving" sample per post-leave, so a missed pagehide loses a depth sample but never
//   a view.
//
// Writes go through the buffer (Invariant 7), never straight to the database. The frozen
// tree inserted inline and carried a retry for a pre-migration schema; there is one schema
// here, so that fallback is gone.

import { createHash } from 'node:crypto'
import { parseUa } from '@/analytics/ua'
import { bufferEvent, bufferScroll } from '@/analytics/buffer'
import { nowMs } from '@/store/db'
import { one } from '@/store/query'
import { getSettings } from '@/content/settings'
import { serverSecret } from '@/auth/secret'

// Common crawlers / preview bots — don't count them as readers.
const BOT_RE = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|quora|pinterest|vkshare|whatsapp|telegram|discord|headless|lighthouse|pagespeed|gtmetrix|monitor|uptime|curl|wget|python-requests|axios|node-fetch|gptbot|oai-searchbot|chatgpt|claudebot|claude-web|anthropic|ccbot|perplexity|bytespider|amazonbot|google-extended|meta-external|scrapy|semrush|ahrefs|dataforseo/i

export function isBot(ua: string): boolean {
  return !ua || BOT_RE.test(ua)
}

// Stable per-visitor token: salted hash of IP + UA. The salt never leaves the
// server, and the raw IP/UA are discarded — only this 16-byte hex is stored.
//
// The salt was `process.env.AUTH_SECRET ?? 'quire'`. `AUTH_SECRET` leaves with next-auth
// (06-auth.md), and the fallback was the worse half anyway: a salt printed in the source
// is one anybody can reuse to try candidate IP/UA pairs against a stolen table until one
// matches. `serverSecret` generates its own on first use, so there is no unset case.
function visitorHash(ip: string, ua: string): string {
  return createHash('sha256')
    .update(`${serverSecret('analytics-visitor')}|${ip}|${ua}`)
    .digest('hex')
    .slice(0, 32)
}

// Normalize to a bare, bounded pathname (no query/hash). Returns null for paths
// we never track (admin, api) so the caller can skip cheaply.
export function normalizePath(raw: string): string | null {
  let p = (raw || '').split('?')[0]!.split('#')[0]!.trim()
  if (!p.startsWith('/')) return null
  if (p.startsWith('/admin') || p.startsWith('/api')) return null
  if (p.length > 1) p = p.replace(/\/+$/, '') // strip trailing slash (keep "/")
  return p.slice(0, 512) || '/'
}

/**
 * Is this a path the site can actually serve? The beacon is an open POST — the shape cap
 * in `normalizePath` bounded each row at 512 bytes but not the SET of rows, so any script
 * could seed `analytics_events` with fabricated paths: junk in the top-pages table,
 * unbounded distinct-path growth, all rate-limited per IP and therefore not bounded at
 * all. The route list here mirrors `web/app.ts`; a single-segment path must be a real
 * post, page, or the list's own address. One indexed point-lookup per view, on the
 * buffered (never request-blocking) side — see Invariant 7.
 */
export async function pathIsServable(p: string): Promise<boolean> {
  if (p === '/' || p === '/search') return true
  if (/^\/page\/\d+$/.test(p)) return true
  // Term and series archives keep a shape check only: validating term existence would
  // couple analytics to the taxonomy tables for rows that are clearly labelled already.
  if (/^\/(category|tag|series)\/[^/]+(\/page\/\d+)?$/.test(p)) return true
  const slug = p.slice(1)
  if (slug === '' || slug.includes('/')) return false
  const { home } = await getSettings()
  if (home.mode !== 'list' && home.listPath === p) return true
  return !!one<{ slug: string }>(`select slug from posts where slug = ? and deleted_at is null`, slug)
    || !!one<{ slug: string }>(`select slug from pages where slug = ? and deleted_at is null`, slug)
}

// Record one page view. Never throws (analytics must not break a page load).
// referrerHost = external referrer host only (no path/query; '' = direct/internal);
// country = ISO-3166 alpha-2 from the edge. Both are privacy-light and best-effort.
export async function recordView(
  rawPath: string,
  ip: string,
  ua: string,
  referrerHost = '',
  country = '',
  /** Multi-touch, reported by the browser. The only way to see an iPad; see `parseUa`. */
  touch = false,
): Promise<void> {
  try {
    if (isBot(ua)) return
    const path = normalizePath(rawPath)
    if (!path || !(await pathIsServable(path))) return
    const { device, browser, os } = parseUa(ua, touch)
    bufferEvent({
      path,
      visitor: visitorHash(ip, ua),
      referrerHost: referrerHost || null,
      country: country || null,
      device,
      browser,
      os,
      createdAt: nowMs(),
    })
  } catch (error) {
    console.error(`[ERROR] analytics.recordView: ${(error as Error).message}`)
  }
}

// Record one scroll-depth sample (0-100, % of page reached before leaving) plus an
// optional dwell time (ms on the page).
export async function recordScroll(
  rawPath: string,
  depth: number,
  ip: string,
  ua: string,
  dwellMs?: number,
  bytes?: number,
): Promise<void> {
  try {
    if (isBot(ua)) return
    const path = normalizePath(rawPath)
    if (!path || !(await pathIsServable(path))) return
    const keep = (await getSettings()).features.transferStats
    bufferScroll({
      path,
      depth: Math.max(0, Math.min(100, Math.round(depth))),
      dwellMs: typeof dwellMs === 'number' && isFinite(dwellMs)
        ? Math.max(0, Math.min(86_400_000, Math.round(dwellMs)))
        : null,
      // Gated HERE rather than in the route, so every caller of `recordScroll` is covered
      // by the switch and not just the one that happens to read the beacon today.
      //
      // Capped at 64 MB, which no reading page reaches and a forged beacon should not be
      // able to use to swamp a monthly total. Zero is kept as zero: it is what a browser
      // reports when every byte came out of its own cache, and that is a real answer.
      bytes: keep && typeof bytes === 'number' && isFinite(bytes) && bytes >= 0
        ? Math.min(67_108_864, Math.round(bytes))
        : null,
      visitor: visitorHash(ip, ua),
      createdAt: nowMs(),
    })
  } catch (error) {
    console.error(`[ERROR] analytics.recordScroll: ${(error as Error).message}`)
  }
}
