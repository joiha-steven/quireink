// A reader's marks, kept across their devices (ADR 0047) — without an account.
//
// Tier one of the reader's pen (ADR 0043) keeps a mark in the browser it was made in. This
// is tier two: the same marks, on the server, under a name that is not the reader's. Two
// ways to have one:
//
// - A NOTEBOOK CODE, minted here and shown once, in the shape of the setup code: twenty
//   letters and digits from an alphabet with no look-alikes, in groups of four. The browser
//   keeps it and sends it as a header; the server keeps only its hash. Anyone holding the
//   code holds the marks, which is the whole of the design — it is a key, not an identity.
// - The COMMENTER COOKIE a reader already has after signing in with Google to comment
//   (ADR 0013). The reader id is an HMAC of the address under its own secret, so the table
//   never holds an address and cannot be joined back to one.
//
// What is stored is exactly what the browser stores (`assets/js/pen-store.ts`): a JSON list
// of marks per page, opaque to the server beyond a shape check and a size cap. Nothing here
// is shown to the owner; a reader's marks are the reader's.

import { createHash, createHmac, randomInt } from 'node:crypto'
import type { Context } from 'hono'
import { getCookie } from 'hono/cookie'
import { all, one, run } from '@/store/query'
import { nowMs } from '@/store/db'
import { serverSecret } from '@/auth/secret'
import { COMMENTER_COOKIE, readCommenter } from '@/comments/commenter'

/** The header a browser sends its notebook code in. */
export const CODE_HEADER = 'x-quire-pen'

/** No 0/O, 1/l/i: a code is read back from a piece of paper. */
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
const CODE_CHARS = 20
/** A page of marks is small; this is a page with five hundred marks and a note on each. */
export const MAX_BODY_BYTES = 128 * 1024
/** Pages per reader before the oldest go: a reader, not a crawler. */
export const MAX_PAGES = 500
/** A mark nobody has touched in a year, or a code nobody has used in one, is gone. */
export const RETENTION_MS = 365 * 24 * 60 * 60 * 1000

/**
 * A code with NOTHING under it, unused for this long, is gone.
 *
 * The year above is right for a code that holds somebody's marks and wrong for one that
 * holds nothing: minting is the cheap half of this pair (a row and twenty characters) and
 * storing is the expensive half, so a code nobody ever wrote under is pure inventory. It is
 * also the first step of the only way to fill this table on purpose — five codes an hour
 * per address, each able to hold `MAX_PAGES` pages, held for a year.
 *
 * Seven days rather than one: `last_used_at` is stamped on every request the browser makes
 * with the code, so a week means the browser has not been near the blog either. A reader who
 * wrote a code on paper and has not opened it in a week has nothing stored under it to lose.
 */
const UNUSED_CODE_TTL_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Everything this table may hold, across every reader.
 *
 * The per-reader caps bound one reader; nothing bounded the sum, and the sum is what fills a
 * disk. At the ceiling that is 4,096 readers each holding `MAX_PAGES` pages of the largest
 * body this accepts, which no blog will reach and a script cannot pass. A real page of marks
 * measures in single kilobytes, so this is millions of them.
 *
 * Trimmed oldest-first when it is exceeded, in the tick and never on the request path: the
 * budget is for the operator's disk, and a reader mid-save is not who should pay for it.
 */
export const MAX_TOTAL_BYTES = 256 * 1024 * 1024

/**
 * Rows dropped per pass, and passes per tick: bounded work on a table nobody is waiting on.
 *
 * Small on purpose. The loop re-measures between passes, so the batch size is the most it
 * can overshoot the budget by — twenty-five pages of whoever has not marked anything in the
 * longest time. Fifty passes is 1,250 pages a tick, which is more than the ceiling can gain
 * between two ticks; what one pass cannot finish the next tick does.
 */
const TRIM_BATCH = 25
const TRIM_PASSES = 50

export type Reader = { id: string; via: 'code' | 'google' }

const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex')
const normalise = (code: string): string => code.toLowerCase().replace(/[^a-z0-9]/g, '')

/** A fresh code, known from this moment; the plaintext is returned once and never stored. */
export function mintCode(): string {
  let raw = ''
  for (let i = 0; i < CODE_CHARS; i++) raw += ALPHABET[randomInt(ALPHABET.length)]
  const now = nowMs()
  run(`insert into reader_keys (key_hash, created_at, last_used_at) values (?, ?, ?)`, sha256(raw), now, now)
  return raw.replace(/(.{4})(?=.)/g, '$1-')
}

