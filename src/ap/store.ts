// WHO FOLLOWS THIS BLOG, WHAT IT HAS ALREADY SAID, AND WHAT IT STILL OWES.
//
// ADR 0059. Three tables, one module, because the three are read together by the sweep and
// nothing else reads any of them.
//
// ⚠️ `ap_sent` IS WHY THERE IS NO HOOK IN `savePost`. A post can become public three ways — a
// save that publishes it, the minute tick flipping a scheduled one live, and an MCP call — and
// hooking all three is three places to forget the fourth. The announcer instead COMPARES: a
// public post with no row is new, a row whose digest has changed is an edit, a row whose post is
// gone is a withdrawal. It is self-healing, and it already covers the path nobody has written.

import { createHash } from 'node:crypto'
import { all, one, run } from '@/store/query'
import { nowMs } from '@/store/db'

export type Follower = { actor: string; inbox: string; sharedInbox: string | null }

type FollowerRow = { actor: string; inbox: string; shared_inbox: string | null }

/**
 * Record a follower. Idempotent by primary key, which is what lets the inbox be replay-safe.
 *
 * `on conflict do update`: a server that re-sends a Follow after changing its inbox address is
 * telling us something true, and refusing it would leave deliveries going to the old one.
 */
export function addFollower(f: Follower): void {
  run(
    `insert into ap_followers (actor, inbox, shared_inbox, followed_at) values (?, ?, ?, ?)
     on conflict(actor) do update set inbox = excluded.inbox, shared_inbox = excluded.shared_inbox`,
    f.actor, f.inbox, f.sharedInbox, nowMs(),
  )
}

export const removeFollower = (actor: string): void => {
  run(`delete from ap_followers where actor = ?`, actor)
}

export const followerCount = (): number =>
  one<{ n: number }>(`select count(*) as n from ap_followers`)?.n ?? 0

export const followers = (): Follower[] =>
  all<FollowerRow>(`select actor, inbox, shared_inbox from ap_followers order by followed_at`)
    .map((r) => ({ actor: r.actor, inbox: r.inbox, sharedInbox: r.shared_inbox }))

/**
 * Every address one activity has to reach, each named once.
 *
 * ⚠️ THE SHARED INBOX IS THE WHOLE OF THE POLITENESS HERE. Four hundred followers on one server
 * is four hundred deliveries of the same bytes to the same machine if their personal inboxes are
 * used, and one delivery if its shared inbox is. The far end reads that difference as an attack
 * or as a neighbour.
 */
export const inboxesToReach = (): string[] =>
  [...new Set(followers().map((f) => f.sharedInbox || f.inbox))]

// ---------------------------------------------------------------------------
// What has already been said
// ---------------------------------------------------------------------------

export type Announced = { objectId: string; slug: string; digest: string; withdrawn: boolean }

type SentRow = { object_id: string; slug: string; digest: string; withdrawn_at: number | null }

export const announced = (): Announced[] =>
  all<SentRow>(`select object_id, slug, digest, withdrawn_at from ap_sent`)
    .map((r) => ({ objectId: r.object_id, slug: r.slug, digest: r.digest, withdrawn: r.withdrawn_at !== null }))

/** Said, or said again: `replaces` is the withdrawn row of the same page, which this one takes over. */
export function rememberAnnounced(objectId: string, slug: string, digest: string, replaces?: string): void {
  if (replaces && replaces !== objectId) run(`delete from ap_sent where object_id = ?`, replaces)
  run(
    `insert into ap_sent (object_id, slug, digest, sent_at, withdrawn_at) values (?, ?, ?, ?, null)
     on conflict(object_id) do update set slug = excluded.slug, digest = excluded.digest,
       sent_at = excluded.sent_at, withdrawn_at = null`,
    objectId, slug, digest, nowMs(),
  )
}

/** Its `Delete` is queued. The row stays: it is what gives the next return its id. */
export const withdrawAnnounced = (objectId: string): void => {
  run(`update ap_sent set withdrawn_at = ? where object_id = ?`, nowMs(), objectId)
}

