// Themes installed from a zip, through the real router (ADR 0072, T2): install, list, install
// again, a new version, roll back, remove, and the public route that serves the files. Then every
// refusal, each of which must leave no row and no file behind, and the doors: no session, another
// site, a body too large.
import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/test/sqlite'
import { createApp } from '@/web/app'
import { createUser } from '@/auth/users'
import { COOKIE_NAME, createSession } from '@/auth/sessions'
import { resetSecretCache } from '@/auth/secret'
import { resetLimits } from '@/server/rate-limit'
import { getSettings, resetSettingsCache, saveSettings } from '@/content/settings'
import { payload } from '@/test/api'
import { THEME_LIMITS } from '@/theme'
import { CSS, FONT, MANIFEST, testZip, themeFiles, themeZip } from '@/theme/test-zip'
import type { InstalledTheme } from '@/content/installed-themes'

const DIR = './.tmp/test-admin-themes'
const STORE = join(process.cwd(), '.tmp/test-admin-themes-store')
process.env.STORAGE_LOCAL_DIR = STORE
rmSync(STORE, { recursive: true, force: true })
freshDatabase(DIR)
afterAll(() => {
  dropDatabase(DIR)
  try { rmSync(STORE, { recursive: true, force: true }) } catch { /* test hygiene only */ }
})

const app = createApp()
let cookie = ''
beforeEach(async () => {
  for (const t of ['sessions', 'users', 'themes', 'settings', 'server_secrets', 'activity_log']) db().run(`delete from ${t}`)
  rmSync(STORE, { recursive: true, force: true })
  mkdirSync(STORE, { recursive: true })
  resetSettingsCache()
  resetSecretCache()
  resetLimits()
  const user = await createUser({ username: 'hung', email: 'h@example.com', password: 'wandering violet cassette' })
  cookie = `${COOKIE_NAME}=${createSession(user.id).token}`
})

const SAME = { 'sec-fetch-site': 'same-origin' }
const asOwner = (path: string, init: RequestInit = {}) =>
  app.request(path, { ...init, headers: { cookie, ...SAME, ...(init.headers as Record<string, string> ?? {}) } })
const form = (zip: Uint8Array, name = 'theme.zip') => {
  const f = new FormData()
  f.append('file', new File([zip], name, { type: 'application/zip' }), name)
  return f
}
const install = (zip: Uint8Array) => asOwner('/api/themes', { method: 'POST', body: form(zip) })
const installed = async (zip: Uint8Array) => {
  const res = await install(zip)
  expect(res.status).toBe(200)
  return payload<{ id: string; version: string; hash: string; changed: boolean }>(res)
}
const list = async () => payload<InstalledTheme[]>(await asOwner('/api/themes'))
const rows = () => db().query('select theme_id, version, hash, deleted_at from themes order by id').all() as
  { theme_id: string; version: string; hash: string; deleted_at: number | null }[]
/** Every file under `themes/` in the store, as store-relative paths. */
const stored = (): string[] => {
  const root = join(STORE, 'themes')
  return existsSync(root) ? (readdirSync(root, { recursive: true, withFileTypes: true }) as { isFile(): boolean; parentPath: string; name: string }[])
    .filter((e) => e.isFile()).map((e) => join(e.parentPath, e.name).slice(STORE.length + 1).replaceAll('\\', '/')).sort() : []
}
const V2 = { ...MANIFEST, version: '1.1.0' }

describe('installing', () => {
  it('stores the files under the package hash and one row, and lists it as unreviewed', async () => {
    const out = await installed(themeZip())
    expect(out).toMatchObject({ id: 'broadsheet', version: '1.0.0', changed: true })
    expect(out.hash).toMatch(/^[0-9a-f]{64}$/)
    expect(stored()).toEqual(['fonts/body.woff2', 'images/grain.svg', 'screenshot.webp', 'theme.css', 'theme.json']
      .map((p) => `themes/${out.hash}/${p}`))
    expect(readFileSync(join(STORE, 'themes', out.hash, 'fonts/body.woff2'))).toEqual(Buffer.from(FONT))
    const [one] = await list()
    expect(one).toMatchObject({
      id: 'broadsheet', reviewed: false, active: false, previous: [],
      current: { version: '1.0.0', hash: out.hash, name: 'Broadsheet', author: 'A. Writer', license: 'MIT', api: 1, screenshot: `/themes/${out.hash}/screenshot.webp` },
    })
  })

  it('the same package again does nothing, however it was zipped', async () => {
    const first = await installed(themeZip())
    const again = await installed(testZip(themeFiles().reverse().map((e) => ({ ...e, deflate: false }))))
    expect(again).toEqual({ ...first, changed: false })
    expect(rows()).toHaveLength(1)
  })

  it('two requests installing the same package at once leave one row', async () => {
    const [a, b] = await Promise.all([install(themeZip()), install(themeZip())])
    expect([a.status, b.status]).toEqual([200, 200])
    expect(rows()).toHaveLength(1)
  })

  it('a new version becomes current and keeps the one before it', async () => {
    const v1 = await installed(themeZip())
    const v2 = await installed(themeZip({ 'theme.json': V2 }))
    expect(v2.hash).not.toBe(v1.hash)
    const [one] = await list()
    expect(one!.current.version).toBe('1.1.0')
    expect(one!.previous.map((p) => p.version)).toEqual(['1.0.0'])
  })

  it('the same version with other files replaces that version, and its old files still serve', async () => {
    const old = await installed(themeZip())
    const fresh = await installed(themeZip({ 'theme.css': `${CSS}\n.front{color:var(--c-text)}` }))
    expect(fresh.changed).toBe(true)
    expect(rows().map((r) => [r.version, r.hash, r.deleted_at === null])).toEqual([['1.0.0', old.hash, false], ['1.0.0', fresh.hash, true]])
    expect((await list())[0]!.previous).toEqual([])
    expect((await app.request(`/themes/${old.hash}/theme.css`)).status).toBe(200)
  })
})

