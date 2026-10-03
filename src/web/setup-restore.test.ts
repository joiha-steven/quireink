// A backup loaded into an empty blog at first setup, driven through the real router (ADR 0067).
//
// Two blogs in one file: a source with an owner, posts, tags and pictures, archived the way the
// download archives it; then a fresh install the archive goes into. Most cases are refusals,
// because this is a door that creates an owner without a session, and the shut cases are the ones
// worth proving: no token, a blog that is not empty, an archive from another version, a sealed one
// with no key, and an archive that fails half-way and must leave the blog as empty as it found it.
import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync, gzipSync } from 'node:zlib'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/test/sqlite'
import { createApp } from '@/web/app'
import { createUser, noUsersYet } from '@/auth/users'
import { savePost } from '@/content/posts'
import { getSettings, saveSettings } from '@/content/settings'
import { DEFAULT_BACKUPS } from '@/content/settings-defaults'
import { archiveStream } from '@/server/archive'
import { newIdentity, passphraseRecipient } from '@/server/backup-crypt'
import { tarEntries, tarStream, type TarEntry } from '@/server/tar'
import { resetLimits } from '@/server/rate-limit'
import { resetSetupToken, setupToken } from '@/server/setup-token'

const ROOT = join(process.cwd(), '.tmp/test-setup-restore')
const PASS = 'a passphrase somebody would actually type'
rmSync(ROOT, { recursive: true, force: true })
afterAll(() => {
  delete process.env.STORAGE_LOCAL_DIR
  dropDatabase(join(ROOT, 'last'))
  rmSync(ROOT, { recursive: true, force: true })
})

const bytesOf = async (s: ReadableStream<Uint8Array>): Promise<Uint8Array> => new Uint8Array(await new Response(s).arrayBuffer())

// ----- the source blog, archived twice: in the clear and sealed ----------------------------------

freshDatabase(join(ROOT, 'source'))
process.env.STORAGE_LOCAL_DIR = join(ROOT, 'source-uploads')
mkdirSync(join(ROOT, 'source-uploads', 'media'), { recursive: true })
writeFileSync(join(ROOT, 'source-uploads', 'media', 'photo.webp'), new Uint8Array(5000).map((_, i) => i & 0xff))
await createUser({ username: 'owner', email: 'owner@example.com', password: 'wandering violet cassette' })
for (let i = 0; i < 12; i++) {
  await savePost({ title: `Ngày thứ ${i}`, slug: `day-${i}`, content: `Body ${i}`, status: 'published',
    date: '2020-01-01T00:00:00.000Z', tags: ['diary'] })
}
await saveSettings({ title: 'The moved blog', setupDone: true })
const SOURCE_POSTS = (db().query('select count(*) as n from posts').get() as { n: number }).n
const PLAIN = await bytesOf(await archiveStream())
const identity = newIdentity()
const pass = passphraseRecipient(PASS)
await saveSettings({ backups: { ...DEFAULT_BACKUPS, pubKey: identity.publicKey, passPub: pass.publicKey, passSalt: pass.salt } })
await saveSettings({ backups: { ...(await getSettings()).backups, encrypt: true } })
const SEALED = await bytesOf(await archiveStream())

/** The plain archive with its entries passed through `edit`, gzipped again. */
async function rewritten(edit: (name: string, bytes: Uint8Array) => Uint8Array): Promise<Uint8Array> {
  const out: TarEntry[] = []
  for await (const item of tarEntries((async function* () { yield new Uint8Array(gunzipSync(PLAIN)) })())) {
    const parts: Uint8Array[] = []
    for await (const piece of item.body()) parts.push(piece)
    const bytes = edit(item.name, new Uint8Array(Buffer.concat(parts)))
    out.push({ name: item.name, size: bytes.length, body: bytes })
  }
  return new Uint8Array(gzipSync(await bytesOf(tarStream(out))))
}

// ----- the empty blog ---------------------------------------------------------------------------

let n = 0
/** A brand-new install with nothing in it, as `docker compose up` leaves one. */
function freshInstall(): void {
  const dir = join(ROOT, `install-${++n}`)
  freshDatabase(dir)
  rmSync(join(ROOT, 'last'), { force: true, recursive: true })
  process.env.STORAGE_LOCAL_DIR = join(dir, 'uploads')
  resetSetupToken()
  resetLimits()
}

const app = createApp()
const load = (archive: Uint8Array, fields: Record<string, string> = {}) => {
  const form = new FormData()
  form.set('token', fields.token ?? setupToken())
  for (const [k, v] of Object.entries(fields)) if (k !== 'token') form.set(k, v)
  form.set('archive', new File([archive], 'quire-2026-10-03T120000.tar.gz'))
  return app.request('/setup/restore', { method: 'POST', body: form })
}
const count = (table: string): number => (db().query(`select count(*) as n from ${table}`).get() as { n: number }).n

