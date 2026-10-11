// An installed theme whose manifest does not read (ADR 0072, T2c). A backup puts theme rows back
// without checking them again, so the admin has to survive one: the Settings screen and the list
// route still answer 200, the theme is listed as unreadable with its Remove key and no way to
// choose it, the warning says why the site is drawn as Plain, and Remove clears it.
import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/test/sqlite'
import { createApp } from '@/web/app'
import { createUser } from '@/auth/users'
import { COOKIE_NAME, createSession } from '@/auth/sessions'
import { resetSecretCache } from '@/auth/secret'
import { resetLimits } from '@/server/rate-limit'
import { resetSettingsCache } from '@/content/settings'
import { forgetInstalledTheme } from '@/content/chosen-theme'
import { clearCache } from '@/server/cache'
import { payload } from '@/test/api'
import type { InstalledTheme } from '@/content/installed-themes'
import { MANIFEST, themeZip } from '@/theme/test-zip'

const DIR = './.tmp/test-admin-themes-unreadable'
const STORE = join(process.cwd(), '.tmp/test-admin-themes-unreadable-store')
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
async function install(zip: Uint8Array): Promise<void> {
  const body = new FormData()
  body.append('file', new File([zip], 'theme.zip'), 'theme.zip')
  expect((await asOwner('/api/themes', { method: 'POST', body })).status).toBe(200)
}

/** Broadsheet chosen, a second theme beside it, then Broadsheet's manifest replaced with `manifest`. */
async function corrupt(manifest: string): Promise<void> {
  await install(themeZip())
  await install(themeZip({ 'theme.json': { ...MANIFEST, id: 'ledger', name: 'Ledger' } }))
  const chose = await asOwner('/api/settings', {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ theme: 'broadsheet' }),
  })
  expect(chose.status).toBe(200)
  db().run(`update themes set manifest = ? where theme_id = 'broadsheet'`, [manifest])
  forgetInstalledTheme()
  clearCache()
}

/** The cell of one installed theme on the Look card. */
const cellOf = (html: string, id: string): string => {
  const start = html.indexOf(`data-theme-cell="${id}"`)
  expect(start).toBeGreaterThan(-1)
  return html.slice(start, html.indexOf('data-theme-cell="', start + 1) >>> 0)
}

describe('an installed theme whose manifest does not read', () => {
  for (const [label, manifest] of [['not JSON', '{not json'], ['JSON of the wrong shape', '{"name":7}']] as const) {
    it(`keeps the Settings screen up, warns, and offers Remove only (${label})`, async () => {
      await corrupt(manifest)
      const res = await asOwner('/admin/settings?tab=appearance')
      expect(res.status).toBe(200)
      const html = await res.text()
      expect(html).toContain('data-theme-broken="unreadable"')
      const cell = cellOf(html, 'broadsheet')
      expect(cell).toContain('data-theme-remove="broadsheet"')
      expect(cell).toContain('data-theme-unreadable')
      // Not a key of the theme track: it cannot be pressed, and nothing reads as chosen.
      expect(html).not.toContain('data-choice="broadsheet"')
      expect(html).toContain('data-k="theme" data-was=""')
      // The theme beside it is untouched.
      expect(html).toContain('data-choice="ledger"')
    })

    it(`answers the list route with the theme marked unreadable (${label})`, async () => {
      await corrupt(manifest)
      const res = await asOwner('/api/themes')
      expect(res.status).toBe(200)
      const list = await payload<InstalledTheme[]>(res)
      const broken = list.find((t) => t.id === 'broadsheet')!
      expect(broken.readable).toBe(false)
      expect(broken.current).toMatchObject({ name: 'broadsheet', version: '1.0.0', author: '', screenshot: '' })
      expect(list.find((t) => t.id === 'ledger')!.readable).toBe(true)
    })
  }

  it('is removed by its Remove key, and the screen draws without it', async () => {
    await corrupt('{not json')
    expect((await asOwner('/api/themes/broadsheet', { method: 'DELETE' })).status).toBe(200)
    const html = await (await asOwner('/admin/settings?tab=appearance')).text()
    expect(html).not.toContain('data-theme-cell="broadsheet"')
    expect(html).not.toContain('data-theme-broken')
  })
})
