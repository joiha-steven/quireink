// Settings → Server & connections: WHO THIS MACHINE TALKS TO, and what it does on its own.
//
// ADR 0041. It absorbs the old Search & URLs, Connections, AI and System tabs, on the argument
// that all four answered one question with four names on it — what this INSTALL does, as
// opposed to what the blog is or what a post looks like. Nine cards, more than any other tab,
// and they save through five different endpoints between them.
//
// ADR 0054: the server draws it. Every card is in `settings-server-*.ts` beside this file;
// what is here is the two stacks, the advanced band folded under them, and what goes in each.
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
import { resolveSiteUrl, siteUrlIsUnset } from '@/content/settings'
import { importCard, redirectsCard, siteCard } from '@/web/admin/screens/settings-server-code'
import { aiCard, cloudflareCard, offsiteCard } from '@/web/admin/screens/settings-server-keys'
import { mcpCard } from '@/web/admin/screens/settings-server-mcp'
import { apiCard } from '@/web/admin/screens/settings-server-api'
import { activityPubCard } from '@/web/admin/screens/settings-server-ap'
import { backupsCard, installCard, type UpdateStatus } from '@/web/admin/screens/settings-server-ops'
import { COL, GRID, advancedBand } from '@/web/admin/screens/settings-shell'
import { SECTION_GAP } from '@/admin-shared/scale'
import { cloudCard } from '@/web/admin/screens/settings-server-cloud'

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
   * The ActivityPub card's fallback host. It is `settings.siteUrl || ''` (`settings.ts`), NOT the
   * address the request arrived on, so it adds nothing when the setting is blank; the two
   * machine doors read the setting and `SITE_URL` directly instead (`serverTab`).
   */
  origin: string
  /** How many servers follow this blog (ADR 0059). A count, never a list — see `ap-routes.ts`. */
  followers: number
}

/**
 * The tab: what the OWNER runs on top, the developer's cards folded under Advanced below it.
 *
 * ⚠️ WHAT IS ADVANCED is a card no writer needs in order to run a blog: what crawlers and feeds
 * are served and the code pasted into every page, redirects, the CDN and the move to Cloudflare,
 * and the two doors other programs use (MCP and the Content API). The cache, updates, storage
 * limits, backups and their off-site copy, the import, the AI key the writing assistant runs on
 * and the fediverse name stay on top: each is a decision about the blog itself. The rule, and how
 * the fold behaves under search and Save, is in `docs/admin-kit.md` ("An advanced band").
 *
 * ⚠️ THE STACKS ARE ASSIGNED BY MEASUREMENT, not by subject, in both bands. Measured at 1440px on
 * the showcase fixture with the explanations hidden (the state a tab this long opens in) on
 * 2026-10-19: on top 543 · 321 · 427 on the left against 686 · 516 · 197 on the right; in the
 * band 933 · 119 · 249 against 364 · 487 · 500. Before the fold the one grid stood 2,501 against
 * 3,041, a 540px hole under the left stack. Backups and the copy that leaves the machine stay one
 * above the other, and MCP sits over the Content API, the two machine doors as a pair.
 * Re-measure before moving a card.
 */
export function serverTab(t: AdminStrings, s: SiteSettings, view: ServerTabView): string {
  // The address the outside world uses: the setting, then `SITE_URL`. With neither, the two
  // machine doors print a note instead of a relative path (`machineAddress`), never
  // `localhost:3000`, which is `resolveSiteUrl`'s last resort for feeds and nobody's address for a
  // client. `fallback` is the `SITE_URL` half alone, for the island when a save empties the setting.
  const bare = { ...s, siteUrl: '' }
  const fallback = siteUrlIsUnset(bare) ? '' : resolveSiteUrl(bare).replace(/\/+$/, '')
  const origin = s.siteUrl.replace(/\/+$/, '') || fallback
  const endpoint = origin ? `${origin}/api/mcp` : ''
  return `<div class="${SECTION_GAP}"><div class="${GRID}">`
    + `<div class="${COL}">`
    + installCard(t, s, view.update)
    + aiCard(t, s, view.integrations)
    // The third machine door (ADR 0059), and the one that stays on top: it gives the blog a name
    // people follow, which is a decision about the blog rather than about a program reading it.
    + activityPubCard(t, s, { origin: view.origin, followers: view.followers })
    + `</div><div class="${COL}">`
    + backupsCard(t, s)
    // The snapshot that leaves the machine (ADR 0035): a copy beside the data does not survive
    // the disk. It sits under the backups it ships.
    + offsiteCard(t, view.integrations)
    + importCard(t)
    + `</div></div>`
    + advancedBand(t, {
      id: 'settings-advanced-server',
      hint: t.serverAdvancedHint,
      left: [
        siteCard(t, s),
        mcpCard(t, s, endpoint, fallback),
        // Under MCP: the two machine doors read as a pair, and this is the smaller one.
        apiCard(t, s, origin ? `${origin}/api/v1` : '', fallback),
      ],
      right: [
        cloudflareCard(t, view.integrations),
        // Moving off this server altogether (G5.3), under the CDN card. Empty on Cloudflare.
        cloudCard(t, s),
        redirectsCard(t, view.redirects),
      ],
    })
    + `</div>`
}
