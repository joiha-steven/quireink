// Snapshots on disk. Real archives are built here rather than mocked: the whole feature is
// a `tar` call and a directory listing, and a test that stubbed either would be testing
// nothing that can break.
import { describe, expect, it, beforeEach, afterAll } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { freshDatabase, dropDatabase } from '@/test/db'
import { getSettings, saveSettings } from '@/content/settings'
import { DEFAULT_BACKUPS } from '@/content/settings-defaults'
import { savePost } from '@/content/posts'
import {
  buildArchive, isSnapshotName, lastRunAt, listSnapshots, maybeRunBackup, runBackup,
  snapshotName, deleteSnapshot,
} from '@/server/backup'
import { db } from '@/store/db'
import { Database } from 'bun:sqlite'

const DIR = './.tmp/test-backup'
const SNAPSHOTS = `${DIR}/snapshots`
const UPLOADS = `${DIR}/uploads`

freshDatabase(`${DIR}/data`)
process.env.BACKUP_DIR = SNAPSHOTS
process.env.STORAGE_LOCAL_DIR = UPLOADS

afterAll(() => {
  delete process.env.BACKUP_DIR
  delete process.env.STORAGE_LOCAL_DIR
  dropDatabase(`${DIR}/data`)
  try { rmSync(DIR, { recursive: true, force: true }) } catch { /* ignore */ }
})

beforeEach(() => {
  rmSync(SNAPSHOTS, { recursive: true, force: true })
  mkdirSync(UPLOADS, { recursive: true })
  writeFileSync(join(UPLOADS, 'photo.jpg'), 'not really a jpeg')
})

describe('snapshotName / isSnapshotName', () => {
  it('is sortable, and carries the minute so two in one day are two files', () => {
    const name = snapshotName(new Date('2026-07-29T20:40:11.000Z'))
    expect(name).toBe('quire-2026-07-29T2040.tar.gz')
    expect(snapshotName(new Date('2026-07-29T20:41:00.000Z'))).not.toBe(name)
    expect(name < snapshotName(new Date('2026-07-30T01:00:00.000Z'))).toBe(true)
  })

  // The name reaches the download and delete routes from a query string. Every one of
  // these reads or removes a file outside the snapshots directory if it gets through.
  it('refuses anything that is not a name this module produced', () => {
    expect(isSnapshotName('quire-2026-07-29T2040.tar.gz')).toBe(true)
    for (const bad of [
      '../../package.json', 'quire-2026-07-29T2040.tar.gz/../../x', '..%2fpackage.json',
      '/etc/passwd', 'quire-2026-07-29.tar.gz', 'quire-.tar.gz', '', 'anything.tar.gz',
    ]) {
      expect(isSnapshotName(bad)).toBe(false)
    }
  })
})

describe('runBackup', () => {
  it('writes a real archive holding both databases and the uploads tree', async () => {
    await savePost({ title: 'In the backup', slug: 'in-the-backup', status: 'published',
      date: '2020-01-01T00:00:00.000Z' })

    const snapshot = await runBackup()
    expect(isSnapshotName(snapshot.name)).toBe(true)
    expect(snapshot.size).toBeGreaterThan(0)

    // Read the archive back rather than trusting the exit code. A tar that produced an
    // empty file would pass every other assertion here.
    const proc = Bun.spawn(['tar', '-tzf', join(SNAPSHOTS, snapshot.name)], { stdout: 'pipe' })
    const listing = await new Response(proc.stdout).text()
    expect(await proc.exited).toBe(0)
    expect(listing).toContain('quire.db')
    expect(listing).toContain('analytics.db')
    expect(listing).toContain('uploads/photo.jpg')
  })

  it('prunes to the retention count, newest kept', async () => {
    await saveSettings({ backups: { ...DEFAULT_BACKUPS, enabled: true, intervalDays: 1, keep: 2 } })
    await runBackup()

    // Same-minute names would collide, so the older ones are placed by hand. They are only
    // there to be counted and deleted.
    await writeFile(join(SNAPSHOTS, 'quire-2020-01-01T0000.tar.gz'), 'old')
    await writeFile(join(SNAPSHOTS, 'quire-2021-01-01T0000.tar.gz'), 'older-still')
    expect(await listSnapshots()).toHaveLength(3)

    await runBackup()
    const left = (await listSnapshots()).map((s) => s.name)
    expect(left).toHaveLength(2)
    expect(left.some((n) => n.startsWith('quire-20'))).toBe(true)
    expect(left).not.toContain('quire-2020-01-01T0000.tar.gz')
  })

  it('leaves nothing behind when the build fails', async () => {
    // An absent uploads path is fine (it is skipped), so the failure is forced with a
    // destination that cannot exist: a directory whose parent is a file.
    mkdirSync(SNAPSHOTS, { recursive: true })
    writeFileSync(join(SNAPSHOTS, 'a-file-not-a-directory'), 'x')
    process.env.BACKUP_DIR = join(SNAPSHOTS, 'a-file-not-a-directory', 'deeper')
    try {
      await expect(runBackup()).rejects.toThrow()
    } finally {
      // In a finally, because leaking this variable makes every test after it fail for a
      // reason that has nothing to do with what it is testing.
      process.env.BACKUP_DIR = SNAPSHOTS
    }
    // A half-written archive counts towards retention and looks like a backup.
    expect((await readdir(SNAPSHOTS)).filter(isSnapshotName)).toHaveLength(0)
  })
})