describe('rolling back and removing', () => {
  it('rollback makes the version before current; with none before, it says so', async () => {
    await installed(themeZip())
    await installed(themeZip({ 'theme.json': V2 }))
    const res = await asOwner('/api/themes/broadsheet/rollback', { method: 'POST' })
    expect(res.status).toBe(200)
    expect(await payload<{ current: { version: string } }>(res)).toMatchObject({ current: { version: '1.0.0' }, removed: { version: '1.1.0' } })
    expect((await list())[0]!.current.version).toBe('1.0.0')
    const none = await asOwner('/api/themes/broadsheet/rollback', { method: 'POST' })
    expect(none.status).toBe(409)
    expect(((await none.json()) as { error: string }).error).toBe('no_previous')
    expect((await asOwner('/api/themes/nothing-here/rollback', { method: 'POST' })).status).toBe(404)
  })

  it('remove soft-deletes every version, keeps the files, and puts a blog wearing it back on plain', async () => {
    const v1 = await installed(themeZip())
    await installed(themeZip({ 'theme.json': V2 }))
    await saveSettings({ title: 'A blog' })
    // Only a built-in theme can be chosen through a save today; a later build writes the id itself.
    db().run(`update settings set data = json_set(data, '$.theme', 'broadsheet') where id = 1`)
    resetSettingsCache()
    expect((await getSettings()).theme).toBe('broadsheet')
    expect((await list())[0]!.active).toBe(true)

    const res = await asOwner('/api/themes/broadsheet', { method: 'DELETE' })
    expect(res.status).toBe(200)
    expect(await payload<{ id: string; removed: number }>(res)).toEqual({ id: 'broadsheet', removed: 2 })
    expect(await list()).toEqual([])
    expect(rows().every((r) => r.deleted_at !== null)).toBe(true)
    expect((await getSettings()).theme).toBe('plain')
    expect(stored().length).toBe(10)
    expect((await app.request(`/themes/${v1.hash}/fonts/body.woff2`)).status).toBe(200)
    expect((await asOwner('/api/themes/broadsheet', { method: 'DELETE' })).status).toBe(404)
  })

  it('removing one theme leaves another and the chosen built-in theme alone', async () => {
    await installed(themeZip())
    await installed(themeZip({ 'theme.json': { ...MANIFEST, id: 'other' } }))
    await saveSettings({ theme: 'paper' })
    expect((await asOwner('/api/themes/broadsheet', { method: 'DELETE' })).status).toBe(200)
    expect((await list()).map((t) => t.id)).toEqual(['other'])
    expect((await getSettings()).theme).toBe('paper')
  })
})

