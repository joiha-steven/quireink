// Snapshots on disk. Real archives are built here rather than mocked: the whole feature is
// a `tar` call and a directory listing, and a test that stubbed either would be testing
// nothing that can break.
import { describe, expect, it, beforeEach, afterAll } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { freshDatabase, dropDatabase } from '@/test/db'
import { saveSettings } from '@/content/settings'
import { savePost } from '@/content/posts'
import {
  isSnapshotName, lastRunAt, listSnapshots, maybeRunBackup, runBackup, snapshotName,
  deleteSnapshot,
} from '@/server/backup'

const DIR = './.tmp-test-backup'
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
    await saveSettings({ backups: { enabled: true, intervalDays: 1, keep: 2 } })
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
    await saveSettings({ backups: { enabled: false, intervalDays: 1, keep: 4 } })
    expect(await maybeRunBackup()).toEqual({ ran: false })
    expect(await listSnapshots()).toHaveLength(0)
  })

  it('runs when there is nothing yet, then not again until the interval has passed', async () => {
    await saveSettings({ backups: { enabled: true, intervalDays: 7, keep: 4 } })
    expect((await maybeRunBackup()).ran).toBe(true)
    expect((await maybeRunBackup()).ran).toBe(false)
  })

  // Due-ness comes from the newest file rather than a recorded run time, so a machine
  // restored from a copy does not believe it already has today's.
  it('is due again once the newest snapshot is older than the interval', async () => {
    await saveSettings({ backups: { enabled: true, intervalDays: 1, keep: 4 } })
    mkdirSync(SNAPSHOTS, { recursive: true })
    const old = join(SNAPSHOTS, 'quire-2020-01-01T0000.tar.gz')
    await writeFile(old, 'x')
    const longAgo = new Date(Date.now() - 5 * 86_400_000)
    await Bun.spawn(['touch', '-d', longAgo.toISOString(), old]).exited
    expect((await maybeRunBackup()).ran).toBe(true)
  })
})