/** The reader a code names, or null; a known code is stamped as used. */
export function readerOfCode(code: string): Reader | null {
  const clean = normalise(code)
  if (clean.length !== CODE_CHARS) return null
  const hash = sha256(clean)
  const hit = one<{ key_hash: string }>(`select key_hash from reader_keys where key_hash = ?`, hash)
  if (!hit) return null
  run(`update reader_keys set last_used_at = ? where key_hash = ?`, nowMs(), hash)
  return { id: `k:${hash}`, via: 'code' }
}

export function readerOfEmail(email: string): Reader {
  const mac = createHmac('sha256', serverSecret('reader-marks')).update(email.trim().toLowerCase()).digest('hex')
  return { id: `g:${mac}`, via: 'google' }
}

/** Who is asking: the code header first, then the commenter cookie; null is nobody. */
export function readerOf(c: Context): Reader | null {
  const code = c.req.header(CODE_HEADER)
  if (code) return readerOfCode(code)
  const who = readCommenter(getCookie(c, COMMENTER_COOKIE))
  return who ? readerOfEmail(who.email) : null
}

/** The stored body for a page, or null when this reader has never saved that page. */
export function getMarks(reader: string, path: string): string | null {
  return one<{ body: string }>(`select body from reader_marks where reader = ? and path = ?`, reader, path)?.body ?? null
}

/**
 * Keep a page's marks. The body must be a JSON list of objects each naming its `exact`
 * words — the one field every mark has and the one the anchor cannot do without; the rest
 * is the browser's business. Returns false for anything else, or anything too large.
 */
export function putMarks(reader: string, path: string, body: string): boolean {
  if (Buffer.byteLength(body) > MAX_BODY_BYTES) return false
  let items: unknown
  try { items = JSON.parse(body) } catch { return false }
  if (!Array.isArray(items) || !items.every((m) => m && typeof m === 'object' && typeof (m as { exact?: unknown }).exact === 'string')) return false
  const now = nowMs()
  run(`insert into reader_marks (reader, path, body, updated_at) values (?, ?, ?, ?)
       on conflict (reader, path) do update set body = excluded.body, updated_at = excluded.updated_at`,
    reader, path, JSON.stringify(items), now)
  run(`delete from reader_marks where reader = ? and path in (
         select path from reader_marks where reader = ? order by updated_at desc limit -1 offset ?)`,
    reader, reader, MAX_PAGES)
  return true
}

/** Everything this reader kept here, and the code that named them if there was one. */
export function forgetReader(reader: Reader): void {
  run(`delete from reader_marks where reader = ?`, reader.id)
  if (reader.via === 'code') run(`delete from reader_keys where key_hash = ?`, reader.id.slice(2))
}

/**
 * Rows past the retention window, both tables, plus the two ceilings; how many went.
 *
 * `budget` is a parameter so the ceiling can be exercised without writing 256 MB to a disk
 * in a test. Callers pass nothing.
 */
export function sweepReaderMarks(now = nowMs(), budget = MAX_TOTAL_BYTES): number {
  try {
    const cutoff = now - RETENTION_MS
    let gone = run(`delete from reader_marks where updated_at < ?`, cutoff).changes
      + run(`delete from reader_keys where last_used_at < ?`, cutoff).changes

    // A code holding nothing, untouched for a week. `substr(reader, 3)` drops the `k:`
    // prefix `readerOfCode` puts on the id; a Google-signed reader has no key row at all.
    gone += run(
      `delete from reader_keys where last_used_at < ? and key_hash not in (
         select substr(reader, 3) from reader_marks where reader like 'k:%')`,
      now - UNUSED_CODE_TTL_MS,
    ).changes

    // The table's own ceiling, oldest first, in small batches with a re-measure between
    // them. Not one computed delete: `sum(length(body))` counts CHARACTERS, so a body with
    // any multi-byte text in it reads short, and a single delete sized from that number
    // would take out more rows than the overage called for. A hundred at a time overshoots
    // by at most a hundred; what a pass cannot finish, the next tick does.
    for (let pass = 0; pass < TRIM_PASSES; pass++) {
      const used = one<{ n: number }>(`select coalesce(sum(length(body)), 0) as n from reader_marks`)?.n ?? 0
      if (used <= budget) break
      gone += run(
        `delete from reader_marks where rowid in (
           select rowid from reader_marks order by updated_at asc limit ?)`,
        TRIM_BATCH,
      ).changes
    }
    return gone
  } catch (error) {
    console.error(`[ERROR] reader-marks.sweep: ${(error as Error).message}`)
    return 0
  }
}

/** For the test: the pages a reader has, newest first. */
export function pagesOf(reader: string): string[] {
  return all<{ path: string }>(`select path from reader_marks where reader = ? order by updated_at desc`, reader).map((r) => r.path)
}