describe('serving the files', () => {
  it('the sheet inside @layer theme, every file immutable for a year and nosniff, the SVG sandboxed', async () => {
    const { hash } = await installed(themeZip())
    const css = await app.request(`/themes/${hash}/theme.css`)
    expect(css.status).toBe(200)
    expect(css.headers.get('content-type')).toBe('text/css; charset=utf-8')
    expect(css.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    expect(css.headers.get('x-content-type-options')).toBe('nosniff')
    expect(await css.text()).toBe(`@layer theme{${CSS}}`)

    const font = await app.request(`/themes/${hash}/fonts/body.woff2`)
    expect(font.headers.get('content-type')).toBe('font/woff2')
    expect(font.headers.get('content-length')).toBe(String(FONT.length))
    expect(new Uint8Array(await font.arrayBuffer())).toEqual(FONT)

    const svg = await app.request(`/themes/${hash}/images/grain.svg`)
    expect(svg.headers.get('content-type')).toBe('image/svg+xml')
    expect(svg.headers.get('content-security-policy')).toContain('sandbox')
  })

  it('answers nothing it did not install: another path, another hash, a file planted beside the package', async () => {
    const { hash } = await installed(themeZip())
    writeFileSync(join(STORE, 'themes', hash, 'planted.css'), 'body{}')
    mkdirSync(join(STORE, 'media'), { recursive: true })
    writeFileSync(join(STORE, 'media', 'private.webp'), 'x')
    for (const path of [
      `/themes/${hash}/planted.css`, `/themes/${hash}/fonts/none.woff2`, `/themes/${'0'.repeat(64)}/theme.css`,
      `/themes/${hash}/..%2f..%2fmedia%2fprivate.webp`, `/themes/${hash.slice(0, 12)}/theme.css`, `/themes/${hash}`,
    ]) {
      expect([path, (await app.request(path)).status]).toEqual([path, 404])
    }
  })

  it('a row whose file the store lost answers 404, not 500', async () => {
    const { hash } = await installed(themeZip())
    rmSync(join(STORE, 'themes', hash, 'theme.css'))
    expect((await app.request(`/themes/${hash}/theme.css`)).status).toBe(404)
  })
})

describe('refused, and nothing written', () => {
  const refusedFor = async (zip: Uint8Array, rule: string) => {
    const res = await install(zip)
    expect(res.status).toBe(422)
    const body = (await res.json()) as { success: boolean; error: string; violations: { rule: string }[] }
    expect(body.success).toBe(false)
    expect(body.error).toBe('theme_refused')
    expect(body.violations.map((v) => v.rule)).toContain(rule)
    expect(rows()).toEqual([])
    expect(stored()).toEqual([])
  }
  const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  const bomb = () => { const b = new Uint8Array(20 * 1024 * 1024); b.set(PNG); return b }

  it('a path with ..', () => refusedFor(testZip([...themeFiles(), { name: '../evil.png', data: new Uint8Array(PNG) }]), 'A3'))
  it('a bomb: declared small, inflating large', () =>
    refusedFor(testZip([...themeFiles(), { name: 'images/b.png', data: bomb(), deflate: true, declaredSize: 100 }]), 'A5'))
  it('a declared total past 10 MB', () =>
    refusedFor(testZip([...themeFiles(), ...Array.from({ length: 11 }, (_, i) => ({ name: `images/${i}.png`, data: new Uint8Array(1), declaredSize: THEME_LIMITS.imageBytes, rawData: new Uint8Array(4) }))]), 'A5'))
  it('an SVG with a script', () => refusedFor(themeZip({ 'images/grain.svg': '<svg xmlns="http://www.w3.org/2000/svg"><script>x()</script></svg>' }), 'A4'))
  it('a sheet that calls out', () => refusedFor(themeZip({ 'theme.css': `${CSS}\n.front{background:url(//evil.example/x.png)}` }), 'A2'))
  it('no theme.json', () => refusedFor(themeZip({ 'theme.json': null }), 'A3'))
  it('the id of a built-in theme', () => refusedFor(themeZip({ 'theme.json': { ...MANIFEST, id: 'plain' } }), 'A6'))
  it('not a zip', () => refusedFor(new TextEncoder().encode('PK but not really'), 'A3'))

  it('over 5 MB: 413, before it is read', async () => {
    const big = new Uint8Array(THEME_LIMITS.zipBytes + 1)
    const res = await install(big)
    expect(res.status).toBe(413)
    expect(rows()).toEqual([])
    // Past the framing allowance, the body cap answers before the handler runs.
    const huger = await install(new Uint8Array(THEME_LIMITS.zipBytes + 200 * 1024))
    expect(huger.status).toBe(413)
  })

  it('no file in the form: 400', async () => {
    expect((await asOwner('/api/themes', { method: 'POST', body: new FormData() })).status).toBe(400)
  })
})

describe('the doors', () => {
  it('no session: 401 on every route, and nothing written', async () => {
    const anon = (path: string, init: RequestInit = {}) => app.request(path, { ...init, headers: SAME })
    expect((await anon('/api/themes', { method: 'POST', body: form(themeZip()) })).status).toBe(401)
    expect((await anon('/api/themes')).status).toBe(401)
    expect((await anon('/api/themes/broadsheet', { method: 'DELETE' })).status).toBe(401)
    expect((await anon('/api/themes/broadsheet/rollback', { method: 'POST' })).status).toBe(401)
    expect(rows()).toEqual([])
    expect(stored()).toEqual([])
  })

  it('a signed-in owner driven from another site: 403, and nothing written', async () => {
    const res = await app.request('/api/themes', { method: 'POST', body: form(themeZip()), headers: { cookie, 'sec-fetch-site': 'cross-site' } })
    expect(res.status).toBe(403)
    await installed(themeZip())
    const del = await app.request('/api/themes/broadsheet', { method: 'DELETE', headers: { cookie, 'sec-fetch-site': 'cross-site' } })
    expect(del.status).toBe(403)
    expect(rows().every((r) => r.deleted_at === null)).toBe(true)
  })
})
