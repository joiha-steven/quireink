// Loading a backup into an EMPTY blog, from the first setup screen (ADR 0067 rule 4).
//
// This is how a blog moves: between machines, or between Bun and Cloudflare — a fresh install,
// and the backup loaded into it. It is not a restore button. A restore over a blog that has
// content stays a shell act on a stopped service (`scripts/restore.ts`), because the application
// replacing a database it already holds is the risk parity exception 1 removed; here there is
// nothing to replace, and the code refuses outright when there is.
//
// THE SAME VERSION, OR NOTHING. The rows go into the live schema as it stands, so the archive must
// have been written by this exact release with the same migrations applied; anything else is
// refused with the version to upgrade the old blog to. Migrating rows on the way in would be a
// second migration system beside `migrations.sql`, run once per blog, on its owner's worst day.
import { logAuthEvent } from '@/server/activity'
import { classify, openArchive, ArchiveFault, type ArchiveKeys } from '@/server/archive-open'
import { readRows, type RowsReport } from '@/server/archive-rows'
import type { TarItem } from '@/server/tar'
import { noUsersYet } from '@/auth/users'
import { resetSecretCache } from '@/auth/secret'
import { resetSettingsCache } from '@/content/settings'
import { clearCache } from '@/server/cache'
import { resetAnalyticsCaches } from '@/analytics/memo'
import { forgetStorageStats } from '@/media/storage-stats'
import { deleteByPathname, uploadFile, readBlob } from '@/media/blob'
import { beginLiveLoad, firstNonEmptyTable, liveColumns, liveLedgers } from '@/store/archive-load'
import type { Kind } from '@/store/db'
import { APP_VERSION } from '@/version'
import { readEnv } from '@/env'

/** Why a load was refused, named so the setup screen can say it in the reader's language. */
export class LoadRefusal extends Error {
  constructor(readonly code: 'claimed' | 'not-empty' | 'busy' | 'old-format' | 'version', readonly detail = '') {
    super(code)
  }
}

/**
 * Who has the empty blog right now: a load, or a claim between its last check and its account
 * existing. One at a time, and both ways round — two owners racing for one empty blog is not a
 * race either may win. A claim that checked `noUsersYet` and then awaited its settings write and
 * its password hash used to leave a window in which a load began, so the load's `insert or replace`
 * met the claim's new account; and two claims in the same window made two owners.
 */
let holder: 'load' | 'claim' | null = null
export const backupLoading = (): boolean => holder === 'load'

/**
 * Run a claim's writes with the blog held, or answer null when a load or another claim has it.
 * `fn` re-checks that nobody owns the blog, inside the hold, before it writes anything.
 */
export async function holdingForClaim<T>(fn: () => Promise<T>): Promise<T | null> {
  if (holder !== null) return null
  holder = 'claim'
  try {
    return await fn()
  } finally {
    holder = null
  }
}

const sameList = (a: string[], b: string[]): boolean =>
  a.length === b.length && [...a].sort().every((x, i) => x === [...b].sort()[i])

/**
 * Every byte of one upload, which the blob store takes whole. Gathered as it arrives rather than
 * allocated from the size the tar header states: that number is the archive's word, and a header
 * claiming 8 GiB in front of three bytes would otherwise cost 8 GiB before anything noticed.
 *
 * ⚠️ AND NOT ONE BYTE OF AN UPLOAD THE STORE WOULD REFUSE. The header's size is still the most the
 * tar reader hands over, and it may be 8 GiB of zeros that gzip squeezed to almost nothing: a
 * 534 KB archive declaring 512 MiB drove the process 1 GiB over its baseline, and only THEN did
 * `put` say the file was over the ceiling (2026-11-03). The same ceiling, asked before the read.
 */
async function bytesOf(body: AsyncIterable<Uint8Array>, size: number, pathname: string): Promise<Buffer> {
  const ceiling = readEnv().maxUploadBytes
  if (ceiling > 0 && size > ceiling) throw new ArchiveFault(`too-large: ${pathname} is ${size} bytes, over MAX_UPLOAD_MB (${ceiling})`)
  const pieces: Uint8Array[] = []
  let at = 0
  for await (const piece of body) {
    pieces.push(piece)
    at += piece.length
  }
  if (at !== size) throw new ArchiveFault(`truncated: an upload ended at ${at} of ${size} bytes`)
  return Buffer.concat(pieces, at)
}

