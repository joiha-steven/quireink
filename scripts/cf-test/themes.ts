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
