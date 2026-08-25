// Deferred image work: the variants and thumbs that are generated AFTER a media row
// exists, so an upload never waits on encoding. Split from media.ts because it is the
// only part with no request on the other end: it runs post-save and from cron.

import { uploadFile, readBlob, collapseBlob } from '@/media/blob'
import { makeThumb, makeDisplay } from '@/media/image'
import { all, one, run } from '@/store/query'
import { liveOnly } from '@/store/db'

/**
 * How long one sweep may spend encoding before it stops and leaves the rest for next time.
 *
 * A BUDGET IN TIME, not a count, and the reason is what it is defending against. `Bun.serve`
 * closes a request that has produced nothing for its `idleTimeout`, and the cron tick is the
 * one route in this product that can run for minutes: on the demo, eighteen pending
 * originals at about 1.4 s each. What the operator saw was `curl: (52) Empty reply from
 * server` and a tick that appeared to do nothing — while it had in fact finalised seven and
 * been cut off. A count would have to be tuned per box and per image size; a deadline tunes
 * itself, and the sweep is idempotent so whatever is left is simply next hour's work.
 *
 * `pruneRendered` bounds itself the same way, by batch, for the same reason.
 */
export const VARIANT_BUDGET_MS = 6_000

// Generate deferred display variants for pending raster originals (variants = 0).
// Called after a save; cron sweeps anything left pending. Returns how many originals were
// NEWLY finalized so callers can re-purge the pages that embed them (a page cached at save
// time still shows the plain <img> until its <picture> exists).
//
// `budgetMs` of `Infinity` is for the callers with nobody waiting on them: the upload route
// hands this off with `void` AFTER answering, so there is no request left to time out and
// stopping early would only leave the reader the picture they just uploaded unoptimised.
export async function finalizeVariants(
  pathnames: string[],
  budgetMs: number = Infinity,
): Promise<number> {
  const targets = [...new Set(pathnames)].filter((p) => /\.(jpe?g|png)$/i.test(p))
  if (targets.length === 0) return 0
  const deadline = Date.now() + budgetMs
  let finalized = 0
  for (const path of targets) {
    // Checked BEFORE the work, never after: stopping once the clock has already been blown
    // is the same as not stopping.
    if (Date.now() >= deadline) break
    const row = one<{ variants: number }>(`select variants from media where path = ?`, path)
    if (!row || row.variants) continue
    // Read the original from the store DIRECTLY. `fetch`ing the blob URL breaks on the local
    // driver: blobUrl/expandBlob is a store-relative `/uploads/...` path (no origin) and
    // server-side fetch throws "Failed to parse URL". null = not on the store; a sweep retries.
    const original = await readBlob(path).catch(() => null)
    if (!original) continue
    const stem = path.replace(/\.[^.]+$/, '')
    const files = await makeDisplay(original)
    await Promise.all(files.map((f) => uploadFile(`${stem}${f.suffix}`, f.data, f.contentType)))
    run(`update media set variants = 1 where path = ?`, path)
    finalized++
  }
  return finalized
}

// Backfill thumbs for rows that have none (script/migration imports). Raster gets a
// real `-thumb.webp`; everything else points `thumb` at the original. Cron-swept.
export async function finalizePendingThumbs(): Promise<number> {
  const targets = all<{ path: string }>(
    `select path from media where ${liveOnly('media')} and thumb is null`,
  )
  let done = 0
  for (const { path } of targets) {
    if (/\.(jpe?g|png)$/i.test(path)) {
      const original = await readBlob(path).catch(() => null) // direct store read (see finalizeVariants)
      if (!original) continue
      const stem = path.replace(/\.[^.]+$/, '')
      const thumbPath = `${stem}-thumb.webp`
      await uploadFile(thumbPath, await makeThumb(original), 'image/webp')
      run(`update media set thumb = ? where path = ?`, thumbPath, path)
    } else {
      // Vector/animation/webp: the original is its own thumbnail.
      run(`update media set thumb = ? where path = ?`, path, path)
    }
    done++
  }
  return done
}

// Finalize every uploaded raster referenced by a piece of content (body + image).
// Returns how many originals were newly finalized (0 = nothing to re-purge).
export async function finalizeContentMedia(content: string, featuredImage?: string): Promise<number> {
  const text = `${collapseBlob(content)} ${featuredImage ? collapseBlob(featuredImage) : ''}`
  const refs = [...text.matchAll(/media\/[^\s")'#]+\.(?:jpe?g|png)/gi)].map((m) => m[0])
  return finalizeVariants(refs)
}

// Cron backstop: sweep all raster originals still pending variants, in case a
// background finalize never ran.
export async function finalizePendingVariants(
  budgetMs: number = VARIANT_BUDGET_MS,
): Promise<number> {
  const paths = all<{ path: string }>(
    `select path from media where ${liveOnly('media')} and variants = 0`,
  )
    .map((r) => r.path)
    .filter((p) => /\.(jpe?g|png)$/i.test(p))
  if (paths.length === 0) return 0
  return finalizeVariants(paths, budgetMs)
}
