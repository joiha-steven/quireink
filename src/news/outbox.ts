// A newsletter on its way out, in the database: the run, and one row per address it owes.
//
// WHY IT IS NOT IN MEMORY ANY MORE. The send loop kept its place in a variable. On Cloudflare the
// blog is a Durable Object, which restarts after every deploy and can be evicted or reset at any
// moment; a Bun process restarts on every upgrade. Either way the variable went and the loop with
// it: the list stopped half-way with nothing to say so, and the one thing the screen offered next
// was the resend box, which mails the first half a second time. A newsletter cannot be unsent.
//
// THE ONE RULE EVERYTHING HERE SERVES: a row goes `owed` → `sending` exactly once, in a
// transaction, BEFORE its message is handed to the relay, and never goes back. So no runner — this
// one, a second one after a restart, two processes on one database during a deploy — can ever
// take the same address twice. On Bun the claim is committed with `synchronous = FULL` before the
// socket is written; in a Durable Object a storage write is confirmed before the object's next
// outgoing message leaves (its output gate).
//
// The price of that rule is honest and small: a runner cut off between the claim and the answer
// leaves ONE row in `sending`, and nobody can know whether the relay took it. The next runner looks
// in the send log — `sendMail` writes a delivered message's open token there — and when the log
// cannot say, the address is recorded as failed with `interrupted` and is NOT tried again. One
// person who may have missed it is the right side of that trade; a whole list mailed twice is not.
//
// The LEASE is liveness, not safety. It says which runner is delivering now, so a restarted blog
// waits for a live one instead of starting a second, and takes over from a dead one within
// `LEASE_MS`. A runner renews it every `HEARTBEAT_MS` while it works, including while one message
// is slow; one that misses it by stalling loses only a count, never a recipient's single copy.
// SERVER-ONLY.

import { all, one, run, tx } from '@/store/query'
import { newOpenToken } from '@/news/newsletter-log'

/** How long a runner that stopped renewing is waited for before another takes the send over. */
export const LEASE_MS = 90_000

/** How often a live runner renews its lease: several times inside `LEASE_MS`, so one late beat is harmless. */
export const HEARTBEAT_MS = 20_000

/** The error a send cut off mid-message is logged with. The owner reads it in People. */
export const INTERRUPTED = 'interrupted: the blog restarted while this one was with the mail server; it may have arrived, and it is not sent twice'

/** What the screen polls: the run in progress, or the last one to finish. */
export type BroadcastRun = {
  slugs: string[]
  recipients: number
  sent: number
  failed: number
  done: boolean
  startedAt: number
}

type RunRow = {
  id: number; slugs: string; letter: string; recipients: number; sent: number; failed: number
  started_at: number; finished_at: number | null; lease_owner: string | null; lease_until: number
}

const RUN_COLS = 'id, slugs, letter, recipients, sent, failed, started_at, finished_at, lease_owner, lease_until'

const view = (r: RunRow): BroadcastRun => ({
  slugs: JSON.parse(r.slugs) as string[],
  recipients: r.recipients,
  sent: r.sent,
  failed: r.failed,
  done: r.finished_at !== null,
  startedAt: r.started_at,
})

/** The run still going out, if any. At most one: `openRun` refuses a second. */
const unfinished = (): RunRow | null =>
  one<RunRow>(`select ${RUN_COLS} from broadcast_runs where finished_at is null order by id limit 1`)

/** The run in progress, or the last one to finish; null before the first send this blog made. */
export function latestRun(): BroadcastRun | null {
  const r = one<RunRow>(`select ${RUN_COLS} from broadcast_runs order by id desc limit 1`)
  return r ? view(r) : null
}

/** Whether a send is still owed anyone. One lookup, which is all the minute tick pays when idle. */
export function hasOpenRun(): boolean {
  return one<{ id: number }>(`select id from broadcast_runs where finished_at is null limit 1`) !== null
}

/** True when nobody holds the open run's lease: its runner is gone, or has not started. */
export function leaseLapsed(now: number = Date.now()): boolean {
  const r = unfinished()
  return r !== null && r.lease_until <= now
}

/**
 * Write the whole send down before any of it goes: the run and one `owed` row per address, in one
 * transaction, so a restart a millisecond later still knows every address it owes. Null when a run
 * is already open — checked inside the transaction, because two presses can both pass the route's
 * own checks while each awaits its settings. Finished runs are dropped here: only the latest is
 * ever shown, and their sends live on in `newsletter_sends`.
 */
export function openRun(input: {
  slugs: string[]; letter: string; subs: { email: string; token: string }[]; now: number
}): BroadcastRun | null {
  return tx(() => {
    if (unfinished()) return null
    run(`delete from broadcast_runs where finished_at is not null`)
    const created = one<{ id: number }>(
      `insert into broadcast_runs (slugs, letter, recipients, started_at) values (?, ?, ?, ?) returning id`,
      JSON.stringify(input.slugs), input.letter, input.subs.length, input.now,
    )
    const id = created!.id
    for (const s of input.subs) {
      run(`insert into broadcast_outbox (run_id, email, token) values (?, ?, ?)`, id, s.email, s.token)
    }
    return { slugs: input.slugs, recipients: input.subs.length, sent: 0, failed: 0, done: false, startedAt: input.now }
  })
}

