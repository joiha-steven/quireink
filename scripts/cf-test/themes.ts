// A theme installed from a zip inside workerd (ADR 0072, T2), for `bun run test:cf`.
//
// The installer reads the zip with `node:zlib` (inflate and CRC-32) and hashes it with
// `node:crypto`, writes the files to R2 and the row to the Durable Object's SQLite, and the public
// route reads them back. Bun's side of the same story is `src/web/admin-themes.test.ts`; this asks
// the one runtime it cannot: whether those modules behave the same in a Worker, and whether a
// refused package leaves the bucket as it found it.
import { Hono } from 'hono'
import { liveOnly, openDatabases } from '@/store/db'
import { all } from '@/store/query'
import { installTheme, rollbackTheme } from '@/content/installed-themes'
import { handleThemeFile } from '@/web/theme-files'
import { list } from '@/runtime/cf/blob'
import { CSS, FONT, MANIFEST, testZip, themeFiles, themeZip } from '@/theme/test-zip'
import { createApp } from '@/web/app'
import { createUser } from '@/auth/users'
import { COOKIE_NAME, createSession } from '@/auth/sessions'
import { savePost } from '@/content/posts'

export async function themeInstallsHere(): Promise<void> {
  openDatabases('./data')
  const app = new Hono().get('/themes/:hash/*', handleThemeFile)

  const refused = await installTheme(testZip([...themeFiles(), { name: '../escape.png', data: new Uint8Array(8) }]))
  if (refused.ok || refused.violations[0]?.rule !== 'A3') throw new Error(`a zip with .. was not refused for its path: ${JSON.stringify(refused)}`)
  if ((await list('themes')).length !== 0) throw new Error('a refused package wrote to the bucket')

  const v1 = await installTheme(themeZip())
  if (!v1.ok || !v1.changed) throw new Error(`the package was not installed: ${JSON.stringify(v1)}`)
  const again = await installTheme(themeZip())
  if (!again.ok || again.changed || again.hash !== v1.hash) throw new Error(`installing it again changed something: ${JSON.stringify(again)}`)
  const keys = (await list('themes')).map((o) => o.pathname).sort()
  if (keys.length !== 5 || !keys.every((k) => k.startsWith(`themes/${v1.hash}/`))) throw new Error(`the bucket holds ${JSON.stringify(keys)}`)

  const v2 = await installTheme(themeZip({ 'theme.json': { ...MANIFEST, version: '1.1.0' } }))
  if (!v2.ok) throw new Error('the second version was refused')
  const back = rollbackTheme('broadsheet')
  if (!back.ok || back.current.version !== '1.0.0') throw new Error(`rollback: ${JSON.stringify(back)}`)
  const live = all<{ version: string }>(`select version from themes where ${liveOnly('themes')}`)
  if (live.length !== 1 || live[0]!.version !== '1.0.0') throw new Error(`live rows after the rollback: ${JSON.stringify(live)}`)

  const css = await app.request(`/themes/${v1.hash}/theme.css`)
  const body = await css.text()
  if (css.status !== 200 || body !== `@layer theme{${CSS}}` || css.headers.get('cache-control') !== 'public, max-age=31536000, immutable') {
    throw new Error(`the sheet came back ${css.status} ${css.headers.get('cache-control')}: ${body.slice(0, 80)}`)
  }
  const font = await app.request(`/themes/${v2.hash}/fonts/body.woff2`)
  const bytes = new Uint8Array(await font.arrayBuffer())
  if (font.status !== 200 || bytes.length !== FONT.length || !bytes.every((b, i) => b === FONT[i])) {
    throw new Error(`the rolled-back version's font came back ${font.status}, ${bytes.length} bytes`)
  }
  const svg = await app.request(`/themes/${v1.hash}/images/grain.svg`)
  if (!(svg.headers.get('content-security-policy') ?? '').includes('sandbox')) throw new Error('the SVG went out without its sandbox')
  if ((await app.request(`/themes/${v1.hash}/planted.css`)).status !== 404) throw new Error('a path the package did not list was answered')
}

