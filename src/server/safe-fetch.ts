// SSRF guard for fetching caller/owner-supplied URLs (MCP `add_media_from_url`,
// the settings logo render). Blocks requests aimed at internal/cloud-metadata
// targets while leaving legitimate public Blob / image / font URLs untouched.
//
// NODE RUNTIME ONLY: both call sites are Node server code (the data layer +
// the MCP server). This uses `node:dns/promises`, which is unavailable on the
// Edge runtime — do NOT import this from an edge route.

import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

// Thrown when a URL is rejected by the SSRF guard (scheme or address). Typed so
// callers can distinguish a policy block from a network/HTTP failure.
export class BlockedUrlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BlockedUrlError'
  }
}

// Parse "a.b.c.d" into four octets, or null if not a dotted-quad IPv4 literal.
function ipv4Octets(ip: string): [number, number, number, number] | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  const nums = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN))
  if (nums.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return null
  return nums as [number, number, number, number]
}

// True if an IPv4 address falls in a private / loopback / link-local / CGNAT /
// unspecified range (incl. 169.254.169.254 cloud metadata, which is link-local).
function isBlockedIPv4(ip: string): boolean {
  const o = ipv4Octets(ip)
  if (!o) return false
  const [a, b] = o
  if (a === 0) return true // 0.0.0.0/8 (incl. 0.0.0.0 unspecified)
  if (a === 127) return true // 127.0.0.0/8 loopback
  if (a === 10) return true // 10.0.0.0/8 private
  if (a === 172 && b >= 16 && b <= 31) return true // 172.16.0.0/12 private
  if (a === 192 && b === 168) return true // 192.168.0.0/16 private
  if (a === 169 && b === 254) return true // 169.254.0.0/16 link-local (+ metadata)
  if (a === 100 && b >= 64 && b <= 127) return true // 100.64.0.0/10 CGNAT
  return false
}

// True if a normalized IPv6 address is loopback/unspecified/link-local/unique-local,
// or an IPv4-mapped/embedded address that maps into a blocked IPv4 range.
function isBlockedIPv6(ip: string): boolean {
  const lower = ip.toLowerCase().replace(/^\[|\]$/g, '')
  if (lower === '::1') return true // loopback
  if (lower === '::' || lower === '::0') return true // unspecified
  // ::ffff:a.b.c.d or ::ffff:hhhh:hhhh — IPv4-mapped: validate the embedded v4.
  const mapped = lower.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)
  if (mapped) return isBlockedIPv4(mapped[1])
  const mappedHex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
  if (mappedHex) {
    const hi = parseInt(mappedHex[1], 16)
    const lo = parseInt(mappedHex[2], 16)
    const v4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`
    return isBlockedIPv4(v4)
  }
  // First hextet tells us the high bits for the remaining ranges.
  const head = parseInt(lower.split(':')[0] || '0', 16)
  if ((head & 0xffc0) === 0xfe80) return true // fe80::/10 link-local
  if ((head & 0xfe00) === 0xfc00) return true // fc00::/7 unique-local
  return false
}

// Pure classifier: is this resolved/literal IP address one we must never fetch?
// Exported for unit testing (no network needed). Accepts IPv4 or IPv6 literals.
export function isBlockedAddress(ip: string): boolean {
  const kind = isIP(ip)
  if (kind === 4) return isBlockedIPv4(ip)
  if (kind === 6) return isBlockedIPv6(ip)
  // Not a bare IP literal (e.g. a hostname) — not classifiable here.
  return false
}

// Pure pre-DNS check on the parsed URL: only http/https, and reject a host that
// is itself a literal IP in a blocked range (before any DNS lookup). Exported
// for unit testing. DNS-resolved addresses are checked separately in safeFetch.
export function isBlockedUrl(parsed: URL): boolean {
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return true
  // URL wraps IPv6 literals in brackets; strip them for the classifier.
  const host = parsed.hostname.replace(/^\[|\]$/g, '')
  if (isIP(host) && isBlockedAddress(host)) return true
  return false
}

// SSRF-safe fetch. Rejects non-http(s) schemes and any URL whose host (literal
// or DNS-resolved) lands in a private/loopback/link-local/unique-local/CGNAT/
// metadata range, then performs the fetch. Throws BlockedUrlError on a blocked
// URL; network/HTTP errors propagate as usual.
//
// DNS rebinding: we resolve ALL addresses for the host up front and reject if
// ANY is blocked, so a host that returns both a public and an internal record
// can't slip through. (A fully airtight defence would pin the socket to the
// validated IP; Node's `fetch` has no per-request address pin, so we
// validate-then-fetch — the resolution-time records are the ones checked.)
export async function assertUrlAllowed(url: string): Promise<URL> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new BlockedUrlError(`Invalid URL: ${url}`)
  }
  if (isBlockedUrl(parsed)) {
    throw new BlockedUrlError(`Blocked URL (scheme or address not allowed): ${url}`)
  }
  const host = parsed.hostname.replace(/^\[|\]$/g, '')
  // Literal-IP hosts were already validated by isBlockedUrl; only resolve names.
  if (!isIP(host)) {
    const records = await lookup(host, { all: true })
    for (const { address } of records) {
      if (isBlockedAddress(address)) {
        throw new BlockedUrlError(`Blocked URL (resolves to internal address ${address}): ${url}`)
      }
    }
  }
  return parsed
}

const MAX_REDIRECT_HOPS = 5

/**
 * The wall clock every outbound fetch runs against, unless the caller sets its own signal.
 *
 * The SSRF guard answers "may we talk to this host". It never answered "for how long", and
 * a host is not obliged to hang up: accept the connection, send a byte a minute, and the
 * request handler waiting on it is held for as long as the attacker likes. Three of the four
 * call sites passed no signal at all — the MCP add-media tool, the importer's per-image
 * fetch, and the logo render, all of them reachable by a URL somebody else chose.
 *
 * 15s rather than the og card's 5s: these are whole images off other people's hosts, and a
 * slow-but-real CDN should not read as a failure. It is a ceiling, not a budget.
 */
const DEFAULT_TIMEOUT_MS = 15_000

// SSRF-safe fetch. Validates the scheme + host (literal or DNS-resolved) of the
// initial URL AND of every redirect hop before following it, so an attacker URL
// that 3xx-redirects to an internal address (e.g. 169.254.169.254) can't slip
// past the guard. Throws BlockedUrlError on a blocked hop or when the redirect
// cap is exceeded; network/HTTP errors propagate as usual. Returns the final
// Response.
//
// Redirects are followed MANUALLY (`redirect: 'manual'`) so each Location is
// re-validated by the full guard before the next hop is fetched. These call
// sites are GETs for images/fonts; the caller's init is carried through, but we
// always force manual redirect handling.
export async function safeFetch(url: string, init?: RequestInit): Promise<Response> {
  let current = url
  // ONE signal for the whole chain, not one per hop: five redirects each given the full
  // timeout is five times the ceiling, and the clock a caller cares about is the one on
  // the call they made.
  const signal = init?.signal ?? AbortSignal.timeout(DEFAULT_TIMEOUT_MS)
  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
    const parsed = await assertUrlAllowed(current)
    const res = await fetch(current, { ...init, signal, redirect: 'manual' })
    const location = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null
    if (!location) return res // not a redirect (or no target) → final response
    // Resolve a possibly-relative Location against the current URL; the next
    // loop iteration re-runs the full guard on it before any fetch reaches it.
    current = new URL(location, parsed).toString()
  }
  throw new BlockedUrlError(`Too many redirects (>${MAX_REDIRECT_HOPS}): ${url}`)
}
