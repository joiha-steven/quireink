// Activity log — a transparent, owner-only record of admin mutations (post/page
// saves + deletes, media/file uploads + deletes, settings, taxonomy, cache clear).
// Stored in the `activity_log` table. Logging is gated by
// `settings.features.activityLog` (Admin → Settings) so the owner can turn it off.
//
// Never throws: a logging failure must not break the action being logged.

import { getSettings } from '@/content/settings'
import { all, run } from '@/store/query'
import { nowMs, toIso } from '@/store/db'

export type ActivityAction =
  | 'post.create' | 'post.update' | 'post.delete'
  | 'page.create' | 'page.update' | 'page.delete'
  | 'media.upload' | 'media.delete'
  | 'file.add' | 'file.delete' | 'icon.upload' | 'font.upload'
  | 'settings.save' | 'taxonomy.update' | 'series.update' | 'cache.clear'
  // Trash (soft delete): restore / permanent purge per kind, plus empty-trash.
  | 'post.restore' | 'post.purge' | 'page.restore' | 'page.purge'
  | 'media.restore' | 'media.purge' | 'file.restore' | 'file.purge'
  | 'trash.empty'
  // MCP access tokens (Admin → Settings → Advanced).
  | 'mcp.token.create' | 'mcp.token.delete'
  // Content import (Admin → Settings → Integrations).
  | 'import.wordpress'
  // URL redirects (Admin → Settings → SEO).
  | 'redirect.save' | 'redirect.delete'
  // Newsletter (Admin → Settings → Integrations). Delete is soft; restore/purge are the
  // Trash's, like every other kind.
  | 'subscriber.delete' | 'subscriber.restore' | 'subscriber.purge'
  | 'mail.config' | 'mail.test' | 'newsletter.send'
  // Backups (Admin → Settings → System). The connect/disconnect pair belonged to the
  // Google Drive integration, which 2.0 does not have (parity exception 1). `export` is the
  // copy the owner takes away; `run` and `delete` are the snapshots kept on the server, by
  // hand or by the cron tick.
  | 'backup.export' | 'backup.run' | 'backup.delete'
  // Reader comments (create is public; restore/purge from the admin Trash).
  | 'comment.create' | 'comment.delete' | 'comment.restore' | 'comment.purge'
  // Server errors (unexpected failures from route handlers) — the error log.
  | 'error'
  // Authentication (new in 2.0; see v2/docs/06-auth.md). Named `auth.*` to match the
  // `<area>.<event>` shape of everything above, rather than the informal names in the
  // spec prose. These are written by `logAuthEvent`, which does NOT consult the
  // activityLog toggle — see there for why.
  | 'auth.login' | 'auth.login.failed' | 'auth.totp.failed' | 'auth.recovery.used'
  | 'auth.password.changed' | 'auth.totp.enrolled' | 'auth.recovery.regenerated'
  // First run. `owner.claimed` happens exactly once in the life of a blog, and
  // `totp.deferred` is the one way in without a second factor — both belong in the log
  // precisely because they are rare enough that nobody would think to look for them.
  | 'auth.owner.claimed' | 'auth.totp.deferred'
  | 'auth.logout' | 'auth.sessions.revoked'

export type ActivityEntry = {
  id: number
  at: string
  action: ActivityAction
  detail: string
}

function insert(action: ActivityAction, detail: string): void {
  run(
    `insert into activity_log (at, action, detail) values (?, ?, ?)`,
    nowMs(), action, detail.slice(0, 500),
  )
}

// Record one action. No-op (silently) when the toggle is off or on any error.
export async function logActivity(action: ActivityAction, detail = ''): Promise<void> {
  try {
    const { features } = await getSettings()
    if (!features.activityLog) return
    insert(action, detail)
  } catch (error) {
    console.error(`[ERROR] activity.logActivity(${action}): ${(error as Error).message}`)
  }
}

/**
 * Record an authentication event, ALWAYS — the `activityLog` feature toggle is
 * deliberately not consulted.
 *
 * Everything else in this log is a convenience: what did I change, and when. The auth
 * entries are the answer to "was somebody trying to get in", and a security trail that a
 * setting can silence is one an attacker can silence. The toggle exists so the owner can
 * stop recording their own edits, which is a different want.
 *
 * Never throws: failing to log a sign-in must not fail the sign-in.
 */
export function logAuthEvent(action: ActivityAction, detail = ''): void {
  try {
    insert(action, detail)
  } catch (error) {
    console.error(`[ERROR] activity.logAuthEvent(${action}): ${(error as Error).message}`)
  }
}

// Record an unexpected server error as an `error` entry (the error log). Gated by
// the same toggle; never throws. `context` is e.g. "POST /api/posts/foo".
export async function logActivityError(context: string, message: string): Promise<void> {
  try {
    const { features } = await getSettings()
    if (!features.activityLog) return
    insert('error', `${context} — ${message}`)
  } catch (error) {
    console.error(`[ERROR] activity.logActivityError: ${(error as Error).message}`)
  }
}

// Most-recent entries first (default 200). Empty on error.
export async function getActivity(limit = 200): Promise<ActivityEntry[]> {
  try {
    // `id desc` matters more than it did: `at` is milliseconds where Postgres had
    // microseconds, and a burst of writes inside one action would otherwise order
    // arbitrarily in the owner's log.
    return all<{ id: number; at: number; action: ActivityAction; detail: string }>(
      `select id, at, action, detail from activity_log order by at desc, id desc limit ?`,
      limit,
    ).map((r) => ({ ...r, at: toIso(r.at) }))
  } catch (error) {
    console.error(`[ERROR] activity.getActivity: ${(error as Error).message}`)
    return []
  }
}

// Wipe the whole log (owner action from the Log page).
export async function clearActivity(): Promise<void> {
  run(`delete from activity_log`)
}
