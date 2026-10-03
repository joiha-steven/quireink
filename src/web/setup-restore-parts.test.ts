// A backup loaded into an empty blog in parts (G4), through the real router and the program that
// pushes one (`server/restore-push.ts`). The single-request door is `setup-restore.test.ts`; this
// is the same door for an archive too large for one request, and it has to be shut in all the same
// places: no token, an owner already there, a blog with something in it.
import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/test/sqlite'
import { createApp } from '@/web/app'
import { createUser, noUsersYet } from '@/auth/users'
import { savePost } from '@/content/posts'
import { getSettings, saveSettings } from '@/content/settings'
import { DEFAULT_BACKUPS } from '@/content/settings-defaults'
import { archiveStream } from '@/server/archive'
import { newIdentity, passphraseRecipient } from '@/server/backup-crypt'
import { resetLimits } from '@/server/rate-limit'
import { resetSetupToken, setupToken } from '@/server/setup-token'
import { PushRefused, pushArchive } from '@/server/restore-push'
import { PARTS_TTL_MS, parsePartsId, sweepParts } from '@/server/restore-parts'
import { incomingDir } from '@/runtime/bun/archive'

const ROOT = join(process.cwd(), '.tmp/test-setup-restore-parts')
const PASS = 'a passphrase somebody would actually type'
const DATA_BEFORE = process.env.DATA_DIR
rmSync(ROOT, { recursive: true, force: true })
afterAll(() => {
  delete process.env.STORAGE_LOCAL_DIR
  if (DATA_BEFORE === undefined) delete process.env.DATA_DIR
  else process.env.DATA_DIR = DATA_BEFORE
  dropDatabase(join(ROOT, 'last'))
  rmSync(ROOT, { recursive: true, force: true })
})

const bytesOf = async (s: ReadableStream<Uint8Array>): Promise<Uint8Array> => new Uint8Array(await new Response(s).arrayBuffer())

// ----- the source blog: posts, an owner, and enough of a picture to need several parts --------------

freshDatabase(join(ROOT, 'source'))
process.env.STORAGE_LOCAL_DIR = join(ROOT, 'source-uploads')
mkdirSync(join(ROOT, 'source-uploads', 'media'), { recursive: true })
// Random, so gzip cannot shrink it below the part size the tests use.
const PICTURE = crypto.getRandomValues(new Uint8Array(60_000))
writeFileSync(join(ROOT, 'source-uploads', 'media', 'photo.webp'), PICTURE)
await createUser({ username: 'owner', email: 'owner@example.com', password: 'wandering violet cassette' })
for (let i = 0; i < 8; i++) {
  await savePost({ title: `Ngày thứ ${i}`, slug: `day-${i}`, content: `Body ${i}`, status: 'published', date: '2020-01-01T00:00:00.000Z' })
}
const SOURCE_POSTS = (db().query('select count(*) as n from posts').get() as { n: number }).n
const PLAIN = await bytesOf(await archiveStream())
const pass = passphraseRecipient(PASS)
await saveSettings({ backups: { ...DEFAULT_BACKUPS, pubKey: newIdentity().publicKey, passPub: pass.publicKey, passSalt: pass.salt } })
await saveSettings({ backups: { ...(await getSettings()).backups, encrypt: true } })
const SEALED = await bytesOf(await archiveStream())

// ----- the empty blog ----------------------------------------------------------------------------

let n = 0
function freshInstall(): void {
  const dir = join(ROOT, `install-${++n}`)
  freshDatabase(dir)
  rmSync(join(ROOT, 'last'), { force: true, recursive: true })
  process.env.DATA_DIR = dir
  process.env.STORAGE_LOCAL_DIR = join(dir, 'uploads')
  resetSetupToken()
  resetLimits()
}
beforeEach(freshInstall)

const app = createApp()
const go = async (url: string, init: RequestInit) => app.request(url, init)
/** The archive as a file on disk, which is how a blog moving itself will hold one. */
const fileOf = async (archive: Uint8Array) => {
  const path = join(ROOT, `archive-${archive.length}.tar.gz`)
  await Bun.write(path, archive)
  return Bun.file(path)
}
const push = async (archive: Uint8Array, opts: Parameters<typeof pushArchive>[3] = {}, token = setupToken()) =>
  pushArchive('http://blog.test', token, await fileOf(archive), { partBytes: 16 * 1024, fetch: go, ...opts })
const count = (table: string): number => (db().query(`select count(*) as n from ${table}`).get() as { n: number }).n
const api = (path: string, init: RequestInit = {}, token = setupToken()) =>
  app.request(`/setup/restore/parts${path}`, { ...init, headers: { authorization: `Bearer ${token}`, ...(init.headers as Record<string, string>) } })

