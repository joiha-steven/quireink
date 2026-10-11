// Themes installed from a zip (ADR 0072, T2): the `themes` table and the files beside it in the
// blob store. The checking is `theme/read-package.ts`; this stores what passed it, lists it, takes
// it back a version or removes it. Drawing a page with one is `content/chosen-theme.ts`.
//
// WHAT A READER SEES CHANGES ON THE NEXT RENDER. Each of install, rollback and removal is a write
// through the owner's gate, which empties the page cache and purges the edge as a settings save
// does (Invariant 1); each also drops the current version the renderer keeps
// (`forgetInstalledTheme`), so a caller that reaches it without the gate sees the change too.
//
// WHERE THE BYTES GO. Every file under `themes/<hash>/<path>` in the blob store the uploads use
// (a directory on Bun, the R2 bucket on Cloudflare), keyed by the package's hash, so a key is
// written once and means one thing forever: it is safe to serve for a year, and a version that is
// replaced or removed leaves nothing a cached page still links to broken. The same store is what
// the backup carries file for file (`server/archive.ts`), so the rows and the files travel together.
//
// THE ORDER OF AN INSTALL: check everything, write the files, then write the row in one
// transaction. A failure before the row leaves at most files no row names (an install retried
// writes the same bytes to the same keys); never a row naming a file that is not there.
// Nothing deletes theme files: a removed or rolled-back version is a soft-deleted row whose
// files stay, for the pages still holding its URL.

import { readThemePackage, type PackageOptions, type Violation } from '@/theme'
import { themeContract } from '@/content/theme-contract'
import { DEFAULT_THEME_ID, OWNABLE_SETTINGS } from '@/content/themes-builtin'
import { RESERVED_FONT_IDS, RESERVED_PALETTE_IDS, RESERVED_THEME_IDS } from '@/content/theme-reserved'
import { getSettings, saveSettings } from '@/content/settings'
import { uploadFile } from '@/media/blob'
import { themeBlobPath } from '@/media/theme-blobs'
import { all, one, run, tx } from '@/store/query'
import { liveOnly, nowMs } from '@/store/db'
import { forgetInstalledTheme } from '@/content/chosen-theme'

/** The theme API versions this build reads (ADR 0072, decision 2). */
export const SUPPORTED_THEME_API: readonly number[] = [1]

/** One file as the row lists it. */
export type InstalledFile = { path: string; size: number; type: string }

export { themeBlobPath }

/** The SHA-256 hex a package is keyed by: nothing else may name a theme directory. */
export const isThemeHash = (value: string): boolean => /^[0-9a-f]{64}$/.test(value)

/**
 * What the checker is told about this blog. The ids a stranger's theme may not take are the
 * built-in ones: its id would shadow a built-in theme, its palettes and fonts join menus that
 * already hold these.
 */
function packageOptions(): PackageOptions {
  return {
    supportedApi: SUPPORTED_THEME_API,
    reservedIds: RESERVED_THEME_IDS,
    reservedPaletteIds: RESERVED_PALETTE_IDS,
    reservedFontIds: RESERVED_FONT_IDS,
    ownableSettings: new Set(OWNABLE_SETTINGS),
    contract: themeContract(),
  }
}

export type InstallResult =
  | { ok: true; id: string; version: string; hash: string; changed: boolean }
  | { ok: false; violations: Violation[] }

type LiveRow = { id: number; hash: string }

const liveVersion = (themeId: string, version: string): LiveRow | null =>
  one<LiveRow>(
    `select id, hash from themes where ${liveOnly('themes')} and theme_id = ? and version = ?`,
    themeId, version,
  )

/** The install in progress, so the next one waits for it (`installTheme`). */
let installing: Promise<unknown> = Promise.resolve()

/**
 * Check `zip` and, when nothing is wrong with it, store it. Refused: nothing is written, and the
 * reasons come back. The same id and version again: the same files do nothing, different files
 * replace that version (the old row soft-deleted, its files kept).
 *
 * ONE AT A TIME in this process. Two requests carrying the same package wrote the same keys at
 * once, and on Windows the second rename onto a file the first had just put there fails with
 * EPERM (measured 2026-10-11, a 500 for an install that was valid). Queued, the second finds the
 * first's row and does nothing. On Cloudflare one Durable Object is the one process.
 */