// ---------------------------------------------------------------------------
// The id an object has, and the one it takes when it comes back
// ---------------------------------------------------------------------------

/**
 * ⚠️ A POST THAT COMES BACK FROM THE TRASH NEEDS AN ID IT HAS NEVER HAD (2026-11-04). Mastodon
 * keeps a `Tombstone` for every object id it is told is deleted, with no expiry, and
 * `Create#create_status` refuses any object whose id has one (`tombstone_exists?`); an `Update`
 * finds no status and falls through to that same `Create`. So the first announcement is the page
 * address, as every object already federated has it, and the n-th return is `<url>?r=<n>`, with
 * `url` still the page. `/{slug}?r=<n>` is the same page to a browser, and the same object to a
 * server only while `n` is the id it has now.
 */
const RETURN = /\?r=([1-9]\d*)$/

/** The page an object id belongs to. */
export const pageOf = (objectId: string): string => objectId.replace(RETURN, '')

/** Which return an object id is: 0 for the page address itself. */
export const returnOf = (objectId: string): number => Number(RETURN.exec(objectId)?.[1] ?? 0)

export const idAt = (url: string, n: number): string => (n === 0 ? url : `${url}?r=${n}`)

/** The ledger row of the page at `url`: there is at most one. */
export const ledgerOf = (url: string, rows: Announced[] = announced()): Announced | undefined =>
  rows.find((r) => pageOf(r.objectId) === url)

/** The id the object at `url` has now, or is about to be announced under. */
export const currentIdOf = (url: string, row: Announced | undefined): string =>
  !row ? url : row.withdrawn ? idAt(url, returnOf(row.objectId) + 1) : row.objectId

/**
 * What a note SAYS, as one short string.
 *
 * Over the rendered object rather than over the post, and that is the point: an edit that
 * changes nothing a follower can see — a category, a series position, an SEO description — is
 * not worth an `Update`, and an Update that says nothing new is noise in somebody's timeline.
 */
export const digestOfNote = (note: Record<string, unknown>): string =>
  createHash('sha256').update(JSON.stringify([
    note.content, note.url, note.attachment, note.tag, note.contentMap,
  ])).digest('hex').slice(0, 32)

// ---------------------------------------------------------------------------
// What is still owed
// ---------------------------------------------------------------------------

export type Delivery = { id: number; inbox: string; body: string; attempts: number }

/** Put one activity on its way to every address, as one row each. */
export function enqueue(body: string, inboxes: readonly string[]): number {
  const now = nowMs()
  for (const inbox of inboxes) {
    run(`insert into ap_queue (inbox, body, attempts, next_at) values (?, ?, 0, ?)`, inbox, body, now)
  }
  return inboxes.length
}

export const due = (limit: number): Delivery[] =>
  all<Delivery>(
    `select id, inbox, body, attempts from ap_queue where next_at <= ? order by next_at limit ?`,
    nowMs(), limit,
  )

export const delivered = (id: number): void => { run(`delete from ap_queue where id = ?`, id) }

/**
 * How long to wait before trying a delivery again, and when to stop.
 *
 * ⚠️ IT GIVES UP. A server that has been gone for a day is a server that may be gone for good,
 * and a queue that never empties is a queue that grows until the disk does. Six attempts over
 * roughly an hour is enough to ride out a restart or a deploy on the far end, which is what the
 * overwhelming majority of failures are.
 */
export const MAX_ATTEMPTS = 6

export function failed(id: number, attempts: number, error: string): void {
  if (attempts + 1 >= MAX_ATTEMPTS) {
    run(`delete from ap_queue where id = ?`, id)
    return
  }
  // Doubling from a minute: 1, 2, 4, 8, 16. A fixed retry is a flood to whoever is already down.
  const wait = 60_000 * 2 ** attempts
  run(
    `update ap_queue set attempts = attempts + 1, next_at = ?, last_error = ? where id = ?`,
    nowMs() + wait, error.slice(0, 200), id,
  )
}

export const queueDepth = (): number =>
  one<{ n: number }>(`select count(*) as n from ap_queue`)?.n ?? 0
