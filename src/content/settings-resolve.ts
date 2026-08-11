// What the effective value of a setting IS, once the fallbacks have been walked.
//
// Split out of `settings.ts` on 2026-08-11, when that file hit its 400-line ceiling for the
// second time in one session. The seam is by audience, not by size: this file answers "what
// address does this site actually publish, what icon does it actually use", which is a
// question every caller asks and none of them care how the row is stored, sanitised or
// migrated. `settings.ts` re-exports all three, so no import site changed.

import type { SiteSettings } from '@/types'

/**
 * Canonical base URL: owner value, else the `SITE_URL` env, else localhost.
 *
 * **THE LAST RESORT IS NOT DERIVED FROM THE REQUEST, AND MUST NOT BE.** `env.ts` used to claim
 * an empty `SITE_URL` meant "derive per request"; nothing did, and `web/og.ts` is the one place
 * that does, deliberately and for its own SSRF reason.
 *
 * Deriving it here would be worse than the localhost it replaces. The page cache is keyed by
 * PATH ALONE (`web/listing-page.ts`), so one request carrying `Host: evil.example` would render
 * a sitemap, a feed and a set of canonical tags pointing there — and then serve that cached
 * copy to everybody. Cache poisoning, from a header any client can set.
 *
 * So the fallback stays a constant, which keeps `bun run dev` working with no configuration at
 * all, and the ABSENCE is made loud instead: `index.ts` warns at boot and the admin hint says
 * it where somebody can fix it. What is not acceptable is what this did before — a live site
 * quietly publishing `localhost:3000` in its sitemap, its feed and every OG tag, with the
 * explanation sitting in a comment that was wrong.
 */
export function resolveSiteUrl(s: SiteSettings): string {
  if (s.siteUrl) return s.siteUrl
  if (process.env.SITE_URL) return process.env.SITE_URL
  return 'http://localhost:3000'
}

/** True when nothing has said what this site's address is — see `resolveSiteUrl`. */
export function siteUrlIsUnset(s: SiteSettings): boolean {
  return !s.siteUrl && !process.env.SITE_URL
}

/** PWA / home-screen icon: app icon → favicon → bundled `/app-icon.png`. */
export function resolveAppIcon(s: SiteSettings): string {
  return s.appIconUrl || s.faviconUrl || '/app-icon.png'
}
