// An installed theme travels with the backup (ADR 0067, ADR 0072): its rows are a table like any
// other, and its files sit in the blob store the archive carries file for file. Proven the way a
// blog moves between machines or runtimes: archived on one blog, loaded into an empty one through
// `loadBackupIntoEmptyBlog` (the code both runtimes run for Start from a backup), and compared
// row for row and byte for byte, then served.
import { afterAll, describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/test/sqlite'
import { createUser } from '@/auth/users'
import { archiveStream } from '@/server/archive'
import { loadBackupIntoEmptyBlog } from '@/server/load-backup'
import { installTheme, rollbackTheme } from '@/content/installed-themes'
import { createApp } from '@/web/app'
import { MANIFEST, themeZip } from '@/theme/test-zip'

const ROOT = join(process.cwd(), '.tmp/test-theme-backup')
rmSync(ROOT, { recursive: true, force: true })
afterAll(() => {
  delete process.env.STORAGE_LOCAL_DIR
  dropDatabase(join(ROOT, 'target'))
  try { rmSync(ROOT, { recursive: true, force: true }) } catch { /* Windows may hold a file a beat longer */ }
})

/** Every file under `themes/` in a store, path to bytes. */
function themeFiles(store: string): Map<string, Buffer> {
  const root = join(store, 'themes')
  const out = new Map<string, Buffer>()
  for (const e of readdirSync(root, { recursive: true, withFileTypes: true }) as { isFile(): boolean; parentPath: string; name: string }[]) {
    if (!e.isFile()) continue
    const abs = join(e.parentPath, e.name)
    out.set(abs.slice(store.length + 1).replaceAll('\\', '/'), readFileSync(abs))
  }
  return out
}
const themeRows = () => db().query('select * from themes order by id').all()

describe('a backup', () => {
  it('carries every installed version, removed ones included, and they come back byte-identical', async () => {
    // The source blog: an owner, a theme in two versions with the newer rolled back.
    const sourceStore = join(ROOT, 'source-uploads')
    freshDatabase(join(ROOT, 'source'))
    process.env.STORAGE_LOCAL_DIR = sourceStore
    await createUser({ username: 'owner', email: 'owner@example.com', password: 'wandering violet cassette' })
    const v1 = await installTheme(themeZip())
    const v2 = await installTheme(themeZip({ 'theme.json': { ...MANIFEST, version: '2.0.0' } }))
    if (!v1.ok || !v2.ok) throw new Error('the fixture theme was refused')
    expect(rollbackTheme('broadsheet').ok).toBe(true)
    const rowsBefore = themeRows()
    const filesBefore = themeFiles(sourceStore)
    expect(rowsBefore).toHaveLength(2)
    expect(filesBefore.size).toBe(10)
    const archive = new Uint8Array(await new Response(await archiveStream()).arrayBuffer())
    dropDatabase(join(ROOT, 'source'))

    // An empty blog, as a fresh install leaves one, on another store.
    const targetStore = join(ROOT, 'target-uploads')
    freshDatabase(join(ROOT, 'target'))
    process.env.STORAGE_LOCAL_DIR = targetStore
    await loadBackupIntoEmptyBlog((async function* () { yield archive })(), {})

    expect(themeRows()).toEqual(rowsBefore)
    const filesAfter = themeFiles(targetStore)
    expect([...filesAfter.keys()].sort()).toEqual([...filesBefore.keys()].sort())
    for (const [path, bytes] of filesBefore) expect([path, filesAfter.get(path)?.equals(bytes)]).toEqual([path, true])

    // And the restored blog serves them: the current version and the rolled-back one.
    const app = createApp()
    for (const hash of [v1.hash, v2.hash]) {
      const res = await app.request(`/themes/${hash}/theme.css`)
      expect(res.status).toBe(200)
      expect(await res.text()).toStartWith('@layer theme{')
    }
  }, 30_000)
})
