// The theme tools (2026-11-03): an agent writes the files, the blog's own installer judges them.
//
// What these hold, each one a promise in `tools-theme.ts`:
//  - ONE PATH. What `check_theme` accepts installs, and what it refuses comes back with the rule
//    codes and the sentences the admin shows; a refused package writes no row and no file.
//  - THE SCOPE. A read token never sees `install_theme` or `rollback_theme`; it can check.
//  - THE CEILING. The MCP body is not capped, so the tool caps the zip at the route's own number.
//  - THE OWNER'S PREVIEW. The link it hands back does nothing without the owner's session.
//  - THE ROUND TRIP. Installed is not worn; `update_appearance` wears it, the page links its sheet,
//    and `rollback_theme` puts the earlier version's sheet back.
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { existsSync, readdirSync, rmSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { freshDatabase, dropDatabase } from '@/test/db'
import { createApp } from '@/web/app'
import { db } from '@/test/sqlite'
import { createUser } from '@/auth/users'
import { COOKIE_NAME, createSession } from '@/auth/sessions'
import { resetSecretCache } from '@/auth/secret'
import { resetLimits } from '@/server/rate-limit'
import { saveSettings } from '@/content/settings'
import { savePost } from '@/content/posts'
import { clearCache } from '@/server/cache'
import { forgetInstalledTheme } from '@/content/chosen-theme'
import { payload } from '@/test/api'
import { EXAMPLE_THEME } from '@/mcp/tools-theme'
import { THEME_LIMITS } from '@/theme'
import en from '@/locales/admin/en'

const DIR = './.tmp/test-mcp-theme'
const UPLOADS = `${DIR}-uploads`
process.env.STORAGE_LOCAL_DIR = UPLOADS
freshDatabase(DIR)
const app = createApp()
let cookie = ''
const tokens: Record<'read' | 'full', string> = { read: '', full: '' }

beforeEach(async () => {
  for (const t of ['sessions', 'users', 'mcp_tokens', 'activity_log', 'settings', 'server_secrets', 'posts', 'themes']) {
    db().run(`delete from ${t}`)
  }
  rmSync(UPLOADS, { recursive: true, force: true })
  forgetInstalledTheme()
  clearCache()
  resetSecretCache()
  resetLimits()
  const user = await createUser({ username: 'hung', email: 'owner@example.com', password: 'wandering violet cassette' })
  cookie = `${COOKIE_NAME}=${createSession(user.id).token}`
  await saveSettings({ mcp: { enabled: true }, siteUrl: 'https://blog.example' })
  await savePost({ title: 'A post', slug: 'a-post', content: 'Words.', status: 'published', date: '2024-01-01T00:00:00.000Z' })
  for (const scope of ['read', 'full'] as const) {
    const res = await app.request('/api/mcp/tokens', {
      method: 'POST',
      headers: { cookie, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' },
      body: JSON.stringify({ name: `theme ${scope}`, scope }),
    })
    tokens[scope] = (await payload<{ token: string }>(res)).token
  }
})

afterAll(() => {
  delete process.env.STORAGE_LOCAL_DIR
  rmSync(UPLOADS, { recursive: true, force: true })
  dropDatabase(DIR)
})

const rpc = async (scope: 'read' | 'full', method: string, params: unknown) => {
  const res = await app.request('/api/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${tokens[scope]}`, 'sec-fetch-site': 'none' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  return await res.json() as { result?: { tools?: { name: string }[]; content?: { text: string }[]; isError?: boolean } }
}

const call = async (name: string, args: Record<string, unknown> = {}, scope: 'read' | 'full' = 'full') => {
  const r = (await rpc(scope, 'tools/call', { name, arguments: args })).result
  const text = r?.content?.[0]?.text ?? ''
  let json: Record<string, unknown> = {}
  try { json = JSON.parse(text) as Record<string, unknown> } catch { /* an error sentence */ }
  return { text, json, isError: r?.isError ?? false }
}

const filesOf = (over: Record<string, string> = {}) =>
  Object.entries({ ...EXAMPLE_THEME, ...over }).map(([path, text]) => ({ path, text }))

const version = (v: string) => JSON.stringify({ ...JSON.parse(EXAMPLE_THEME['theme.json']), version: v })

const themeRows = (): number => (db().query('select count(*) as n from themes').get() as { n: number }).n
const storedThemeFiles = (): string[] => (existsSync(`${UPLOADS}/themes`) ? readdirSync(`${UPLOADS}/themes`, { recursive: true }).map(String) : [])

const home = async (): Promise<string> => {
  clearCache()
  return await (await app.request('/')).text()
}

describe('the scope', () => {
  it('a read token sees the guide, the list, the checker and the preview, and not the two writes', async () => {
    const names = ((await rpc('read', 'tools/list', {})).result?.tools ?? []).map((t) => t.name)
    for (const n of ['get_theme_guide', 'list_themes', 'check_theme', 'preview_theme']) expect(`${n}: ${names.includes(n)}`).toBe(`${n}: true`)
    for (const n of ['install_theme', 'rollback_theme']) expect(`${n}: ${names.includes(n)}`).toBe(`${n}: false`)
  })

  it('and calling them anyway is refused with nothing written', async () => {
    for (const [name, args] of [['install_theme', { files: filesOf() }], ['rollback_theme', { id: 'warm-paper' }]] as const) {
      const out = await call(name, args, 'read')
      expect(`${name}: ${out.isError}`).toBe(`${name}: true`)
      expect(out.text).toContain('not found')
    }
    expect(themeRows()).toBe(0)
  })
})

describe('one path: the installer judges', () => {
  it('the guide example passes the checker, with a blank tile added for the missing screenshot', async () => {
    const out = await call('check_theme', { files: filesOf() }, 'read')
    expect(out.json).toMatchObject({ ok: true, id: 'warm-paper', version: '1.0.0', placeholderScreenshot: true })
    expect(themeRows()).toBe(0) // checking writes nothing
  })

  it('a refused package comes back as the checker\'s findings with the admin\'s sentences, and writes nothing', async () => {
    const css = '.prose{color:#ff0000 !important}\n@import url(https://evil.example/x.css);\n.fc-title{color:var(--c-heading)}\n'
    for (const tool of ['check_theme', 'install_theme']) {
      const out = await call(tool, { files: filesOf({ 'theme.css': css }) })
      const findings = out.json.findings as { rule: string; file: string; line?: number; why: string }[]
      expect(out.json.ok).toBe(false)
      const rules = new Set(findings.map((f) => f.rule))
      for (const r of ['C1', 'P1', 'A1']) expect(`${tool} ${r}: ${rules.has(r)}`).toBe(`${tool} ${r}: true`)
      for (const f of findings) expect(f.why).toBe((en.themeRules as Record<string, string>)[f.rule])
      expect(findings.find((f) => f.rule === 'C1')).toMatchObject({ file: 'theme.css', line: 1 })
    }
    expect(themeRows()).toBe(0)
    expect(storedThemeFiles()).toEqual([])
  })

  it('a zip past the route\'s ceiling is refused before the checker, as A5, and writes nothing', async () => {
    // Random bytes do not deflate, so six of these make a zip past 5 MB while staying under the
    // 10 MB the package may expand to.
    const big = Array.from({ length: 6 }, (_, i) => ({ path: `images/noise-${i}.png`, base64: randomBytes(THEME_LIMITS.imageBytes - 1024).toString('base64') }))
    const out = await call('install_theme', { files: [...filesOf(), ...big] })
    expect(out.json.ok).toBe(false)
    expect((out.json.findings as { rule: string; subject: string }[])[0]).toMatchObject({ rule: 'A5' })
    expect(String((out.json.findings as { subject: string }[])[0]!.subject)).toContain(String(THEME_LIMITS.zipBytes))
    expect(themeRows()).toBe(0)
    expect(storedThemeFiles()).toEqual([])
  })
})

describe('the owner\'s preview', () => {
  it('hands back a link that works only with the owner\'s session', async () => {
    expect((await call('install_theme', { files: filesOf() })).json.ok).toBe(true)
    const out = await call('preview_theme', { id: 'warm-paper' }, 'read')
    const url = new URL(String(out.json.url))
    expect(url.origin).toBe('https://blog.example')
    const stranger = await app.request(url.pathname)
    expect(stranger.headers.get('set-cookie') ?? '').not.toContain('warm-paper')
    expect([401, 403, 302, 303]).toContain(stranger.status)
    expect(stranger.headers.get('location') ?? '').not.toContain('theme-preview')
    const owner = await app.request(url.pathname, { headers: { cookie } })
    expect(owner.status).toBe(303)
    expect(owner.headers.get('location')).toContain('theme-preview=warm-paper')
  })

  it('refuses an id the site cannot draw', async () => {
    expect((await call('preview_theme', { id: 'no-such-theme' })).isError).toBe(true)
  })
})

describe('from files to the page and back', () => {
  it('installed is not worn; update_appearance wears it; rollback_theme brings the earlier sheet back', async () => {
    const v1 = await call('install_theme', { files: filesOf() })
    expect(v1.json).toMatchObject({ ok: true, installed: true, id: 'warm-paper', version: '1.0.0', changed: true })
    const listed = await call('list_themes', {}, 'read')
    expect(listed.json.installed).toEqual([{ id: 'warm-paper', name: 'Warm paper', version: '1.0.0', active: false, readable: true, previous: [] }])

    const hashOf = (version: string) => (db().query('select hash from themes where version = ? and deleted_at is null').get(version) as { hash: string } | null)?.hash
    const h1 = hashOf('1.0.0')!
    expect(await home()).not.toContain(`/themes/${h1}/`) // installed, not worn

    expect((await call('update_appearance', { theme: 'warm-paper' })).isError).toBe(false)
    expect(await home()).toContain(`/themes/${h1}/theme.css`)

    const css2 = EXAMPLE_THEME['theme.css'].replace('0.25em', '0.5em')
    const v2 = await call('install_theme', { files: filesOf({ 'theme.json': version('1.0.1'), 'theme.css': css2 }) })
    expect(v2.json).toMatchObject({ ok: true, version: '1.0.1' })
    const h2 = hashOf('1.0.1')!
    expect(await home()).toContain(`/themes/${h2}/theme.css`)

    const back = await call('rollback_theme', { id: 'warm-paper' })
    expect(back.json).toEqual({ id: 'warm-paper', current: '1.0.0', removed: '1.0.1' })
    const page = await home()
    expect(page).toContain(`/themes/${h1}/theme.css`)
    expect(page).not.toContain(`/themes/${h2}/`)

    expect((await call('rollback_theme', { id: 'warm-paper' })).text).toContain('no earlier version')
    const log = db().query(`select action from activity_log where action like 'theme.%' order by id`).all() as { action: string }[]
    expect(log.map((r) => r.action)).toEqual(['theme.install', 'theme.choose', 'theme.install', 'theme.rollback'])
  })
})
