// Newsletter send log (`newsletter_sends`): ONE row per outgoing email, written by
// `sendMail` so nothing can send without being recorded. Keyed by email address, not a
// subscriber id — reply notifications go to commenters who never subscribed.
//
// Open tracking (broadcast only): each broadcast row carries an unguessable
// `open_token`; the email embeds a 1x1 pixel pointing at `/api/newsletter/open?t=`.
// The token identifies the SEND, never the address, so the URL leaks nothing on its own
// and an open is recorded ONCE (first hit wins — mail clients refetch).
// SERVER-ONLY.

import { randomBytes } from 'node:crypto'
import { all, run } from '@/store/query'
import { nowMs, toIso } from '@/store/db'

export type SendKind = 'confirm' | 'broadcast' | 'reply' | 'test'

export type SendStats = {
  sent: number // successful sends
  failed: number
  opened: number // broadcasts recorded as opened
  broadcasts: number // successful broadcasts (the open-rate denominator)
  lastAt?: string
  lastError?: string
}

const EMPTY: SendStats = { sent: 0, failed: 0, opened: 0, broadcasts: 0 }

export const newOpenToken = (): string => randomBytes(18).toString('base64url')

// Record one send. NEVER throws: a logging failure must not fail (or double-send) the
// mail that already went out. `postSlugs` is a LIST because a digest is one email
// carrying several posts — stored comma-joined so each post still gets credit in
// `statsByPost` while the per-address count stays one-row-per-email (slugs are
// slugified, so a comma can never appear inside one).
export async function logSend(row: {
  email: string
  kind: SendKind
  ok: boolean
  postSlugs?: string[]
  error?: string
  openToken?: string
}): Promise<void> {
  try {
    run(
      `insert into newsletter_sends (email, kind, post_slug, sent_at, ok, error, open_token)
       values ($email, $kind, $postSlug, $sentAt, $ok, $error, $openToken)`,
      {
        email: row.email.trim().toLowerCase(),
        kind: row.kind,
        postSlug: row.postSlugs?.length ? row.postSlugs.join(',') : null,
        sentAt: nowMs(),
        ok: row.ok ? 1 : 0,
        error: row.error ?? null,
        // Only a delivered broadcast can be opened; don't burn a token on a failed send.
        openToken: row.ok && row.kind === 'broadcast' ? (row.openToken ?? null) : null,
      },
    )
  } catch (error) {
    console.error(`[ERROR] newsletter-log.logSend: ${(error as Error).message}`)
  }
}

type Row = {
  email: string; kind: SendKind; ok: number; sent_at: number
  error: string | null; opened_at: number | null
}

// Per-address rollup for the subscriber table. One read + a fold, not a query per row.
export async function statsByEmail(): Promise<Map<string, SendStats>> {
  const out = new Map<string, SendStats>()
  try {
    for (const r of all<Row>(
      `select email, kind, ok, sent_at, error, opened_at from newsletter_sends
        order by sent_at asc, id asc`,
    )) {
      const cur = out.get(r.email) ?? { ...EMPTY }
      if (r.ok) cur.sent++
      else {
        cur.failed++
        cur.lastError = r.error ?? undefined
      }
      if (r.ok && r.kind === 'broadcast') {
        cur.broadcasts++
        if (r.opened_at) cur.opened++
      }
      cur.lastAt = toIso(r.sent_at) // rows arrive oldest-first, so the last write wins
      out.set(r.email, cur)
    }
  } catch (error) {
    console.error(`[ERROR] newsletter-log.statsByEmail: ${(error as Error).message}`)
  }
  return out
}

// Per-post rollup, used by the send tab to show what a post has already been through.
export async function statsByPost(): Promise<Map<string, SendStats>> {
  const out = new Map<string, SendStats>()
  try {
    for (const r of all<Row & { post_slug: string | null }>(
      `select post_slug, ok, sent_at, error, opened_at from newsletter_sends
        where kind = 'broadcast' order by sent_at asc, id asc`,
    )) {
      if (!r.post_slug) continue
      // A digest row credits EVERY post it carried; one open counts for all of them
      // (there is one pixel per email, not per post).
      for (const slug of r.post_slug.split(',')) {
        const cur = out.get(slug) ?? { ...EMPTY }
        if (r.ok) {
          cur.sent++
          cur.broadcasts++
          if (r.opened_at) cur.opened++
        } else {
          cur.failed++
          cur.lastError = r.error ?? undefined
        }
        cur.lastAt = toIso(r.sent_at)
        out.set(slug, cur)
      }
    }
  } catch (error) {
    console.error(`[ERROR] newsletter-log.statsByPost: ${(error as Error).message}`)
  }
  return out
}

// Stamp an open. First hit wins (`opened_at is null`) so a mail client refetching the
// pixel can't inflate the count. Silent no-op on an unknown/blank token.
export async function recordOpen(token: string): Promise<void> {
  if (!token) return
  try {
    run(
      `update newsletter_sends set opened_at = ? where open_token = ? and opened_at is null`,
      nowMs(), token,
    )
  } catch (error) {
    console.error(`[ERROR] newsletter-log.recordOpen: ${(error as Error).message}`)
  }
}

/**
 * Follow a post that changed its slug, so its send history follows it too.
 *
 * THE BUG THIS EXISTS FOR: `statsByPost` is keyed by slug and it is what tells the send
 * tab a post has already gone out, which is the only thing standing between a rename and
 * a second copy of the same newsletter in every subscriber's inbox. A newsletter cannot be
 * unsent, so this is the one rename that has to be atomic with the post's own.
 *
 * `post_slug` holds a COMMA-SEPARATED list, because a digest row credits every post it
 * carried. So the swap is done on the list and not on the column: both sides are wrapped
 * in commas first, which is what keeps `pen` from matching inside `open-letter`, and the
 * wrapping commas are trimmed back off afterwards. `instr` rather than `like` so a slug
 * never has to be escaped.
 */
export async function renameSends(from: string, to: string): Promise<void> {
  if (!from || !to || from === to) return
  try {
    run(
      `update newsletter_sends
          set post_slug = trim(
                replace(',' || post_slug || ',', ',' || $from || ',', ',' || $to || ','), ',')
        where post_slug is not null
          and instr(',' || post_slug || ',', ',' || $from || ',') > 0`,
      { from, to },
    )
  } catch (error) {
    console.error(`[ERROR] newsletter-log.renameSends: ${(error as Error).message}`)
  }
}

// Drop an address's history when its subscriber row is deleted (the admin's delete is
// a real delete, so leaving the log behind would keep the address on file).
export async function deleteSendsFor(email: string): Promise<void> {
  try {
    run(`delete from newsletter_sends where email = ?`, email.trim().toLowerCase())
  } catch (error) {
    console.error(`[ERROR] newsletter-log.deleteSendsFor: ${(error as Error).message}`)
  }
}
