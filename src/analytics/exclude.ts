// Who is not a reader.
//
// The owner asked for it in as many words: the numbers should not count the person who
// runs the site, or the machine it runs on. Until now they counted both. Every visit the
// owner made while checking a change, every drive of the site from a script on the box, and
// every "does this look right" reload landed in `analytics_events` beside real readers, and
// on a personal blog that is a large fraction of the traffic.
//
// Three exclusions, narrowest first:
//
//   1. A request carrying a LIVE owner session. The frozen tree opened its track route with
//      `requireOwner()`; 2.0 had no session to ask until M3 and the gap has been open since
//      (docs/spec/07-parity-public.md §8). This closes it.
//   2. A request from an IP that a live session was created from — the owner in a second
//      browser, in a private window, or on the phone beside the desk, where there is no
//      cookie to find. This is the "by IP" half.
//   3. A request from a loopback or private address. Nothing on the public internet reaches
//      the site that way, so it is the box talking to itself: a warm-up, a probe, a health
//      check, a headless browser driving a local instance.
//
// Nothing new is stored to do any of it. (2) re-uses the salted `ip_hash` the sessions table
// already keeps, so no IP is written anywhere and no list has to be maintained by hand.

import type { Context } from 'hono'
import { getCookie } from 'hono/cookie'
import { COOKIE_NAME, isSessionIp, resolveSession } from '@/auth/sessions'

/**
 * Loopback, link-local and the three private ranges.
 *
 * Deliberately not a general "is this routable" check: the question is only whether the
 * request could have come from outside, and an address in these ranges could not.
 */
export function isInternalIp(ip: string): boolean {
  const raw = (ip || '').trim().toLowerCase()
  if (!raw || raw === 'unknown') return true // no address at all is not a reader either
  // IPv6 forms, including the v4-mapped `::ffff:127.0.0.1` a dual-stack listener reports.
  const v6 = raw.replace(/^\[|\]$/g, '')
  if (v6 === '::1' || v6 === '::') return true
  const v4 = v6.startsWith('::ffff:') ? v6.slice(7) : v6
  if (v4.startsWith('127.')) return true
  if (v4.startsWith('10.')) return true
  if (v4.startsWith('192.168.')) return true
  if (v4.startsWith('169.254.')) return true // link-local
  const m = /^172\.(\d{1,3})\./.exec(v4)
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return true
  // fc00::/7, the IPv6 private range.
  if (/^f[cd][0-9a-f]{2}:/.test(v6)) return true
  return false
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