describe('a backup in parts', () => {
  it('is what the form switches to past the threshold, with the script only this page loads', async () => {
    const page = await (await app.request(`/setup/restore?token=${setupToken()}`)).text()
    expect(page).toMatch(/data-chunk-above="\d+" data-part-bytes="\d+"/)
    expect(page).toMatch(/<script src="\/assets\/setup-restore\.[0-9a-z]+\.js" defer>/)
    expect(await (await app.request('/login')).text()).not.toContain('setup-restore.')
  })

  it('loads every post, the owner and the pictures, from parts of 16 KB, and leaves no part behind', async () => {
    const report = await push(PLAIN)
    expect(report.parts).toBe(Math.ceil(PLAIN.length / (16 * 1024)))
    expect(report.parts).toBeGreaterThan(2)
    expect(count('posts')).toBe(SOURCE_POSTS)
    expect(noUsersYet()).toBe(false)
    expect(readFileSync(join(process.env.STORAGE_LOCAL_DIR!, 'media', 'photo.webp'))).toEqual(Buffer.from(PICTURE))
    expect(existsSync(join(incomingDir(), report.id))).toBe(false)
    // Claimed: every route of the door is shut now, the token spent.
    expect((await api('', { method: 'POST', body: JSON.stringify({ size: 10 }) })).status).toBe(409)
  })

  it('resumes: the parts already held are not sent again', async () => {
    const begun = await (await api('', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ size: PLAIN.length }) })).json() as { data: { id: string } }
    const id = begun.data.id
    // The first two parts arrive, then the connection drops.
    for (const part of [1, 2]) {
      const bytes = PLAIN.subarray((part - 1) * 16 * 1024, part * 16 * 1024)
      expect((await api(`/${id}/${part}`, { method: 'PUT', headers: { 'content-length': String(bytes.length) }, body: bytes })).status).toBe(200)
    }
    const status = await (await api(`/${id}`)).json() as { data: { held: number; parts: { part: number }[] } }
    expect(status.data.parts.map((p) => p.part)).toEqual([1, 2])
    let puts = 0
    const counted = (url: string, init: RequestInit) => { if (init.method === 'PUT') puts++; return go(url, init) }
    const report = await push(PLAIN, { resume: id, fetch: counted })
    expect(puts).toBe(report.parts - 2)
    expect(count('posts')).toBe(SOURCE_POSTS)
  })

  it('a sealed one: a wrong passphrase keeps the parts, and the right one loads them without sending again', async () => {
    const wrong = await push(SEALED, { passphrase: 'not it at all, sadly' }).catch((e: unknown) => e)
    expect(wrong).toBeInstanceOf(PushRefused)
    expect((wrong as PushRefused).status).toBe(422)
    expect(count('posts')).toBe(0)
    const id = readdirSync(incomingDir())[0]!
    const loaded = await api(`/${id}/load`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ passphrase: PASS }) })
    expect(loaded.status).toBe(200)
    expect(count('posts')).toBe(SOURCE_POSTS)
  }, 30_000)
})

describe('what it refuses', () => {
  it('a wrong token, on every route, charged to the claim\'s budget', async () => {
    const begin = await api('', { method: 'POST', body: JSON.stringify({ size: 10 }) }, 'not-the-token')
    expect(begin.status).toBe(403)
    const put = await api('/lkf0xs-a-0123456789abcdef0123456789abcdef/1', { method: 'PUT', headers: { 'content-length': '3' }, body: 'abc' }, 'nope')
    expect(put.status).toBe(403)
    for (let i = 0; i < 10; i++) await api('', { method: 'POST', body: '{}' }, 'still-wrong')
    // Ten misses from this address: even the right token waits now, as it would on the claim.
    expect((await api('', { method: 'POST', body: JSON.stringify({ size: 10 }) })).status).toBe(429)
  })

  it('a blog with something in it, before a byte is sent', async () => {
    db().run(`insert into posts (slug, title, content, status, date, updated_at, created_at) values ('mine', 'Mine', 'x', 'draft', 1, 1, 1)`)
    const refused = await push(PLAIN).catch((e: unknown) => e) as PushRefused
    expect(refused.code).toBe('not-empty')
    expect(count('posts')).toBe(1)
  })

  it('parts past the size the upload declared, a part with no length, an id it never made, and loading too soon', async () => {
    const res = await api('', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ size: 5 }) })
    const id = ((await res.json()) as { data: { id: string } }).data.id
    expect((await api(`/${id}/1`, { method: 'PUT', headers: { 'content-length': '6' }, body: 'abcdef' })).status).toBe(413)
    expect((await api(`/${id}/1`, { method: 'PUT', headers: { 'content-length': '3' }, body: 'abc' })).status).toBe(200)
    expect((await api(`/${id}/2`, { method: 'PUT', headers: { 'content-length': '3' }, body: 'def' })).status).toBe(413)
    expect((await api(`/${id}/0`, { method: 'PUT', headers: { 'content-length': '2' }, body: 'de' })).status).toBe(400)
    const early = await api(`/${id}/load`, { method: 'POST', body: '{}' })
    expect(early.status).toBe(409)
    expect(((await early.json()) as { code: string }).code).toBe('incomplete')
    expect((await api('/../../etc/1', { method: 'PUT', headers: { 'content-length': '1' }, body: 'x' })).status).toBe(404)
    expect((await api('/0-5-0123456789abcdef0123456789abcdef/1', { method: 'PUT', headers: { 'content-length': '1' }, body: 'x' })).status).toBe(404)
    expect((await api(`/${id}`, { method: 'DELETE' })).status).toBe(200)
    expect(existsSync(join(incomingDir(), id))).toBe(false)
  })
})

describe('the sweep', () => {
  it('drops an upload a day after it began, and anything it could not have named', async () => {
    const res = await api('', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ size: 3 }) })
    const id = ((await res.json()) as { data: { id: string } }).data.id
    await api(`/${id}/1`, { method: 'PUT', headers: { 'content-length': '3' }, body: 'abc' })
    mkdirSync(join(incomingDir(), 'stray'), { recursive: true })
    expect(await sweepParts()).toBe(1)
    expect(existsSync(join(incomingDir(), id))).toBe(true)
    expect(await sweepParts(parsePartsId(id)!.begunAt + PARTS_TTL_MS + 1)).toBe(1)
    expect(readdirSync(incomingDir())).toEqual([])
  })
})
