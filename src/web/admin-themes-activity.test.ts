// What the activity log records about installed themes (ADR 0072, T2c), through the real router:
// an install with its version, a rollback with both versions, a removal, and choosing one through
// the settings save. An install that changed nothing and a refused package record nothing, and a
// request with no owner session reaches none of it.
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
import { adminT } from '@/i18n/admin-i18n'
import { logSentence } from '@/admin-shared/log-sentence'
import { MANIFEST, themeZip } from '@/theme/test-zip'

const DIR = './.tmp/test-admin-themes-activity'
const STORE = join(process.cwd(), '.tmp/test-admin-themes-activity-store')
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
const install = (zip: Uint8Array, headers: Record<string, string> = { cookie, ...SAME }) => {
  const body = new FormData()
  body.append('file', new File([zip], 'theme.zip', { type: 'application/zip' }), 'theme.zip')
  return app.request('/api/themes', { method: 'POST', body, headers })
}
const choose = (theme: string) => asOwner('/api/settings', {
  method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ theme }),
})

/** The log's theme lines, oldest first. `logActivity` is not awaited by the routes, so let it land. */
async function themeLines(): Promise<{ action: string; detail: string }[]> {
  await Bun.sleep(20)
  return db().query(`select action, detail from activity_log where action like 'theme.%' order by id`).all() as
    { action: string; detail: string }[]
}

describe('the activity log', () => {
  it('records an install with its version, and nothing for the same package again', async () => {
    expect((await install(themeZip())).status).toBe(200)
    expect((await install(themeZip())).status).toBe(200)
    expect(await themeLines()).toEqual([{ action: 'theme.install', detail: 'broadsheet 1.0.0' }])
  })

  it('records a rollback with the version left and the one current again', async () => {
    await install(themeZip())
    await install(themeZip({ 'theme.json': { ...MANIFEST, version: '1.1.0' } }))
    expect((await asOwner('/api/themes/broadsheet/rollback', { method: 'POST' })).status).toBe(200)
    expect((await themeLines()).at(-1)).toEqual({ action: 'theme.rollback', detail: 'broadsheet 1.1.0 → 1.0.0' })
  })

  it('records choosing a theme, and only when the choice moved', async () => {
    await install(themeZip())
    expect((await choose('broadsheet')).status).toBe(200)
    expect((await choose('broadsheet')).status).toBe(200)
    expect((await choose('paper')).status).toBe(200)
    const chosen = (await themeLines()).filter((l) => l.action === 'theme.choose')
    // An installed theme by the name its manifest gave it, and its id; a built-in one by its id,
    // named on the log screen in the reader's language.
    expect(chosen).toEqual([
      { action: 'theme.choose', detail: 'Broadsheet (broadsheet)' },
      { action: 'theme.choose', detail: 'paper' },
    ])
    expect(logSentence(adminT('en'), 'theme.choose', 'paper')).toBe(`Chose the theme ${adminT('en').lookPaper} (paper)`)
    expect(logSentence(adminT('de'), 'theme.choose', 'paper')).toBe(`Theme ${adminT('de').lookPaper} (paper) gewählt`)
  })

  it('records a removal', async () => {
    await install(themeZip())
    expect((await asOwner('/api/themes/broadsheet', { method: 'DELETE' })).status).toBe(200)
    expect((await themeLines()).at(-1)).toEqual({ action: 'theme.remove', detail: 'broadsheet' })
  })

  it('records nothing for a refused package, a missing theme or a request with no session', async () => {
    expect((await install(themeZip({ 'theme.css': '.prose{color:red}' }))).status).toBe(422)
    expect((await asOwner('/api/themes/broadsheet', { method: 'DELETE' })).status).toBe(404)
    expect((await asOwner('/api/themes/broadsheet/rollback', { method: 'POST' })).status).toBe(404)
    expect((await install(themeZip(), SAME)).status).toBe(401)
    expect(await themeLines()).toEqual([])
  })

  it('reads as a sentence on the log screen, in English and in German', async () => {
    for (const lang of ['en', 'de'] as const) {
      const t = adminT(lang)
      for (const action of ['theme.install', 'theme.rollback', 'theme.remove', 'theme.choose']) {
        const line = logSentence(t, action, 'broadsheet 1.0.0')
        expect(line).toContain('broadsheet 1.0.0')
        expect(line).not.toContain(action)
      }
    }
  })
})