/**
 * The page a reader gets, through the whole app in the Durable Object (T2b): the owner installs the
 * theme and chooses it through the gated routes, the next render links its sheet and names it; a
 * second version is linked on the render after it; removed, the page is plain and still a 200. What
 * this asks of workerd and not of Bun: that the version the renderer keeps is forgotten by the
 * gate's flush inside the object, as it is in the Bun process.
 */
export async function themeRendersHere(): Promise<void> {
  openDatabases('./data')
  const app = createApp()
  const user = await createUser({ username: 'owner', email: 'o@example.com', password: 'wandering violet cassette' })
  const headers = { cookie: `${COOKIE_NAME}=${createSession(user.id).token}`, 'sec-fetch-site': 'same-origin' }
  await savePost({ title: 'A post', slug: 'a-post', status: 'published', date: '2025-06-01T12:00:00.000Z', content: 'Words.' })
  const install = async (zip: Uint8Array): Promise<string> => {
    const form = new FormData()
    form.append('file', new File([zip], 'theme.zip', { type: 'application/zip' }), 'theme.zip')
    const res = await app.request('/api/themes', { method: 'POST', headers, body: form })
    const out = await res.json() as { data?: { hash?: string } }
    if (res.status !== 200 || !out.data?.hash) throw new Error(`the install answered ${res.status}: ${JSON.stringify(out)}`)
    return out.data.hash
  }
  const home = async (): Promise<string> => {
    const res = await app.request('/a-post')
    if (res.status !== 200) throw new Error(`the post answered ${res.status}`)
    return res.text()
  }
  const link = (hash: string) => `<link rel="stylesheet" href="/themes/${hash}/theme.css">`

  const v1 = await install(themeZip())
  if ((await home()).includes('/themes/')) throw new Error('a theme nobody chose was linked')
  const chose = await app.request('/api/settings', {
    method: 'PUT', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ theme: 'broadsheet' }),
  })
  if (chose.status !== 200) throw new Error(`choosing the theme answered ${chose.status}`)
  const worn = await home()
  if (!worn.includes(link(v1)) || !worn.includes(' data-theme="broadsheet"')) throw new Error('the chosen theme is not on the page')

  // A preview (T2c) inside the object: the owner sees Newspaper with the bar and nothing a cache may
  // keep; the same cookie without the session is the reader's page; and the page cache still holds
  // the reader's page after it, because the scope the preview renders in is the request's own.
  const enter = await app.request('/api/themes/paper/preview', { headers })
  const previewCookie = (enter.headers.get('set-cookie') ?? '').split(';')[0] ?? ''
  if (enter.status !== 303 || !previewCookie.endsWith('=paper')) throw new Error(`Preview answered ${enter.status} ${previewCookie}`)
  const seen = await app.request('/a-post', { headers: { cookie: `${headers.cookie}; ${previewCookie}` } })
  const seenHtml = await seen.text()
  if (!seenHtml.includes(' data-theme="paper"') || !seenHtml.includes('data-theme-preview="paper"') || seen.headers.get('cache-control') !== 'private, no-store') {
    throw new Error(`the owner's preview is not Newspaper with the bar, private: ${seen.headers.get('cache-control')}`)
  }
  const stranger = await (await app.request('/a-post', { headers: { cookie: previewCookie } })).text()
  if (stranger.includes('theme-preview') || stranger !== worn) throw new Error('a reader carrying the preview cookie was not given the reader\'s page')

  const v2 = await install(themeZip({ 'theme.json': { ...MANIFEST, version: '1.1.0' } }))
  const next = await home()
  if (!next.includes(link(v2)) || next.includes(link(v1))) throw new Error('the page still links the version before')

  const removed = await app.request('/api/themes/broadsheet', { method: 'DELETE', headers })
  if (removed.status !== 200) throw new Error(`the removal answered ${removed.status}`)
  const plain = await home()
  if (plain.includes('/themes/') || !plain.includes(' data-theme="plain"')) throw new Error('the page is not plain after the removal')
}
