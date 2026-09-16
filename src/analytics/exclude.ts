// Who is not a reader.
//
// The numbers should not count the person who runs the site, or the machine it runs on. Until
// this they counted both: every visit the owner made while checking a change, every drive from
// a script on the box, every "does this look right" reload landed in `analytics_events` beside
// real readers — and on a personal blog that is a large fraction of the traffic.
//
// Three exclusions, narrowest first:
//
//   1. A request carrying a LIVE owner session. The frozen tree gated its track route with
//      `requireOwner()`; 2.0 had no session to ask until M3 and the gap stayed open.
//   2. A request from an IP a live session was created from and used within the last day —
//      the owner in a second browser, a private window, or the phone beside the desk, where
//      there is no cookie to find. A day and not the session's life: on a carrier network
//      the address is shared and handed on (`OWNER_ADDRESS_MS` in auth/sessions.ts).
//   3. A request from a loopback or private address: nothing on the public internet reaches the
//      site that way, so it is the box talking to itself — a warm-up, a probe, a health check.
//
// Nothing new is stored to do any of it. (2) re-uses the salted `ip_hash` the sessions table
// already keeps, so no IP is written anywhere and no list is maintained by hand.

import type { Context } from 'hono'
import { getCookie } from 'hono/cookie'
import { COOKIE_NAME, isSessionIp, resolveSession } from '@/auth/sessions'
import { isBlockedAddress } from '@/server/safe-fetch'

/**
 * Loopback, link-local and the three private ranges.
 *
 * Deliberately not a general "is this routable" check: the question is only whether the
 * request could have come from outside, and an address in these ranges could not.
 */
export function isInternalIp(ip: string): boolean {
  const raw = (ip || '').trim().toLowerCase()
  if (!raw || raw === 'unknown') return true // no address at all is not a reader either
  // Brackets off, and the v4-mapped `::ffff:127.0.0.1` a dual-stack listener reports unwrapped,
  // because `isBlockedAddress` takes a bare literal.
  const bare = raw.replace(/^\[|\]$/g, '')
  // ⚠️ THE SAME RANGE TEST THE SSRF GUARD USES, not a third opinion about what is private.
  // This had its own list and it was the shortest of the three in the tree: no IPv6
  // link-local at all (it tested `169.254.` for v4 only), no CGNAT `100.64.0.0/10`, no
  // `0.0.0.0/8`. Measured 2026-09-16 against the same addresses, `fe80::1`, `100.64.0.1` and
  // `0.0.0.0` were each blocked by `safe-fetch` and counted as a public reader here.
  return isBlockedAddress(bare) || isBlockedAddress(bare.replace(/^::ffff:/, ''))
}

/**
 * Should this request be counted at all?
 *
 * Called by the track route before anything is recorded, so an excluded request costs one
 * cookie read and at most one indexed query.
 */
export function isCountableVisit(c: Context, ip: string): boolean {
  if (resolveSession(getCookie(c, COOKIE_NAME)) !== null) return false
  if (isInternalIp(ip)) return false
  if (isSessionIp(ip)) return false
  return true
}
