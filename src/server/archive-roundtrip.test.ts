// THE ROUND TRIP: a seeded blog, archived, restored by the restore script's own code into an
// empty directory, and compared table by table (ADR 0067).
//
// The writer and the reader are tested on their own elsewhere (`tar.test.ts`, `rows.test.ts`).
// This is the claim the owner relies on, made whole: what went in comes back, sealed or not, and
// an archive from before this format still restores through the same command.
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Database } from 'bun:sqlite'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db, analyticsDb } from '@/test/sqlite'
import { savePost } from '@/content/posts'
import { getSettings, saveSettings } from '@/content/settings'
import { DEFAULT_BACKUPS } from '@/content/settings-defaults'
import { archiveStream } from '@/server/archive'
import { newIdentity, passphraseRecipient } from '@/server/backup-crypt'
import { tarStream } from '@/server/tar'
import { restoreArchive } from '../../scripts/restore-lib'

const DIR = join(process.cwd(), '.tmp/test-archive-roundtrip')
const UPLOADS = `${DIR}/uploads`
const PASS = 'a passphrase somebody would actually type'

rmSync(DIR, { recursive: true, force: true })
freshDatabase(`${DIR}/data`)
process.env.STORAGE_LOCAL_DIR = UPLOADS

afterAll(() => {
  delete process.env.STORAGE_LOCAL_DIR
  dropDatabase(`${DIR}/data`)
  rmSync(DIR, { recursive: true, force: true })
})

beforeAll(async () => {
  mkdirSync(join(UPLOADS, 'media', '2026'), { recursive: true })
  writeFileSync(join(UPLOADS, 'media', '2026', 'photo.webp'), new Uint8Array(70_000).map((_, i) => (i * 31) & 0xff))
  writeFileSync(join(UPLOADS, 'icon.png'), 'png')
  for (let i = 0; i < 30; i++) {
    await savePost({
      title: `Bài viết số ${i}`, slug: `post-${i}`, content: `Nội dung "${i}"\n\nđoạn hai`,
      status: i % 3 ? 'published' : 'draft', date: '2020-01-01T00:00:00.000Z', tags: [`tag-${i % 4}`],
    })
  }
  const a = analyticsDb()
  const insert = a.prepare('insert into analytics_events (path, visitor, country, created_at) values (?, ?, ?, ?)')
  a.transaction(() => { for (let i = 0; i < 1500; i++) insert.run(`/post-${i % 30}`, `v${i % 97}`, i % 2 ? 'VN' : null, 1_700_000_000_000 + i) })()
  db().exec("insert into render_cache (key, html, created_at) values ('k', '<p>derived</p>', 1)")
})

async function archiveTo(path: string): Promise<void> {
  await Bun.write(path, await new Response(await archiveStream()).arrayBuffer())
}

/** Every row of every table but the caches and the full-text shadows, in a fixed order. */
function dump(path: string): Record<string, unknown[]> {
  const raw = new Database(path, { readonly: true })
  try {
    const tables = (raw.query(`select name, sql from sqlite_master where type = 'table'`).all() as { name: string; sql: string }[])
      .filter((t) => !/^sqlite_|_fts/.test(t.name) && !['render_cache', 'body_cache'].includes(t.name))
    return Object.fromEntries(tables.map((t) => [t.name, raw.query(`select * from "${t.name}" order by 1, 2`).all()]))
  } finally {
    raw.close()
  }
}

function live(): { content: Record<string, unknown[]>; analytics: Record<string, unknown[]> } {
  db().exec('pragma wal_checkpoint(TRUNCATE)')
  analyticsDb().exec('pragma wal_checkpoint(TRUNCATE)')
  return { content: dump(`${DIR}/data/quire.db`), analytics: dump(`${DIR}/data/analytics.db`) }
}

