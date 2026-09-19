// Settings → Server & connections: WHO THIS MACHINE TALKS TO, and what it does on its own.
//
// ADR 0041. It absorbs the old Search & URLs, Connections, AI and System tabs, on the argument
// that all four answered one question with four names on it — what this INSTALL does, as
// opposed to what the blog is or what a post looks like. Nine cards, more than any other tab,
// and they save through five different endpoints between them.
//
// ADR 0054: the server draws it. Every card is in `settings-server-*.ts` beside this file;
// what is here is the two stacks and what goes in each.
//
// ⚠️ THIS IS THE MOST DANGEROUS SURFACE IN THE ADMIN and NOTHING ON IT IS WIRED. The cards here
// mint credentials, delete backups, bulk-import content, purge a CDN and spend money, and every
// control is inert: a `type="button"` with a `data-*` hook and no handler, a field with a name
// and nowhere to send it. There is no `<form>` on this screen, and here that is load-bearing
// rather than tidy — a form would let Return in the redirect box fire an import or a purge.
//
// ⚠️ NO SECRET IS WRITTEN HERE, and there is no server view that would hand one over.
// `getIntegrationStatus()` returns booleans plus the deliberately-public values, so every
// credential field ships BLANK with a placeholder saying one is stored, and blank means KEEP.
// The token table and the backup list ship EMPTY for the same kind of reason: they come from
// routes this render has not called, and a token's plaintext exists only in the reply that
// minted it.
import type { AdminStrings } from '@/i18n/admin-i18n'
import type { SiteSettings } from '@/types'
import type { IntegrationStatus } from '@/store/integration-keys'
import type { Redirect } from '@/server/redirects'
import { importCard, redirectsCard, siteCard } from '@/web/admin/screens/settings-server-code'
import { aiCard, cloudflareCard, offsiteCard } from '@/web/admin/screens/settings-server-keys'
import { mcpCard } from '@/web/admin/screens/settings-server-mcp'
import { apiCard } from '@/web/admin/screens/settings-server-api'
import { activityPubCard } from '@/web/admin/screens/settings-server-ap'
import { backupsCard, installCard, type UpdateStatus } from '@/web/admin/screens/settings-server-ops'
import { COL, GRID } from '@/web/admin/screens/settings-shell'

/** What this tab needs that is not a setting. */
export type ServerTabView = {
  /**
   * WHICH secrets are stored, never what they are: booleans, plus the handful of values that
   * are deliberately public (`store/integration-keys.ts` marks each one).
   */
  integrations: IntegrationStatus
  /** Whether this deployment permits the update check at all, and what it last learned. */
  update: UpdateStatus
  /** Every manual redirect, newest first — the one list on this tab the server can read. */
  redirects: Redirect[]
  /**
   * The address this request arrived on, for the MCP endpoint when `siteUrl` is blank.
   *
   * With no site address set the server derives one from the environment, which no page can
   * read; React fell back to `window.location.origin` for that reason. The server has the same
   * answer from the request itself, and it is reachable by definition.
   */
  origin: string
  /** How many servers follow this blog (ADR 0059). A count, never a list — see `ap-routes.ts`. */
  followers: number
}

/**
 * The tab.
 *
 * ⚠️ THE STACKS ARE ASSIGNED BY MEASUREMENT, not by subject, and on this tab that matters most:
 * it absorbed four of the old eight, so any hand-made split leaves a hole. Measured at 1440px on
 * the showcase fixture: 994 · 424 · 282 · 203 on the left against 500 · 282 · 339 · 384 · 378 on
 * the right — 1,963 a side. An earlier cut left 2,134 against 1,664, a 470px hole beside the
 * tallest card on the screen and a tab 2,409px long against the 1,800 the regrouping was
 * measured to fix. Redirects and the import moved across for that; re-measure before moving one
 * back.
 */
export function serverTab(t: AdminStrings, s: SiteSettings, view: ServerTabView): string {
  const origin = (s.siteUrl || view.origin).replace(/\/+$/, '')
  const endpoint = `${origin}/api/mcp`
  return `<div class="${GRID}">`
    + `<div class="${COL}">`
    + siteCard(t, s)
    + cloudflareCard(t, view.integrations)
    + redirectsCard(t, view.redirects)
    + importCard(t)
    + `</div><div class="${COL}">`
    + installCard(t, s, view.update)
    + aiCard(t, s, view.integrations)
    + mcpCard(t, s, endpoint)
    // Under MCP: the two machine doors read as a pair, and this is the smaller one.
    + apiCard(t, s, `${origin}/api/v1`)
    // The third machine door, and the only one that gives this blog a name out there.
    + activityPubCard(t, s, { origin: view.origin, followers: view.followers })
    + backupsCard(t, s)
    // The snapshot that leaves the machine (ADR 0035): a copy beside the data does not survive
    // the disk. It sits under the backups it ships.
    + offsiteCard(t, view.integrations)
    + `</div></div>`
}