beforeEach(freshInstall)

describe('the door', () => {
  it('is offered on the unclaimed screen and the claim screen, and closed once there is an owner', async () => {
    expect(await (await app.request('/setup')).text()).toContain('href="/setup/restore"')
    const claim = await (await app.request(`/setup?token=${setupToken()}`)).text()
    expect(claim).toContain(`/setup/restore?token=${setupToken()}`)
    const form = await (await app.request(`/setup/restore?token=${setupToken()}`)).text()
    expect(form).toContain('enctype="multipart/form-data"')
    // The token comes before the archive in the form, which is what lets the server check it first.
    expect(form.indexOf('name="token"')).toBeLessThan(form.indexOf('name="archive"'))
    await createUser({ username: 'someone', email: 's@example.com', password: 'wandering violet cassette' })
    expect((await app.request('/setup/restore')).status).toBe(404)
    expect((await load(PLAIN)).status).toBe(409)
  })

  it('refuses a wrong token before reading the archive, and loads nothing', async () => {
    const res = await load(PLAIN, { token: 'not-the-token' })
    expect(res.status).toBe(403)
    expect(count('posts')).toBe(0)
    expect(noUsersYet()).toBe(true)
  })
})

describe('a backup loaded into an empty blog', () => {
  it('brings every post, the owner, the settings and the pictures, and ends at the sign-in', async () => {
    const res = await load(PLAIN)
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('/login')
    expect(count('posts')).toBe(SOURCE_POSTS)
    expect((db().query('select username from users').get() as { username: string }).username).toBe('owner')
    expect((await getSettings()).title).toBe('The moved blog')
    // Rebuilt by the triggers as the rows went in: search works on the moved blog.
    expect((db().query(`select count(*) as n from posts_fts where posts_fts match 'Ngày'`).get() as { n: number }).n).toBe(12)
    expect(readFileSync(join(process.env.STORAGE_LOCAL_DIR!, 'media', 'photo.webp')))
      .toEqual(readFileSync(join(ROOT, 'source-uploads', 'media', 'photo.webp')))
    // Claimed: the setup door is a claimed-blog page now, and the token is spent.
    expect((await app.request('/setup/restore')).status).toBe(404)
    expect((await load(PLAIN)).status).toBe(409)
  })

  it('opens a sealed one with its passphrase, and asks for a key without one', async () => {
    const without = await load(SEALED)
    expect(without.status).toBe(422)
    expect(count('posts')).toBe(0)
    const wrong = await load(SEALED, { passphrase: 'not it at all, sadly' })
    expect(wrong.status).toBe(422)
    const right = await load(SEALED, { passphrase: PASS })
    expect(right.status).toBe(303)
    expect(count('posts')).toBe(SOURCE_POSTS)
  }, 20_000)

  it('also opens it with the key from the key file', async () => {
    expect((await load(SEALED, { identity: identity.secret })).status).toBe(303)
    expect(noUsersYet()).toBe(false)
  })
})

describe('what it refuses', () => {
  it('a blog somebody has already written in, even with no owner yet', async () => {
    db().run(`insert into posts (slug, title, content, status, date, updated_at, created_at) values ('mine', 'Mine', 'x', 'draft', 1, 1, 1)`)
    const res = await load(PLAIN)
    expect(res.status).toBe(409)
    expect(await res.text()).toContain('not empty')
    expect(count('posts')).toBe(1)
    expect(noUsersYet()).toBe(true)
  })

  it('an archive from another version, naming the version to upgrade the old blog to', async () => {
    const other = await rewritten((name, bytes) => name === 'manifest.json'
      ? new TextEncoder().encode(new TextDecoder().decode(bytes).replace(/"version": "[^"]+"/, '"version": "1.9.0"'))
      : bytes)
    const res = await load(other)
    expect(res.status).toBe(422)
    const body = await res.text()
    expect(body).toContain('1.9.0')
    expect(count('posts')).toBe(0)
  })

  it('an archive that fails half-way, leaving the blog exactly as empty as it was', async () => {
    // `users` comes after `posts` in the archive; damage it, and the posts already loaded must go.
    const damaged = await rewritten((name, bytes) => name === 'content/users.jsonl'
      ? new TextEncoder().encode(new TextDecoder().decode(bytes).replace('owner@example.com', 'other@example.com'))
      : bytes)
    const res = await load(damaged)
    expect(res.status).toBe(422)
    expect(count('posts')).toBe(0)
    expect(count('post_terms')).toBe(0)
    expect(noUsersYet()).toBe(true)
    expect(existsSync(join(process.env.STORAGE_LOCAL_DIR!, 'media', 'photo.webp'))).toBe(false)
    // And the door is still open: the right archive goes in afterwards.
    expect((await load(PLAIN)).status).toBe(303)
  })
})
