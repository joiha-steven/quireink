// The render caches, in SQLite. Two tables, because the two producers do not have the same
// shape and pretending they did cost half a gigabyte (ADR 0062).
//
// `render_cache` is content-addressed: highlighting is an expensive pure function of its own
// input, so the input IS the key and there is no invalidation problem. A changed input is a
// different key and a stale row is inert — which is why this cache is deliberately NOT
// emptied by `clearCache()` (Invariant 1) and survives a restart.
//
// `body_cache` keeps ONE ROW PER PIECE. The same hash still decides hit from miss, but it is
// a column rather than the key, so a fresh render takes the row the last one had. That is the
// sentence the other shape could not say, and not saying it meant nothing ever superseded
// anything: 20,001 rows and 502 MB holding 5.6 MB of distinct HTML, measured 2026-09-22.
//
// Extracted from `highlight.ts` when the rendered BODY joined the highlighter in here.
// Schema note in `docs/spec/01-schema.md` section 4.

import { createHash } from 'node:crypto'
import { one, run } from '@/store/query'
import { nowMs } from '@/store/db'

/**
 * A key from any number of parts, separated so that "ab" + "c" cannot collide with
 * "a" + "bc".
 *
 * The separator is the escape `\0`, never a literal NUL byte. `highlight.ts` had three
 * of those typed straight into a template literal, which is why `grep` reported that file
 * as binary and refused to search it: a source file the tools will not read is a source
 * file nobody edits confidently.
 */
export const renderKey = (...parts: string[]): string =>
  createHash('sha256').update(parts.join('\0')).digest('hex')

export function readRendered(key: string): string | null {
  try {
    return one<{ html: string }>(`select html from render_cache where key = ?`, key)?.html ?? null
  } catch {
    // A cache that cannot be read is a slower render, never a failed one. This runs before
    // `openDatabases` in some tooling, and must not be the reason a page 500s.
    return null
  }
}

export function writeRendered(key: string, html: string): void {
  try {
    run(
      `insert into render_cache (key, html, created_at) values (?, ?, ?)
       on conflict(key) do nothing`,
      key, html, nowMs(),
    )
  } catch {
    /* see readRendered */
  }
}

/**
 * How long a row is kept.
 *
 * Every deploy strands a generation of body rows, because the build commit is part of the
 * body key — so the table grows with deploys as much as with writing, and nothing here was
 * ever deleting. The rows are full HTML, so what grew was `quire.db` and every R2 snapshot
 * taken of it.
 */
export const RENDER_CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Rows per sweep. The delete scans `created_at`, which is not indexed, and this runtime has
 * one thread: a first sweep over a table that has been filling for months must not be the
 * request that blocks every reader. What is left over goes on the next tick.
 */
const PRUNE_BATCH = 5_000

/**
 * The rendered body of one piece, if the row standing in its slot was rendered from exactly
 * these inputs.
 *
 * The key is compared IN SQL rather than read back and compared here: a miss would otherwise
 * pull up to 88 KB of superseded HTML across the boundary to throw it away, and a miss is
 * what happens to every piece on the first read after a deploy.
 */
export function readBody(slot: string, key: string): string | null {
  try {
    return one<{ html: string }>(
      `select html from body_cache where slot = ? and key = ?`, slot, key,
    )?.html ?? null
  } catch {
    // See `readRendered`: a cache that cannot be read is a slower page, never a failed one.
    return null
  }
}

/**
 * Store the rendered body in the piece's slot, replacing whatever was there.
 *
 * `do update` rather than `do nothing`, which is the whole difference from `writeRendered`:
 * the row that was there was rendered from inputs that no longer hold, and it is not coming
 * back. One writer, synchronously, so there is no race to lose.
 */
export function writeBody(slot: string, key: string, html: string): void {
  try {
    run(
      `insert into body_cache (slot, key, html, created_at) values (?, ?, ?, ?)
       on conflict(slot) do update set
         key = excluded.key, html = excluded.html, created_at = excluded.created_at`,
      slot, key, html, nowMs(),
    )
  } catch {
    /* see readRendered */
  }
}

/**
 * Delete rows older than `maxAgeMs`. Returns how many went.
 *
 * Age, not use: nothing records a read, and adding a `last_read` write to the read path
 * would turn every cache HIT into a database write. The cost of getting it wrong is one
 * re-render — the cache is content-addressed and self-healing, so a pruned row that was
 * still hot comes straight back. There is deliberately no VACUUM: the database runs in WAL
 * mode, the freed pages are reused by the next inserts, and a VACUUM here has cost this
 * project a database before.
 */
export function pruneRendered(maxAgeMs = RENDER_CACHE_MAX_AGE_MS): number {
  const cutoff = nowMs() - maxAgeMs
  try {
    // The subselect is how the batch is bounded: `delete ... limit` needs a SQLite compiled
    // with SQLITE_ENABLE_UPDATE_DELETE_LIMIT, which is not something to depend on.
    const rendered = run(
      `delete from render_cache where key in (
         select key from render_cache where created_at < ? limit ?
       )`,
      cutoff, PRUNE_BATCH,
    ).changes
    // `body_cache` bounds itself by shape, so this is a net rather than a collector: what it
    // finds is a slot nothing renders any more — a piece renamed, so its old slug's row was
    // never taken by anything. A live row is rewritten on every deploy and never reaches the
    // cutoff, and a quiet piece swept by mistake costs one render.
    const bodies = run(
      `delete from body_cache where slot in (
         select slot from body_cache where created_at < ? limit ?
       )`,
      cutoff, PRUNE_BATCH,
    ).changes
    return rendered + bodies
  } catch {
    return 0 // see readRendered: a cache that cannot be swept is not a failed request
  }
}
