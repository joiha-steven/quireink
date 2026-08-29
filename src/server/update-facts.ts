// What the daily check may say about this blog beyond its version, and the rule that
// shapes all of it.
//
// Split out of `update-check.ts` on 2026-08-29 when that file passed its 400-line cap: the
// guard says split by subject rather than squeeze, and this is one subject — four questions
// about the blog itself, none of which the call's own machinery (the day lock, the token,
// the spread, the timeout) has any opinion about.
//
// The protocol these feed is written out in `docs/update-check.md` and in the comment at the
// top of `update-check.ts`, and the sentence the owner reads before deciding lives in eleven
// translations of `updateCheckDesc`. A field added here without moving all three is a field
// this project promised it was not sending.

import { statSync } from 'node:fs'
import { liveOnly } from '@/store/db'
import { one } from '@/store/query'

const DAY_MS = 86_400_000

/**
 * What the numbers page can honestly ask for, and the rule that shapes all of it.
 *
 * EVERY FIELD HERE IS A BUCKET, never a value. The point of the daily token is that today's
 * blog cannot be tied to yesterday's, and a field precise enough to be a fingerprint would
 * hand that back: with a dozen blogs checking in on a given day, an exact post count plus a
 * country plus a language names one install as surely as its domain would. Steps are wide
 * enough that many blogs share each one, and the receiving end stores every field on its own
 * — never crossed with another — for the same reason.
 *
 * They exist because the count alone could not answer the two questions worth asking. AGE
 * separates a blog somebody still runs from a container somebody made and deleted, which no
 * count of daily tokens can do without following an install across days. SIZE separates
 * kicking the tyres from writing. LANGUAGE says which of eleven translations earn their
 * keep. INSTALL says which of the install pages actually produces blogs.
 *
 * Anything unknown is simply absent, and the receiver reads an absent field as "unknown"
 * rather than dropping the line — every 2.2.x install will go on sending the old shape for
 * months, and a receiver that discarded those would report a cliff that never happened.
 */

/** Coarse age of the blog: 0 today · 1 within a week · 2 within a month · 3 within a
    quarter · 4 older. Taken from when the owner claimed it, so it survives a backup being
    restored on another machine — the same reading `first_done` already has. */
export function ageBucket(now: number): string {
  const row = one<{ at: number | null }>(`select min(created_at) as at from users`)
  if (!row?.at) return '' // nobody has claimed this blog yet, so it has no age to state
  const days = Math.floor((now - row.at) / DAY_MS)
  return days <= 0 ? '0' : days <= 7 ? '1' : days <= 30 ? '2' : days <= 90 ? '3' : '4'
}

/** Coarse size: 0 empty · 1 up to five · 2 up to twenty-five · 3 more. Published posts
    only — a drafts folder is not a blog somebody reads. */
export function sizeBucket(): string {
  const row = one<{ n: number }>(
    `select count(*) as n from posts where ${liveOnly('posts')} and status = 'published'`,
  )
  const n = row?.n ?? 0
  return n === 0 ? '0' : n <= 5 ? '1' : n <= 25 ? '2' : '3'
}

/**
 * How this copy was installed.
 *
 * `QUIRE_INSTALL` is set by the things that already know — the compose files, the Unraid
 * template, the droplet's cloud-init — and is the only way to tell a NAS from a laptop,
 * because from inside the process they look identical. Absent, the one honest distinction
 * left is whether there is a container around us, and `/.dockerenv` is the file Docker has
 * put there since 2013. Bounded and character-checked: it is a value from the environment,
 * and it goes into a URL.
 */
export function installKind(): string {
  const declared = (process.env.QUIRE_INSTALL ?? '').trim().toLowerCase()
  if (/^[a-z0-9-]{1,16}$/.test(declared)) return declared
  try {
    return statSync('/.dockerenv').isFile() ? 'docker' : 'source'
  } catch {
    return 'source'
  }
}
