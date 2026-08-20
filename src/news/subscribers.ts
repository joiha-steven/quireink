// Newsletter subscribers with double opt-in. A new address is 'pending' until it
// clicks the confirm link (token); only 'confirmed' addresses receive a broadcast.
// The token is a per-subscriber secret used for BOTH the confirm and unsubscribe
// links. SERVER-ONLY.
//
// Deleting a subscriber is a SOFT delete (Invariant 6, which this table used to be the
// one exception to): the row keeps its email and lands in the Trash's Subscribers tab,
// restorable until the owner purges it. The purge is the hard delete, and it is the
// moment the send log for that address is cleared too — a restorable row with no history
// would restore as a stranger.

import { randomBytes } from 'node:crypto'
import { deleteSendsFor } from '@/news/newsletter-log'
import { all, one, run } from '@/store/query'
import { liveOnly, nowMs, toIso } from '@/store/db'

export type SubStatus = 'pending' | 'confirmed' | 'unsubscribed'
export type Subscriber = {
  id: number
  email: string
  status: SubStatus
  createdAt: string
  confirmedAt?: string
  deletedAt?: string
}

export class SubscribeError extends Error {}

/**
 * How long the same address waits before another confirm email can go out.
 *
 * The sign-up endpoint is rate-limited per IP, but the address is the thing a
 * subscription-bombing run repeats — a thousand IPs, one victim. One confirm email an
 * hour per address caps what this site can contribute to someone's worst inbox day at
 * twenty-four messages, without a real reader who mistyped once ever noticing.
 */
export const CONFIRM_COOLDOWN_MS = 60 * 60_000

/** Pending sign-ups older than this were never going to confirm; the cron sweeps them. */
export const PENDING_MAX_AGE_MS = 30 * 24 * 60 * 60_000

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const newToken = () => randomBytes(24).toString('base64url')

// Add or re-subscribe an address (idempotent by email). Returns the token for the
// opt-in link, whether it is ALREADY confirmed (so the caller can skip the email), and
// whether a confirm email SHOULD go out now — false while the address is cooling down.
export async function addSubscriber(
  emailRaw: string,
): Promise<{ token: string; alreadyConfirmed: boolean; sendConfirm: boolean }> {
  const email = emailRaw.trim().toLowerCase()
  if (!EMAIL_RE.test(email) || email.length > 254) throw new SubscribeError('invalid_email')
  const now = nowMs()
  const row = one<{ status: SubStatus; token: string; deleted_at: number | null; confirm_sent_at: number | null }>(
    `select status, token, deleted_at, confirm_sent_at from subscribers where email = ?`, email,
  )
  if (row?.status === 'confirmed' && row.deleted_at === null) {
    return { token: row.token, alreadyConfirmed: true, sendConfirm: false }
  }
  // A deleted row starts the walk over (fresh cooldown included): the owner removed it,
  // so nothing about its previous life should decide what the new sign-up may do.
  const revived = row != null && row.deleted_at !== null
  const sendConfirm = revived
    || row?.confirm_sent_at == null
    || now - row.confirm_sent_at >= CONFIRM_COOLDOWN_MS
  const token = !row || revived ? newToken() : row.token
  // Re-subscribing after unsubscribing resets to 'pending', so the double opt-in is
  // walked again rather than silently re-enabling a removed address.
  run(
    `insert into subscribers (email, status, token, created_at, confirmed_at, deleted_at, confirm_sent_at)
     values ($email, 'pending', $token, $now, null, null, $sentAt)
     on conflict(email) do update set
       status = 'pending', token = excluded.token, confirmed_at = null, deleted_at = null,
       confirm_sent_at = coalesce(excluded.confirm_sent_at, subscribers.confirm_sent_at)`,
    { email, token, now, sentAt: sendConfirm ? now : null },
  )
  return { token, alreadyConfirmed: false, sendConfirm }
}

// Confirm a pending subscriber by token. Returns true if a pending row was flipped.
export async function confirmSubscriber(token: string): Promise<boolean> {
  if (!token) return false
  return run(
    `update subscribers set status = 'confirmed', confirmed_at = ?
      where token = ? and status = 'pending' and ${liveOnly('subscribers')}`,
    nowMs(), token,
  ).changes > 0
}

// Unsubscribe by token (from any state except already-unsubscribed).
export async function unsubscribeByToken(token: string): Promise<boolean> {
  if (!token) return false
  return run(
    `update subscribers set status = 'unsubscribed'
      where token = ? and status != 'unsubscribed' and ${liveOnly('subscribers')}`,
    token,
  ).changes > 0
}