export function installTheme(zip: Uint8Array): Promise<InstallResult> {
  const next = installing.then(() => installNow(zip))
  installing = next.catch(() => undefined)
  return next
}

/**
 * Whether the store already holds `size` bytes at `pathname`. The key is the package's hash, so
 * a file of the right size there is this file (written by an install whose row was later removed,
 * or by one that failed after its files), and writing it again would only replace it under a
 * reader who may be streaming it.
 */
async function alreadyStored(pathname: string, size: number): Promise<boolean> {
  try {
    return (await (await import('@/runtime/impl/blob')).statSize(pathname)) === size
  } catch {
    return false
  }
}

async function installNow(zip: Uint8Array): Promise<InstallResult> {
  const result = await readThemePackage(zip, packageOptions())
  if (!result.ok) return result
  const { manifest, hash, files } = result.pkg
  const done = (changed: boolean): InstallResult => ({ ok: true, id: manifest.id, version: manifest.version, hash, changed })

  if (liveVersion(manifest.id, manifest.version)?.hash === hash) return done(false)

  for (const f of files) {
    const pathname = themeBlobPath(hash, f.path)
    if (!(await alreadyStored(pathname, f.size))) await uploadFile(pathname, Buffer.from(f.bytes), f.type)
  }

  const listed: InstalledFile[] = files.map(({ path, size, type }) => ({ path, size, type }))
  // Asked again inside the transaction, so the row written is decided against the table as it is
  // at the write, not as it was before the files went out. The queue above makes a change in
  // between unlikely; the transaction makes it harmless.
  const changed = tx(() => {
    const now = nowMs()
    const live = liveVersion(manifest.id, manifest.version)
    if (live?.hash === hash) return false
    if (live) run(`update themes set deleted_at = ? where id = ?`, now, live.id)
    run(
      `insert into themes (theme_id, version, hash, manifest, files, installed_at) values (?, ?, ?, ?, ?, ?)`,
      manifest.id, manifest.version, hash, JSON.stringify(manifest), JSON.stringify(listed), now,
    )
    return true
  })
  if (changed) forgetInstalledTheme()
  return done(changed)
}

type Row = { id: number; theme_id: string; version: string; hash: string; manifest: string; installed_at: number }

/** One version, as the list shows it. */
export type InstalledVersion = { version: string; hash: string; installedAt: number }

/** One installed theme: its current version with what its manifest says, and the versions before it. */
export type InstalledTheme = {
  id: string
  current: InstalledVersion & {
    name: string
    author: string
    description: string | null
    license: string
    homepage: string | null
    api: number
    /** The package's preview, served from its own directory. */
    screenshot: string
  }
  /** Newest first: what a rollback goes back to, in order. */
  previous: InstalledVersion[]
  /** Whether the blog has this theme chosen. */
  active: boolean
  /** Nothing has looked at a zip's theme but the checker (ADR 0072). */
  reviewed: false
  /**
   * False when the current version's manifest does not read (a backup puts rows back unchecked).
   * Then `current` holds only the row's own columns: the name is the id, the other manifest fields
   * are empty and `screenshot` is `''`. Such a theme can be removed, never chosen.
   */
  readable: boolean
}

const NEWEST_FIRST = 'installed_at desc, id desc'

const liveRowsOf = (themeId: string): Row[] =>
  all<Row>(
    `select id, theme_id, version, hash, manifest, installed_at from themes
     where ${liveOnly('themes')} and theme_id = ? order by ${NEWEST_FIRST}`,
    themeId,
  )

const versionOf = (r: Row): InstalledVersion => ({ version: r.version, hash: r.hash, installedAt: r.installed_at })

type Details = Pick<InstalledTheme['current'], 'name' | 'author' | 'description' | 'license' | 'homepage' | 'api'>
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const optional = (v: unknown): string | null | false => (v === undefined || v === null ? null : typeof v === 'string' ? v : false)

