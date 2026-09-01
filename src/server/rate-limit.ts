// Best-effort in-memory sliding-window rate limiter, keyed by client IP. Per-instance
// (resets on restart, not shared across replicas) — a coarse flood-blunter, NOT a hard
// quota. Limits are deliberately generous so a real reader/owner never hits them; the
// point is only to blunt a script hammering a public endpoint. For a multi-replica
// hosted deploy this must move to a shared store (Redis); documented, not hidden.
//
// TWO WINDOW LENGTHS SHARE THIS MAP and that is the thing to keep in mind when editing it.
// The public endpoints charge a minute; sign-in charges fifteen, and the recovery codes an
// hour. A bucket therefore carries the window it was written under, because the alternative
// — one global window used by whichever caller happens to sweep — silently cut the sign-in
// lockout down to sixty seconds. See `sweep`.

import type { Context } from 'hono'
import { cloudflareInFront } from '@/store/integration-keys'

/** One key's hits, and the window they were charged under. */
type Bucket = { windowMs: number; times: number[] }

const buckets = new Map<string, Bucket>()
let lastSweep = 0

/** How often the sweep runs. Not a window: every bucket is judged by its OWN. */
const SWEEP_EVERY_MS = 60_000

/**
 * Drop keys whose every timestamp has aged out, so the Map can't grow unbounded on a
 * long-running server (one key per distinct IP, forever, was a slow memory leak).
 *
 * EACH BUCKET IS JUDGED BY THE WINDOW IT WAS WRITTEN UNDER. This used to take the caller's
 * `windowMs` and apply it to every key in the map, which made the outcome depend on who
 * swept last: five failed sign-ins wrote a fifteen-minute lockout, then the next ordinary
 * search request ninety seconds later swept with a sixty-second window and deleted it. The
 * lockout was real for a minute and then gone, on any site with traffic, and nothing failed
 * to say so. Reproduced in `rate-limit.test.ts`, "a short window does not sweep away a long
 * one".
 */
function sweep(now: number): void {
  if (now - lastSweep < SWEEP_EVERY_MS) return
  lastSweep = now
  for (const [key, bucket] of buckets) {
    const newest = bucket.times[bucket.times.length - 1]
    if (newest === undefined || now - newest >= bucket.windowMs) buckets.delete(key)
  }
}

/** The hits still inside `windowMs`. Reads only — an absent key stays absent. */
function recentHits(key: string, now: number, windowMs: number): number[] {
  const bucket = buckets.get(key)
  if (!bucket) return []
  return bucket.times.filter((t) => now - t < windowMs)
}

/** Record one hit and store the window it was charged under. */
function charge(key: string, now: number, windowMs: number): number[] {
  const times = recentHits(key, now, windowMs)
  times.push(now)
  buckets.set(key, { windowMs, times })
  return times
}

// Returns true when this hit exceeds `max` within `windowMs` (i.e. should be blocked).
export function rateLimited(key: string, max: number, windowMs = 60_000): boolean {
  const now = Date.now()
  sweep(now)
  return charge(key, now, windowMs).length > max
}

// `rateLimited` above both records the hit and reports the verdict, which is right for a
// public endpoint where every request is equally a request. Sign-in is different: a
// LOCKOUT must count failures only. Charging a successful sign-in against the same window
// means the owner signing in for the sixth time in fifteen minutes is locked out of their
// own blog, having done nothing wrong — so the two halves are separable below.

/** The verdict alone. Records nothing, so a caller can ask before deciding to charge. */
export function overLimit(key: string, max: number, windowMs = 60_000): boolean {
  // `>=`, not `>`: this is asked BEFORE the attempt, so `max` recorded failures means the
  // allowance is already spent and this attempt is the one to refuse.
  return recentHits(key, Date.now(), windowMs).length >= max
}

/** Charge one hit against a key. Called after an attempt is known to have failed. */
export function recordHit(key: string, windowMs = 60_000): void {
  const now = Date.now()
  sweep(now)
  charge(key, now, windowMs)
}

/** Forget a key. A successful sign-in clears the failures that preceded it. */
export function clearLimit(key: string): void {
  buckets.delete(key)
}

/**
 * Test seam. The buckets are process-global, so a test that deliberately exhausts a window
 * decides the outcome of every test after it in the same file — which it did, the first
 * time the sign-in lockout was tested.
 */
export function resetLimits(): void {
  buckets.clear()
  lastSweep = 0
}

// ---------------------------------------------------------------------------
// Who the client is
// ---------------------------------------------------------------------------