// Confirmed recipients (email + token for the per-recipient unsubscribe link).
export async function getConfirmedSubscribers(): Promise<{ email: string; token: string }[]> {
  try {
    return all<{ email: string; token: string }>(
      `select email, token from subscribers where status = 'confirmed' and ${liveOnly('subscribers')}`,
    )
  } catch (error) {
    console.error(`[ERROR] subscribers.getConfirmedSubscribers: ${(error as Error).message}`)
    return []
  }
}

type SubRow = { id: number; email: string; status: SubStatus; created_at: number; confirmed_at: number | null; deleted_at: number | null }

const toSubscriber = (r: SubRow): Subscriber => ({
  id: r.id,
  email: r.email,
  status: r.status,
  createdAt: toIso(r.created_at),
  confirmedAt: r.confirmed_at == null ? undefined : toIso(r.confirmed_at),
  deletedAt: r.deleted_at == null ? undefined : toIso(r.deleted_at),
})

// Admin list (newest first). Live rows only — deleted ones live on the Trash screen.
export async function listSubscribers(): Promise<Subscriber[]> {
  try {
    return all<SubRow>(
      `select id, email, status, created_at, confirmed_at, deleted_at from subscribers
        where ${liveOnly('subscribers')} order by created_at desc, id desc`,
    ).map(toSubscriber)
  } catch (error) {
    console.error(`[ERROR] subscribers.listSubscribers: ${(error as Error).message}`)
    return []
  }
}

/** The Trash's Subscribers tab: soft-deleted rows, newest deletion first. */
export async function getTrashedSubscribers(): Promise<Subscriber[]> {
  try {
    return all<SubRow>(
      `select id, email, status, created_at, confirmed_at, deleted_at from subscribers
        where deleted_at is not null order by deleted_at desc, id desc`,
    ).map(toSubscriber)
  } catch (error) {
    console.error(`[ERROR] subscribers.getTrashedSubscribers: ${(error as Error).message}`)
    return []
  }
}

export async function subscriberCounts(): Promise<{ confirmed: number; pending: number; unsubscribed: number }> {
  const live = await listSubscribers()
  return {
    confirmed: live.filter((s) => s.status === 'confirmed').length,
    pending: live.filter((s) => s.status === 'pending').length,
    unsubscribed: live.filter((s) => s.status === 'unsubscribed').length,
  }
}

// The admin's remove: soft, restorable, and the send log stays with the row.
export async function deleteSubscriber(id: number): Promise<void> {
  run(`update subscribers set deleted_at = ? where id = ? and deleted_at is null`, nowMs(), id)
}

/** Put a trashed subscriber back exactly as it was, history and all. */
export async function restoreSubscriber(id: number): Promise<void> {
  run(`update subscribers set deleted_at = null where id = ?`, id)
}

// The REAL delete. Only reachable from the Trash, and this is where the send log for the
// address is cleared — otherwise purging a subscriber would leave their email on file.
export async function purgeSubscriber(id: number): Promise<void> {
  const row = one<{ email: string }>(
    `select email from subscribers where id = ? and deleted_at is not null`, id,
  )
  if (!row) return // live rows cannot be purged; they go through the soft delete first
  run(`delete from subscribers where id = ?`, id)
  await deleteSendsFor(row.email)
}

/** Empty the Subscribers trash tab. Returns how many rows were purged. */
export async function emptySubscribersTrash(): Promise<number> {
  const rows = await getTrashedSubscribers()
  for (const r of rows) await purgeSubscriber(r.id)
  return rows.length
}

/**
 * Sweep pending sign-ups that never confirmed, run by the hourly cron.
 *
 * A HARD delete, not a trip through the Trash: these rows are bot droppings and typos by
 * volume, and sweeping them into the Trash would just move the junk pile somewhere the
 * owner has to empty by hand — the exact chore the sweep exists to end. Thirty days is
 * far past any real reader's "I'll click it later". Their confirm-send log rows go too:
 * an address that never opted in should not stay on file inside a log.
 */
export async function sweepPendingSubscribers(maxAgeMs = PENDING_MAX_AGE_MS): Promise<number> {
  const cutoff = nowMs() - maxAgeMs
  const rows = all<{ id: number; email: string }>(
    `select id, email from subscribers
      where status = 'pending' and ${liveOnly('subscribers')} and created_at < ?`,
    cutoff,
  )
  for (const r of rows) {
    run(`delete from subscribers where id = ?`, r.id)
    await deleteSendsFor(r.email)
  }
  return rows.length
}