/** What the runner is to do next. */
export type Step =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'finished'; run: BroadcastRun; interrupted: { email: string; slugs: string[] }[] }
  | {
    kind: 'claimed'; id: number; email: string; token: string; openToken: string
    runId: number; slugs: string[]; letter: string; interrupted: { email: string; slugs: string[] }[]
  }

/**
 * Take the lease and the next owed address, or finish the run when none is left. One transaction:
 * the lease check, the settling of a dead runner's last message, and the claim cannot be pulled
 * apart by another request in between.
 *
 * `interrupted` is the addresses whose message was in doubt when this runner took over (above). The
 * caller logs them through `logSend`, the one place a send is written down; they are already
 * counted as failed here.
 */
export function claimNext(owner: string, now: number = Date.now()): Step {
  return tx((): Step => {
    const job = unfinished()
    if (!job) return { kind: 'idle' }
    if (job.lease_owner !== owner && job.lease_until > now) return { kind: 'busy' }
    const slugs = JSON.parse(job.slugs) as string[]
    const interrupted = job.lease_owner === owner ? [] : settle(job.id).map((email) => ({ email, slugs }))
    const next = one<{ id: number; email: string; token: string }>(
      `select id, email, token from broadcast_outbox where run_id = ? and state = 'owed' order by id limit 1`, job.id,
    )
    if (!next) {
      run(`update broadcast_runs set finished_at = ?, lease_owner = null, lease_until = 0 where id = ?`, now, job.id)
      run(`delete from broadcast_outbox where run_id = ?`, job.id)
      // Stamp even when nobody was reachable: it records that these posts have been through the
      // send flow, and keeps the column meaningful for anything still reading it.
      run(`update posts set broadcast_at = ? where slug in (select value from json_each(?))`, now, job.slugs)
      const done = one<RunRow>(`select ${RUN_COLS} from broadcast_runs where id = ?`, job.id)!
      return { kind: 'finished', run: view(done), interrupted }
    }
    const openToken = newOpenToken()
    run(`update broadcast_outbox set state = 'sending', claimed_at = ?, open_token = ? where id = ?`, now, openToken, next.id)
    run(`update broadcast_runs set lease_owner = ?, lease_until = ? where id = ?`, owner, now + LEASE_MS, job.id)
    return { kind: 'claimed', id: next.id, email: next.email, token: next.token, openToken, runId: job.id, slugs, letter: job.letter, interrupted }
  })
}

/**
 * A dead runner's message in flight, decided from the send log. Delivered: `sendMail` logged it with
 * the open token claimed for it. Refused: a failure row for that address since the claim. Neither:
 * nobody knows, and it is not sent again (the file's header). Returns the addresses in that last
 * case, for the caller to log; all three are settled and counted here.
 */
function settle(runId: number): string[] {
  const unknown: string[] = []
  let sent = 0
  let failed = 0
  for (const r of all<{ id: number; email: string; open_token: string | null; claimed_at: number | null }>(
    `select id, email, open_token, claimed_at from broadcast_outbox where run_id = ? and state = 'sending'`, runId,
  )) {
    const delivered = r.open_token !== null
      && one<{ ok: number }>(`select ok from newsletter_sends where open_token = ? and ok = 1`, r.open_token) !== null
    if (delivered) sent++
    else {
      failed++
      const refused = one<{ id: number }>(
        `select id from newsletter_sends where email = lower(trim(?)) and kind = 'broadcast' and ok = 0 and sent_at >= ? limit 1`,
        r.email, r.claimed_at ?? 0,
      )
      if (!refused) unknown.push(r.email)
    }
    run(`update broadcast_outbox set state = ? where id = ?`, delivered ? 'sent' : 'failed', r.id)
  }
  if (sent || failed) run(`update broadcast_runs set sent = sent + ?, failed = failed + ? where id = ?`, sent, failed, runId)
  return unknown
}

/**
 * Write down how one message went, and renew the lease. Only a row still in `sending` is counted:
 * one a successor settled while this runner stalled has been counted once already. False when this
 * runner no longer holds the lease, which is its cue to stop.
 */
export function recordResult(owner: string, id: number, ok: boolean, now: number = Date.now()): boolean {
  return tx(() => {
    const row = one<{ run_id: number }>(`select run_id from broadcast_outbox where id = ?`, id)
    if (!row) return false
    const moved = run(`update broadcast_outbox set state = ? where id = ? and state = 'sending'`, ok ? 'sent' : 'failed', id).changes
    if (moved) run(`update broadcast_runs set sent = sent + ?, failed = failed + ? where id = ?`, ok ? 1 : 0, ok ? 0 : 1, row.run_id)
    return run(
      `update broadcast_runs set lease_until = ? where id = ? and lease_owner = ? and finished_at is null`,
      now + LEASE_MS, row.run_id, owner,
    ).changes > 0
  })
}

/** The heartbeat. False when the lease is someone else's now. */
export function renewLease(owner: string, now: number = Date.now()): boolean {
  return run(
    `update broadcast_runs set lease_until = ? where lease_owner = ? and finished_at is null`, now + LEASE_MS, owner,
  ).changes > 0
}

/** Let go on the way out, so a successor need not wait out the lease. */
export function releaseLease(owner: string): void {
  run(`update broadcast_runs set lease_until = 0 where lease_owner = ? and finished_at is null`, owner)
}