/**
 * What the list shows of a manifest, or null when it does not read. A row is read as if it could
 * be anything (a backup puts rows back unchecked): one row that threw here took the whole
 * Settings screen down with a 500, and with it the Remove key that would have cleaned it up.
 */
function details(json: string): Details | null {
  let m: unknown
  try { m = JSON.parse(json) } catch { return null }
  if (!isObj(m)) return null
  const { name, author, license, api } = m
  const description = optional(m.description)
  const homepage = optional(m.homepage)
  if (typeof name !== 'string' || name === '' || typeof author !== 'string' || typeof license !== 'string'
    || typeof api !== 'number' || description === false || homepage === false) return null
  return { name, author, description, license, homepage, api }
}

/** Every installed theme, by id, each with its current version first. */
export async function listInstalledThemes(): Promise<InstalledTheme[]> {
  const chosen = (await getSettings()).theme
  const rows = all<Row>(
    `select id, theme_id, version, hash, manifest, installed_at from themes
     where ${liveOnly('themes')} order by theme_id, ${NEWEST_FIRST}`,
  )
  const byId = new Map<string, Row[]>()
  for (const r of rows) byId.set(r.theme_id, [...(byId.get(r.theme_id) ?? []), r])
  return [...byId].map(([id, [head, ...rest]]) => {
    const read = details(head!.manifest)
    if (!read) console.warn(`[WARN] theme ${id}: the current version's manifest does not read; listed as unreadable`)
    const shown = read ?? { name: id, author: '', description: null, license: '', homepage: null, api: 0 }
    return {
      id,
      current: {
        ...versionOf(head!), ...shown,
        screenshot: read && isThemeHash(head!.hash) ? `/themes/${head!.hash}/screenshot.webp` : '',
      },
      previous: rest.map(versionOf),
      active: chosen === id,
      reviewed: false,
      readable: read !== null,
    }
  })
}

/** The manifest name of the current version of `themeId`, or null when none is live or it does not read. */
export function installedThemeName(themeId: string): string | null {
  const [head] = liveRowsOf(themeId)
  return head ? details(head.manifest)?.name ?? null : null
}

/**
 * Remove a theme: every live version soft-deleted. A blog wearing it goes back to plain, so no
 * page is left naming a theme that is gone. The number of versions removed; 0 when none was live.
 */
export async function removeTheme(themeId: string): Promise<number> {
  const { changes } = run(`update themes set deleted_at = ? where ${liveOnly('themes')} and theme_id = ?`, nowMs(), themeId)
  if (changes > 0) forgetInstalledTheme()
  if (changes > 0 && (await getSettings()).theme === themeId) await saveSettings({ theme: DEFAULT_THEME_ID })
  return changes
}

export type RollbackResult =
  | { ok: true; id: string; current: InstalledVersion; removed: InstalledVersion }
  | { ok: false; error: 'not_found' | 'no_previous' }

/** The current version soft-deleted, so the one installed before it is current again. */
export function rollbackTheme(themeId: string): RollbackResult {
  return tx((): RollbackResult => {
    const [head, next] = liveRowsOf(themeId)
    if (!head) return { ok: false, error: 'not_found' }
    if (!next) return { ok: false, error: 'no_previous' }
    run(`update themes set deleted_at = ? where id = ?`, nowMs(), head.id)
    forgetInstalledTheme()
    return { ok: true, id: themeId, current: versionOf(next), removed: versionOf(head) }
  })
}

/**
 * A file of an installed package, by hash and path, or null. Read from EVERY row, the deleted
 * ones included, and on purpose: a version that was rolled back or removed is still linked from
 * pages a browser or a CDN holds, and its key cannot mean anything else. Only a path the package
 * listed is found, so nothing the store holds beside the package can be reached through here.
 */
export function installedThemeFile(hash: string, path: string): InstalledFile | null {
  if (!isThemeHash(hash)) return null
  const row = one<{ files: string }>(`select files from themes where hash = ? order by id desc limit 1`, hash)
  if (!row) return null
  const files = JSON.parse(row.files) as InstalledFile[]
  return files.find((f) => f.path === path) ?? null
}
