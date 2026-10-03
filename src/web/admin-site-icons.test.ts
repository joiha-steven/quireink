// Issue #69: a favicon or app icon removed in Settings stayed in Library > Files for good. Remove
// only cleared the setting, the library listed every icon blob as read-only, and every delete path
// dropped icons silently while answering success — so the page removed the rows and the next load
// put them back. And picking a new icon in Settings sent nothing at all (the client half, a guard
// on an empty `data-icon-file`, is held in `settings-pics.test.ts`).
//
// What is pinned here: an icon Settings uses says so and cannot be deleted, with a reason; one
// nothing uses is an ordinary file that goes to the Trash, comes back to Site icons when restored,
// and leaves the store when purged.
import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/test/sqlite'
import { createApp } from '@/web/app'
import { createUser } from '@/auth/users'
import { COOKIE_NAME, createSession } from '@/auth/sessions'
import { resetSecretCache } from '@/auth/secret'
import { resetLimits } from '@/server/rate-limit'
import { payload } from '@/test/api'
import { getTrashedFiles } from '@/media/files'
import { collapseBlob } from '@/media/blob'

const DIR = './.tmp/test-site-icons'
const STORE = './.tmp/test-site-icons-store'
process.env.STORAGE_LOCAL_DIR = STORE
try { rmSync(STORE, { recursive: true, force: true }) } catch { /* first run */ }
freshDatabase(DIR)
afterAll(() => {
  dropDatabase(DIR)
  try { rmSync(STORE, { recursive: true, force: true }) } catch { /* test hygiene only */ }
})

const app = createApp()
let cookie = ''
beforeEach(async () => {
  for (const t of ['sessions', 'users', 'files', 'activity_log', 'settings', 'server_secrets']) db().run(`delete from ${t}`)
  resetSecretCache()
  resetLimits()
  const user = await createUser({ username: 'hung', email: 'h@example.com', password: 'wandering violet cassette' })
  cookie = `${COOKIE_NAME}=${createSession(user.id).token}`
})

const asOwner = (path: string, init: RequestInit = {}) =>
  app.request(path, { ...init, headers: { cookie, 'sec-fetch-site': 'same-origin', ...(init.headers as Record<string, string> ?? {}) } })
const json = (path: string, method: string, data: unknown) =>
  asOwner(path, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) })

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

async function uploadIcon(kind: string): Promise<string> {
  const form = new FormData()
  form.append('file', new File([PNG], 'favicon.png', { type: 'image/png' }), 'favicon.png')
  form.append('kind', kind)
  const res = await asOwner('/api/files/upload', { method: 'POST', body: form })
  expect(res.status).toBe(201)
  return (await payload<{ url: string }>(res)).url
}
const icons = async () => payload<{ url: string; inUse?: boolean }[]>(await asOwner('/api/files/icons'))
const onDisk = (url: string) => existsSync(`${STORE}/${collapseBlob(url)}`)

describe('a site icon in the library', () => {
  it('in use: listed as such, and a delete is refused with a reason instead of a false success', async () => {
    const url = await uploadIcon('favicon')
    expect((await json('/api/settings', 'PUT', { faviconUrl: url })).status).toBe(200)
    expect((await icons()).find((i) => i.url === url)?.inUse).toBe(true)
    const res = await json('/api/files/delete', 'POST', { urls: [url] })
    expect(res.status).toBe(409)
    expect(((await res.json()) as { error?: string }).error).toBe('icon_in_use')
    expect(onDisk(url)).toBe(true)
  })

  it('removed in Settings: "not used", deleted into the Trash, restored to Site icons, purged from the store', async () => {
    const url = await uploadIcon('app-icon')
    await json('/api/settings', 'PUT', { appIconUrl: url })
    await json('/api/settings', 'PUT', { appIconUrl: '' }) // Settings' Remove, then Save
    expect((await icons()).find((i) => i.url === url)?.inUse).toBe(false)

    expect((await json('/api/files/delete', 'POST', { urls: [url] })).status).toBe(200)
    expect((await icons()).some((i) => i.url === url)).toBe(false)
    expect((await getTrashedFiles()).map((f) => collapseBlob(f.url))).toContain(collapseBlob(url))

    expect((await json('/api/trash', 'POST', { kind: 'files', action: 'restore', ids: [url] })).status).toBe(200)
    expect((await icons()).some((i) => i.url === url)).toBe(true)
    expect(db().query<{ n: number }, []>('select count(*) as n from files').get()!.n).toBe(0)

    await json('/api/files/delete', 'POST', { urls: [url] })
    expect((await json('/api/trash', 'POST', { kind: 'files', action: 'purge', ids: [url], force: true })).status).toBe(200)
    expect(onDisk(url)).toBe(false)
    expect((await getTrashedFiles()).length).toBe(0)
  })

  it('lists and deletes an icon uploaded with no kind (`icon-<ms>`), which used to be invisible', async () => {
    mkdirSync(`${STORE}/files`, { recursive: true })
    writeFileSync(`${STORE}/files/icon-1790310941364.jpg`, PNG)
    const row = (await icons()).find((i) => i.url.endsWith('files/icon-1790310941364.jpg'))
    expect(row?.inUse).toBe(false)
    expect((await json('/api/files/delete', 'POST', { urls: [row!.url] })).status).toBe(200)
    expect((await icons()).some((i) => i.url === row!.url)).toBe(false)
  })
})