/**
 * Loopback, private and link-local ranges — the addresses a reverse proxy on the same box
 * (or the same private network) connects from.
 *
 * Bun reports an IPv4 peer as an IPv4-mapped IPv6 address (`::ffff:127.0.0.1`), so the
 * mapping is stripped before the v4 tests.
 */
function isLocalHop(address: string): boolean {
  const ip = address.replace(/^::ffff:/i, '').toLowerCase()
  if (ip === '::1' || ip === '') return true
  if (/^f[cd][0-9a-f]{2}:/.test(ip)) return true // unique-local  fc00::/7
  if (ip.startsWith('fe80:')) return true // link-local
  const v4 = ip.split('.')
  if (v4.length !== 4) return false
  const [a, b] = [Number(v4[0]), Number(v4[1])]
  if (a === 127 || a === 10) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 169 && b === 254) return true
  return false
}

/**
 * `TRUST_PROXY=1` for the deployment whose proxy is NOT on the local network — a tunnel, a
 * PaaS router, a load balancer on a public address. Without it the rule below is automatic
 * and needs no configuration on any of the ordinary layouts.
 */
const trustProxyAlways = (): boolean => (process.env.TRUST_PROXY ?? '').trim() === '1'

/**
 * The address to key a limit or an analytics hash by.
 *
 * The SOCKET PEER is the ground truth: `Bun.serve` reports who actually connected and a client
 * cannot forge it. Proxy headers are believed only when that peer is a trusted hop — loopback
 * or a private address — or when `TRUST_PROXY=1` says the proxy is somewhere else.
 *
 * BOTH HALVES WERE BROKEN, each in a way that measured:
 *
 * - `cf-connecting-ip` was read unconditionally, so a request straight to the origin could
 *   carry a made-up one. Measured: 70 requests against a 60/minute cap, a different forged
 *   value each, not one refused. Cloudflare overwrites the header, so the live instances were
 *   covered by their deployment and the software itself was not.
 * - With NO proxy in front, neither header is present and every visitor shared one bucket
 *   called 'unknown' — one person searching rate-limited the whole site. Measured the same
 *   way: request 16 of 70 came back 429 from a second client.
 *
 * `unknown` remains as the last resort — a unit test builds a bare `Request` with no server
 * behind it — and is now genuinely unreachable in a running process.
 */
export function clientIp(c: Context): string {
  const peer = peerAddress(c)
  if (peer && !isLocalHop(peer) && !trustProxyAlways()) return peer

  // `CF-Connecting-IP` ONLY when Cloudflare is the front, because only Cloudflare overwrites
  // it. Every other proxy forwards it as the unknown header it is, so believing it
  // unconditionally hands the client a free choice of bucket — see `cloudflareInFront`, which
  // carries the measurement. The default install has no Cloudflare, so the default is no.
  if (cloudflareInFront()) {
    const cf = c.req.header('cf-connecting-ip')?.trim()
    if (cf) return cf
  }
  const forwarded = lastForwarded(c.req.header('x-forwarded-for'))
  if (forwarded) return forwarded
  return peer || 'unknown'
}

/**
 * The LAST hop in `X-Forwarded-For`, not the first.
 *
 * The first is whatever the client sent, on any proxy that appends rather than overwrites,
 * and appending is what nginx's `$proxy_add_x_forwarded_for` does and what Cloudflare does.
 * The last is always the view of the nearest trusted proxy, which is the one that just
 * handed us the connection and the only hop in the list we have any reason to believe.
 *
 * Right on all three shipped layouts. Caddy REPLACES the header with the peer it saw, so the
 * list is one entry and first and last agree (verified against Caddy 2: a request carrying
 * `X-Forwarded-For: 198.51.100.7` arrived as `192.168.65.1`, the real peer). nginx appends
 * `$remote_addr`, so the last entry is what nginx saw. Cloudflare appends the visitor, so the
 * last entry is the visitor.
 */
const lastForwarded = (header: string | undefined): string => {
  const hops = (header ?? '').split(',')
  return hops[hops.length - 1]?.trim() ?? ''
}

/**
 * The peer address, or '' when there is no server to ask.
 *
 * `Bun.serve` passes itself as the second argument to `fetch`, which is what Hono surfaces
 * as `c.env`. In a test the app is driven through `app.request()` and there is no server,
 * so this has to answer for that case rather than throw.
 */
function peerAddress(c: Context): string {
  const server = c.env as unknown as { requestIP?: (req: Request) => { address: string } | null }
  if (typeof server?.requestIP !== 'function') return ''
  try {
    return server.requestIP(c.req.raw)?.address ?? ''
  } catch {
    return ''
  }
}
