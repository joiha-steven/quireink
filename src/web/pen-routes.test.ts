// The reader's marks over the wire (ADR 0047): who may write, what is answered, and that
// the whole thing vanishes with the owner's switch.
import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { createApp } from '@/web/app'
import { resetSecretCache } from '@/auth/secret'
import { resetLimits } from '@/server/rate-limit'
import { getSettings, saveSettings } from '@/content/settings'
import { COMMENTER_COOKIE, issueCommenter } from '@/comments/commenter'
import { CODE_HEADER, readerOfEmail, getMarks } from '@/server/reader-marks'
import { payload } from '@/test/api'

const DIR = './.tmp/test-pen-routes'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()

beforeEach(() => {
  for (const t of ['reader_marks', 'reader_keys', 'server_secrets', 'settings']) db().run(`delete from ${t}`)
  resetSecretCache()
  resetLimits()
})

const ITEMS = [{ id: 'a1', exact: 'the reed pen', prefix: '', suffix: ' is', kind: 'hl', ink: '', note: 'nice', t: 1 }]
const mint = async (): Promise<string> =>
  (await payload<{ code: string }>(await app.request('/api/pen/code', { method: 'POST' }))).code
const put = (headers: Record<string, string>, path = '/the-reed-pen', body: unknown = { items: ITEMS }) =>
  app.request(`/api/pen?path=${encodeURIComponent(path)}`, { method: 'PUT', headers, body: JSON.stringify(body) })
const get = (headers: Record<string, string>, path = '/the-reed-pen') =>
  app.request(`/api/pen?path=${encodeURIComponent(path)}`, { headers })

describe('a notebook code', () => {
  it('is minted for anyone, and then names the reader on every later call', async () => {
    const code = await mint()
    expect(code).toHaveLength(24)
    const me = await app.request('/api/pen/me', { headers: { [CODE_HEADER]: code } })
    expect(await payload<{ via: string }>(me)).toEqual({ via: 'code' })
    expect(me.headers.get('cache-control')).toBe('no-store')
    expect(await payload<{ via: null }>(await app.request('/api/pen/me'))).toEqual({ via: null })
    expect(await payload<{ via: null }>(await app.request('/api/pen/me', { headers: { [CODE_HEADER]: 'nope' } }))).toEqual({ via: null })
  })

  it('carries a page of marks there and back, and 404s a page never kept', async () => {
    const code = await mint()
    const h = { [CODE_HEADER]: code }
    expect((await get(h)).status).toBe(404)
    expect((await put(h)).status).toBe(204)
    const res = await get(h)
    expect(res.status).toBe(200)
    expect(await payload<{ items: unknown[] }>(res)).toEqual({ items: ITEMS })
    // Another code sees nothing of it.
    expect((await get({ [CODE_HEADER]: await mint() })).status).toBe(404)
  })

  it('is limited per address, so nobody mints a million', async () => {
    for (let i = 0; i < 5; i++) expect((await app.request('/api/pen/code', { method: 'POST' })).status).toBe(201)
    expect((await app.request('/api/pen/code', { method: 'POST' })).status).toBe(429)
  })
})

describe('a commenter', () => {
  // Signed inside each test: beforeEach replaces the server secret the signature is under.
  let cookie: Record<string, string> = {}
  beforeEach(() => {
    cookie = { cookie: `${COMMENTER_COOKIE}=${issueCommenter({ name: 'R', email: 'r@example.com', provider: 'google' })}` }
  })

  it('is a reader too, under an id that is not the address', async () => {
    expect(await payload<{ via: string }>(await app.request('/api/pen/me', { headers: cookie }))).toEqual({ via: 'google' })
    expect((await put(cookie)).status).toBe(204)
    expect(getMarks(readerOfEmail('r@example.com').id, '/the-reed-pen')).toBe(JSON.stringify(ITEMS))
    expect(db().query<{ reader: string }, []>(`select reader from reader_marks`).get()!.reader).not.toContain('example')
  })

  it('can forget everything kept here', async () => {
    await put(cookie)
    await put(cookie, '/another')
    expect((await app.request('/api/pen', { method: 'DELETE', headers: cookie })).status).toBe(204)
    expect((await get(cookie)).status).toBe(404)
    expect((await get(cookie, '/another')).status).toBe(404)
  })
})

describe('what is refused', () => {
  it('needs a reader for anything but minting', async () => {
    expect((await get({})).status).toBe(401)
    expect((await put({})).status).toBe(401)
    expect((await app.request('/api/pen', { method: 'DELETE' })).status).toBe(401)
    expect((await put({ [CODE_HEADER]: 'abcd-efgh-jkmn-pqrs-tuvw' })).status).toBe(401)
  })

  it('refuses a path off this origin, and a body that is not a list of marks', async () => {
    const h = { [CODE_HEADER]: await mint() }
    expect((await put(h, 'https://evil.example/p')).status).toBe(400)
    expect((await put(h, '//evil.example/p')).status).toBe(400)
    expect((await get(h, '')).status).toBe(400)
    expect((await put(h, '/p', { items: 'x' })).status).toBe(400)
    expect((await put(h, '/p', { items: [{ kind: 'hl' }] })).status).toBe(400)
    expect((await put(h, '/p', 'not json')).status).toBe(400)
    expect((await get(h, '/p')).status).toBe(404)
  })

  it('is not there at all while the owner keeps the pen off', async () => {
    const s = await getSettings()
    await saveSettings({ features: { ...s.features, readerPen: false } })
    expect((await app.request('/api/pen/code', { method: 'POST' })).status).toBe(404)
    expect((await app.request('/api/pen/me')).status).toBe(404)
    expect((await get({ [CODE_HEADER]: 'x' })).status).toBe(404)
  })
})