describe('a rows archive', () => {
  it('restores into an empty directory with every row, every upload and a working search index', async () => {
    const archive = join(DIR, 'plain.tar.gz')
    await archiveTo(archive)
    const out = join(DIR, 'r1')
    const report = await restoreArchive({ archive, dataDir: join(out, 'data'), uploadsDir: join(out, 'uploads') })
    expect(report.format).toBe('rows')
    expect(report.uploads).toBe(2)

    const want = live()
    expect(dump(join(out, 'data', 'quire.db'))).toEqual(want.content)
    expect(dump(join(out, 'data', 'analytics.db'))).toEqual(want.analytics)
    expect(want.analytics.analytics_events).toHaveLength(1500)
    expect(readFileSync(join(out, 'uploads', 'media', '2026', 'photo.webp')))
      .toEqual(readFileSync(join(UPLOADS, 'media', '2026', 'photo.webp')))

    const restored = new Database(join(out, 'data', 'quire.db'), { readonly: true })
    try {
      // Rebuilt by the triggers as the posts went in, since the index itself is not carried.
      const hits = restored.query(`select count(*) as n from posts_fts where posts_fts match 'viết'`).get() as { n: number }
      expect(hits.n).toBe(30)
      expect((restored.query('select count(*) as n from render_cache').get() as { n: number }).n).toBe(0)
    } finally {
      restored.close()
    }
  }, 20_000)

  it('restores a sealed one with either key, and refuses without one', async () => {
    const identity = newIdentity()
    const pass = passphraseRecipient(PASS)
    await saveSettings({ backups: { ...DEFAULT_BACKUPS, pubKey: identity.publicKey, passPub: pass.publicKey, passSalt: pass.salt } })
    await saveSettings({ backups: { ...(await getSettings()).backups, encrypt: true } })
    try {
      const archive = join(DIR, 'sealed.tar.gz.enc')
      await archiveTo(archive)
      await expect(restoreArchive({ archive, dataDir: join(DIR, 'r2', 'data'), uploadsDir: join(DIR, 'r2', 'u') }))
        .rejects.toThrow('needs-key')
      expect(existsSync(join(DIR, 'r2', 'data', 'quire.db'))).toBe(false)
      const byKey = await restoreArchive({ archive, dataDir: join(DIR, 'r3', 'data'), uploadsDir: join(DIR, 'r3', 'u'), keys: { identity: identity.secret } })
      expect(byKey.sealed).toBe(true)
      const byPass = await restoreArchive({ archive, dataDir: join(DIR, 'r4', 'data'), uploadsDir: join(DIR, 'r4', 'u'), keys: { passphrase: PASS } })
      expect(byPass.tables).toEqual(byKey.tables)
    } finally {
      await saveSettings({ backups: { ...(await getSettings()).backups, encrypt: false } })
    }
  }, 30_000)

  it('refuses a data directory that already holds a database, and an archive cut short', async () => {
    const archive = join(DIR, 'plain2.tar.gz')
    await archiveTo(archive)
    mkdirSync(join(DIR, 'r5', 'data'), { recursive: true })
    writeFileSync(join(DIR, 'r5', 'data', 'quire.db'), 'somebody else')
    await expect(restoreArchive({ archive, dataDir: join(DIR, 'r5', 'data'), uploadsDir: join(DIR, 'r5', 'u') }))
      .rejects.toThrow('already exists')
    expect(readFileSync(join(DIR, 'r5', 'data', 'quire.db'), 'utf8')).toBe('somebody else')

    const whole = readFileSync(archive)
    const cut = join(DIR, 'cut.tar.gz')
    writeFileSync(cut, whole.subarray(0, Math.floor(whole.length / 2)))
    await expect(restoreArchive({ archive: cut, dataDir: join(DIR, 'r6', 'data'), uploadsDir: join(DIR, 'r6', 'u') })).rejects.toThrow()
    expect(existsSync(join(DIR, 'r6', 'data', 'quire.db'))).toBe(false)
    expect(existsSync(join(DIR, 'r6', 'u', 'icon.png'))).toBe(false)
  }, 20_000)

  it('refuses a data directory where the old database left its write-ahead log behind', async () => {
    // The killed-not-stopped blog: `quire.db` moved aside, its `-wal` still there. Restored
    // beside it, SQLite would replay the OLD blog's log into the new file.
    const archive = join(DIR, 'plain-wal.tar.gz')
    await archiveTo(archive)
    mkdirSync(join(DIR, 'r9', 'data'), { recursive: true })
    writeFileSync(join(DIR, 'r9', 'data', 'quire.db-wal'), 'the old blog')
    await expect(restoreArchive({ archive, dataDir: join(DIR, 'r9', 'data'), uploadsDir: join(DIR, 'r9', 'u') }))
      .rejects.toThrow('quire.db-wal already exists')
    expect(existsSync(join(DIR, 'r9', 'data', 'quire.db'))).toBe(false)
  }, 20_000)

  it('restores onto the uploads it came from, and stops at an upload that differs', async () => {
    // The restore an owner actually does after a bad edit: the databases moved aside, the
    // pictures still in place. Every one of them is already on disk, byte for byte.
    const archive = join(DIR, 'plain-same.tar.gz')
    await archiveTo(archive)
    const out = join(DIR, 'r10')
    mkdirSync(out, { recursive: true })
    await Bun.$`cp -R ${UPLOADS} ${join(out, 'uploads')}`.quiet()
    const report = await restoreArchive({ archive, dataDir: join(out, 'data'), uploadsDir: join(out, 'uploads') })
    expect(report.uploads).toBe(2)
    expect(existsSync(join(out, 'data', 'quire.db'))).toBe(true)

    const other = join(DIR, 'r11')
    mkdirSync(join(other, 'uploads'), { recursive: true })
    writeFileSync(join(other, 'uploads', 'icon.png'), 'not the same picture')
    await expect(restoreArchive({ archive, dataDir: join(other, 'data'), uploadsDir: join(other, 'uploads') }))
      .rejects.toThrow('different contents')
    expect(readFileSync(join(other, 'uploads', 'icon.png'), 'utf8')).toBe('not the same picture')
    expect(existsSync(join(other, 'data', 'quire.db'))).toBe(false)
  }, 20_000)

  it('refuses rows that do not hash to what the manifest says', async () => {
    const enc = new TextEncoder()
    const manifest = enc.encode(JSON.stringify({
      format: 'quire-rows/1', version: '0', createdAt: 'x', uploads: { files: 0, bytes: 0 },
      databases: {
        content: { ledger: [], tables: [{ name: 't', columns: ['a'], rows: 1, sha256: '0'.repeat(64) }] },
        analytics: { ledger: [], tables: [] },
      },
    }))
    const schema = enc.encode('CREATE TABLE t (a);\n')
    const rows = enc.encode('[1]\n')
    const tar = tarStream([
      { name: 'manifest.json', size: manifest.length, body: manifest },
      { name: 'content/schema.sql', size: schema.length, body: schema },
      { name: 'content/t.jsonl', size: rows.length, body: rows },
      { name: 'analytics/schema.sql', size: 0, body: new Uint8Array(0) },
    ])
    const gz = tar.pipeThrough(new CompressionStream('gzip') as unknown as TransformStream<Uint8Array, Uint8Array>)
    const archive = join(DIR, 'forged.tar.gz')
    await Bun.write(archive, await new Response(gz).arrayBuffer())
    await expect(restoreArchive({ archive, dataDir: join(DIR, 'r7', 'data'), uploadsDir: join(DIR, 'r7', 'u') }))
      .rejects.toThrow('different bytes')
  })
})

