// The backup archive, written (ADR 0067). One builder for every archive this software makes: the
// download, the schedule, and through the schedule the off-site copy, so the file the owner takes
// by hand and the one the clock writes cannot drift apart.
//
// FORMAT `quire-rows/1`: a gzipped tar, sealed exactly as ADR 0060 says when the owner asked, and
// inside it, in this order —
//
//   manifest.json            format, version, when; per database the migration ledger and every
//                            table's columns, row count and the SHA-256 of its JSON Lines
//   content/schema.sql       the SQL that recreates quire.db's shape
//   content/<table>.jsonl    one JSON array per row, in the manifest's column order;
//                            a blob as {"$b64": "…"}
//   analytics/…              the same for analytics.db
//   uploads/…                the blob store, byte for byte
//
// The manifest comes first so a reader knows every table before it reads a row, and can refuse
// an archive it cannot load before it has touched anything. The render caches are not carried
// (`store/rows.ts`), and neither are the full-text indexes: their triggers rebuild them as the
// rows go back in.
//
// It STREAMS, end to end: rows a page at a time, through the tar writer, gzip, the sealer, into
// whatever the caller pipes it to. Nothing holds a table or the archive, which on a
// Durable Object with 128 MB is the difference between a backup and none.
import { getSettings } from '@/content/settings'
import { sealer } from '@/server/backup-crypt'
import { gzipStage } from '@/server/gzip'
import { streamOf, tarChunks, type TarEntry } from '@/server/tar'
import { openArchiveSource, type DatabaseSection } from '@/store/archive-db'
import type { Kind } from '@/store/db'
import type { SiteSettings } from '@/types'
import { APP_VERSION } from '@/version'

export const ARCHIVE_FORMAT = 'quire-rows/1'

export type Manifest = {
  format: typeof ARCHIVE_FORMAT
  version: string
  createdAt: string
  databases: Record<Kind, DatabaseSection>
  /** What the blob store held when the archive began. A file deleted mid-way is left out. */
  uploads: { files: number; bytes: number }
}

/**
 * Whether an archive written now would be sealed (ADR 0060).
 *
 * Three parts and not one boolean, the shape `ap/actor.ts` settled on: a switch with no
 * recipient behind it would be a green control over plaintext archives, which is worse than
 * an off switch because the owner stops worrying about it. The sanitiser refuses the flip too;
 * this is what everything downstream asks.
 */
export const encryptReady = (s: SiteSettings): boolean =>
  s.backups.encrypt && s.backups.pubKey !== '' && s.backups.passPub !== ''

/**
 * A temporary file the store is writing (`runtime/bun/blob.ts` writes `<name>.<12 hex>.part`
 * and renames it). It is about to be the real file, or nothing.
 */
const inFlight = (pathname: string): boolean => /\.[0-9a-f]{12}\.part$/.test(pathname)

async function* entries(): AsyncGenerator<TarEntry> {
  const blob = await import('@/runtime/impl/blob')
  const source = await openArchiveSource()
  try {
    const uploads = (await blob.list()).filter((f) => !inFlight(f.pathname))
    const manifest: Manifest = {
      format: ARCHIVE_FORMAT,
      version: APP_VERSION,
      createdAt: new Date().toISOString(),
      databases: source.sections,
      uploads: { files: uploads.length, bytes: uploads.reduce((n, f) => n + f.size, 0) },
    }
    const head = new TextEncoder().encode(`${JSON.stringify(manifest, null, 1)}\n`)
    yield { name: 'manifest.json', size: head.length, body: head }
    yield* source.parts()
    // The rows are written: let go of the databases before the uploads, which can take minutes.
    source.dispose()
    for (const file of uploads) {
      // The size is asked again right before the header, because the header is written first and
      // has to be true. A file deleted since the listing — the owner purging an image while the
      // schedule runs — is left out and said in the log; the old `tar` did the same, with a
      // warning on stderr nobody read.
      let size: number
      try {
        size = await blob.statSize(file.pathname)
      } catch {
        console.warn(`[WARN] backup: ${file.pathname} went away while the archive was written; left out`)
        continue
      }
      const stream = blob.stream(file.pathname) as ReadableStream<Uint8Array>
      yield { name: `uploads/${file.pathname}`, size, body: stream }
    }
  } finally {
    source.dispose()
  }
}

/** The ADR 0060 envelope as a stream stage: header first, frames, then the final frame. */
function sealStage(recipients: string[], salt: string): TransformStream<Uint8Array, Uint8Array> {
  const seal = sealer(recipients, salt)
  return new TransformStream<Uint8Array, Uint8Array>({
    start(controller) { controller.enqueue(seal.header()) },
    transform(chunk, controller) {
      const out = seal.push(chunk)
      if (out.length) controller.enqueue(out)
    },
    // NOT optional and not merely the tail: `end()` writes the final frame with the flag that
    // says it is final, which is what stops a truncated archive opening as a whole one.
    flush(controller) { controller.enqueue(seal.end()) },
  })
}

/**
 * One archive, as bytes to pipe somewhere: a file on Bun, a bucket on Cloudflare. Sealed here or
 * nowhere (ADR 0060): this is the one builder, so an envelope applied here reaches every caller,
 * and it is the only place with the plaintext in hand a chunk at a time.
 */
export async function archiveStream(settings?: SiteSettings): Promise<ReadableStream<Uint8Array>> {
  const s = settings ?? await getSettings()
  const gzip = gzipStage()
  const gz = streamOf(tarChunks(entries())).pipeThrough(gzip)
  return encryptReady(s) ? gz.pipeThrough(sealStage([s.backups.pubKey, s.backups.passPub], s.backups.passSalt)) : gz
}