describe('listSnapshots / lastRunAt', () => {
  it('is empty, not an error, before the directory exists', async () => {
    expect(await listSnapshots()).toEqual([])
    expect(await lastRunAt()).toBeNull()
  })

  it('ignores files it did not write, and sorts newest first', async () => {
    mkdirSync(SNAPSHOTS, { recursive: true })
    for (const name of ['quire-2020-01-01T0000.tar.gz', 'quire-2026-01-01T0000.tar.gz',
      'notes.txt', 'quire-backup.sh']) {
      await writeFile(join(SNAPSHOTS, name), 'x')
    }
    expect((await listSnapshots()).map((s) => s.name))
      .toEqual(['quire-2026-01-01T0000.tar.gz', 'quire-2020-01-01T0000.tar.gz'])
  })
})

describe('deleteSnapshot', () => {
  it('refuses a name it did not write, and removes one it did', async () => {
    mkdirSync(SNAPSHOTS, { recursive: true })
    await writeFile(join(SNAPSHOTS, 'quire-2020-01-01T0000.tar.gz'), 'x')
    expect(await deleteSnapshot('../../package.json')).toBe(false)
    expect(await deleteSnapshot('quire-2020-01-01T0000.tar.gz')).toBe(true)
    expect(await listSnapshots()).toHaveLength(0)
  })
})

describe('maybeRunBackup', () => {
  it('does nothing while automatic backups are off', async () => {
    await saveSettings({ backups: { ...DEFAULT_BACKUPS, enabled: false, intervalDays: 1, keep: 4 } })
    expect(await maybeRunBackup()).toEqual({ ran: false })
    expect(await listSnapshots()).toHaveLength(0)
  })

  it('runs when there is nothing yet, then not again until the interval has passed', async () => {
    await saveSettings({ backups: { ...DEFAULT_BACKUPS, enabled: true, intervalDays: 7, keep: 4 } })
    expect((await maybeRunBackup()).ran).toBe(true)
    expect((await maybeRunBackup()).ran).toBe(false)
  })

  it('writes a failure to the activity log, where the owner looks, not only to the console', async () => {
    const { getActivity } = await import('@/server/activity')
    const was = process.env.BACKUP_DIR
    // A path under a FILE: no directory can be made there, so the run fails the way a full or
    // read-only disk does.
    process.env.BACKUP_DIR = join(import.meta.dir, 'backup.test.ts', 'nope')
    try {
      await saveSettings({
        backups: { ...DEFAULT_BACKUPS, enabled: true, intervalDays: 1, keep: 4 },
        features: { ...(await getSettings()).features, activityLog: true },
      })
      const run = await maybeRunBackup()
      expect(run.ran).toBe(false)
      expect(run.error).toBeTruthy()
      const logged = (await getActivity(20)).find((e) => e.action === 'error' && e.detail.startsWith('scheduled backup'))
      expect(logged).toBeDefined()
    } finally {
      if (was === undefined) delete process.env.BACKUP_DIR
      else process.env.BACKUP_DIR = was
    }
  })

  // Due-ness comes from the newest file rather than a recorded run time, so a machine
  // restored from a copy does not believe it already has today's.
  it('is due again once the newest snapshot is older than the interval', async () => {
    await saveSettings({ backups: { ...DEFAULT_BACKUPS, enabled: true, intervalDays: 1, keep: 4 } })
    mkdirSync(SNAPSHOTS, { recursive: true })
    const old = join(SNAPSHOTS, 'quire-2020-01-01T0000.tar.gz')
    await writeFile(old, 'x')
    const longAgo = new Date(Date.now() - 5 * 86_400_000)
    await Bun.spawn(['touch', '-d', longAgo.toISOString(), old]).exited
    expect((await maybeRunBackup()).ran).toBe(true)
  })
})

describe('the rendered-HTML cache', () => {
  it('is left out of the archive, and everything else survives', async () => {
    // A post, so the archive has content to keep, and cache rows to throw away. The real
    // proportion is worse than anything worth writing here: measured on manhhung.me on
    // 2026-09-13, `render_cache` was 530 MB of a 538 MB database — 98.5% of every backup was
    // a derived artifact, and the owner's archive had grown past what the download could
    // carry. The cache is a pure function of the Markdown beside it; restoring without it
    // costs the first reader of each post one render.
    await savePost({ slug: 'cached', title: 'Cached', content: 'Body.', status: 'published' })
    db().exec("insert into render_cache (key, html, created_at) values ('k1', '<p>x</p>', 1)")
    const before = db().query('select count(*) c from render_cache').get() as { c: number }
    expect(before.c).toBeGreaterThan(0)

    const out = join(DIR, 'cache-check.tar.gz')
    await buildArchive(out)

    const unpacked = join(DIR, 'cache-check')
    mkdirSync(unpacked, { recursive: true })
    await Bun.$`tar -xzf ${out} -C ${unpacked}`.quiet()

    const restored = new Database(join(unpacked, 'quire.db'), { readonly: true })
    try {
      // The cache is empty…
      const cached = restored.query('select count(*) c from render_cache').get() as { c: number }
      expect(cached.c).toBe(0)
      // …and the writing is not. This half is the one that matters: a backup that dropped a
      // table it should have kept would pass a test that only checked the cache was gone.
      const posts = restored.query('select count(*) c from posts').get() as { c: number }
      expect(posts.c).toBeGreaterThan(0)
      expect(Object.values(restored.query('pragma integrity_check').get() as object)[0]).toBe('ok')
    } finally {
      restored.close()
    }
    // And the live database keeps its cache: the copy is what was emptied, never this one.
    const after = db().query('select count(*) c from render_cache').get() as { c: number }
    expect(after.c).toBe(before.c)
  })
})