/**
 * Load `source` into this blog, which must have no owner and no content. On success the blog is
 * claimed by the account in the archive; on any failure every table this touched is emptied
 * again and every upload it wrote removed, and the error is thrown.
 */
export async function loadBackupIntoEmptyBlog(source: AsyncIterable<Uint8Array>, keys: ArchiveKeys): Promise<Loaded> {
  if (holder !== null) throw new LoadRefusal('busy')
  holder = 'load'
  try {
    if (!noUsersYet()) throw new LoadRefusal('claimed')
    const occupied = firstNonEmptyTable()
    if (occupied) throw new LoadRefusal('not-empty', occupied)

    const { items } = await openArchive(source, keys)
    try {
      return await loadOpened(items)
    } finally {
      // Refused or failed part-way, the rest of the upload is not wanted: stop reading it.
      await items.return(undefined).catch(() => undefined)
    }
  } finally {
    holder = null
  }
}

/**
 * What a load brought: the report, the version that wrote it, and how many MCP tokens came back,
 * which the owner is told on the screen and in the log. A token in a backup still works, so a
 * backup somebody else made can carry a connection nobody here ever approved.
 */
export type Loaded = RowsReport & { version: string; mcpTokens: number }

async function loadOpened(items: AsyncGenerator<TarItem>): Promise<Loaded> {
  const kind = await classify(items)
  if (kind.format !== 'rows') throw new LoadRefusal('old-format')
  const { manifest } = kind
  const ledgers = liveLedgers()
  if (manifest.version !== APP_VERSION
    || !sameList(manifest.databases.content.ledger, ledgers.content)
    || !sameList(manifest.databases.analytics.ledger, ledgers.analytics)) {
    throw new LoadRefusal('version', manifest.version)
  }
  for (const k of ['content', 'analytics'] as Kind[]) {
    for (const t of manifest.databases[k].tables) {
      const columns = liveColumns(k, t.name)
      if (!columns || !sameList(columns, t.columns)) throw new LoadRefusal('version', manifest.version)
    }
  }

  const load = beginLiveLoad()
  const written: string[] = []
  try {
    const report = await readRows(items, manifest, {
      // The live schema is this release's, and the manifest has just been held to it.
      schema: () => {},
      table: (k, entry, lines) => load.table(k, entry.name, entry.columns, lines),
      upload: async (pathname, size, body) => {
        const bytes = await bytesOf(body, size, pathname)
        try {
          await uploadFile(pathname, bytes, '', { exclusive: true })
          written.push(pathname)
        } catch (error) {
          // Already there with the same bytes is fine (a picture the install shipped with);
          // already there and different is somebody's file, and this never overwrites one.
          if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
          if (!(await readBlob(pathname)).equals(bytes)) throw new ArchiveFault(`exists: ${pathname}`)
        }
      },
    })
    load.finish()
    if (noUsersYet()) throw new ArchiveFault('no-owner')
    const mcpTokens = report.tables.find((t) => t.kind === 'content' && t.name === 'mcp_tokens')?.rows ?? 0
    return { ...report, version: manifest.version, mcpTokens }
  } catch (error) {
    load.abort()
    for (const pathname of written) await deleteByPathname(pathname).catch(() => undefined)
    throw error
  } finally {
    // Whatever happened, nothing remembered from the empty blog may outlive it: the settings,
    // the salts, the cached pages and counts were all read from tables that just changed.
    resetSettingsCache()
    resetSecretCache()
    clearCache()
    resetAnalyticsCaches()
    forgetStorageStats()
  }
}

/** Said in the activity log, which is the archive's own now. */
export function logLoaded(loaded: Loaded): void {
  logAuthEvent('auth.owner.claimed', `from a backup written by ${loaded.version}: ${loaded.mcpTokens} MCP token(s) loaded with it, no sign-in carried over`)
}