describe('an archive from before quire-rows/1', () => {
  it('restores through the same command: the two database files, checked, and the uploads', async () => {
    // Made exactly as the old builder made it: `VACUUM INTO` both databases, then `tar -czf`
    // with the uploads tree added from its own parent.
    const stage = join(DIR, 'old-stage')
    mkdirSync(stage, { recursive: true })
    db().exec(`vacuum into '${join(stage, 'quire.db')}'`)
    analyticsDb().exec(`vacuum into '${join(stage, 'analytics.db')}'`)
    const archive = join(DIR, 'old.tar.gz')
    await Bun.$`tar -czf ${archive} -C ${stage} quire.db analytics.db -C ${DIR} uploads`
      .env({ ...process.env, COPYFILE_DISABLE: '1' }).quiet()

    const out = join(DIR, 'r8')
    const report = await restoreArchive({ archive, dataDir: join(out, 'data'), uploadsDir: join(out, 'uploads') })
    expect(report.format).toBe('files')
    expect(report.uploads).toBe(2)
    const want = live()
    expect(dump(join(out, 'data', 'quire.db'))).toEqual(want.content)
    expect(dump(join(out, 'data', 'analytics.db'))).toEqual(want.analytics)
    expect(readFileSync(join(out, 'uploads', 'icon.png'), 'utf8')).toBe('png')
  }, 20_000)
})
