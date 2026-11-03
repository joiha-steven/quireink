// A theme zip read and judged (`read-package.ts`): the honest package, and one hostile package per
// way in. Several hostile ones carry entry bytes that are NOT valid deflate, so a refusal for the
// name or the declared size, rather than `corrupt_entry`, proves the refusal came before anything
// was inflated.
import { describe, expect, it } from 'bun:test'
import { deflateRawSync } from 'node:zlib'
import { themeContract } from '@/content/theme-contract'
import { readThemePackage, THEME_LIMITS, type PackageOptions, type Violation } from '@/theme'
import { CSS, FONT, MANIFEST, SCREENSHOT, testZip, themeFiles, themeZip, type TestEntry } from '@/theme/test-zip'

const OPTS: PackageOptions = {
  supportedApi: [1],
  reservedIds: new Set(['plain', 'code', 'paper', 'notes']),
  reservedPaletteIds: new Set(['mono']),
  reservedFontIds: new Set(['inter']),
  contract: themeContract(),
}
const read = (zip: Uint8Array) => readThemePackage(zip, OPTS)
const refusals = async (zip: Uint8Array): Promise<string[]> => {
  const r = await read(zip)
  if (r.ok) throw new Error('the package was accepted')
  return r.violations.map((v: Violation) => `${v.rule} ${v.file} ${v.subject}`)
}
/** Bytes no inflater accepts: a deflate block type of 3 is reserved. */
const NOT_DEFLATE = new Uint8Array([0xff, 0xff, 0xff, 0xff])
const garbage = (name: string, declaredSize: number): TestEntry =>
  ({ name, data: new Uint8Array(1), declaredSize, deflate: true, rawData: NOT_DEFLATE })

describe('an honest package', () => {
  it('is read whole: every file, its type, the manifest as checked', async () => {
    const r = await read(themeZip())
    if (!r.ok) throw new Error(JSON.stringify(r.violations))
    expect(r.pkg.manifest).toEqual(MANIFEST)
    expect(r.pkg.files.map((f) => `${f.path} ${f.type}`)).toEqual([
      'fonts/body.woff2 font/woff2', 'images/grain.svg image/svg+xml', 'screenshot.webp image/webp',
      'theme.css text/css; charset=utf-8', 'theme.json application/json; charset=utf-8',
    ])
    expect(new TextDecoder().decode(r.pkg.files.find((f) => f.path === 'theme.css')!.bytes)).toBe(CSS)
    expect(r.pkg.hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('has the same hash zipped again another way, and another hash when one byte differs', async () => {
    const a = await read(themeZip())
    const stored = await read(testZip([...themeFiles()].reverse().map((e) => ({ ...e, deflate: false }))))
    const changed = await read(themeZip({ 'theme.css': `${CSS}\n` }))
    if (!a.ok || !stored.ok || !changed.ok) throw new Error('refused')
    expect(stored.pkg.hash).toBe(a.pkg.hash)
    expect(changed.pkg.hash).not.toBe(a.pkg.hash)
  })
})

describe('refused before anything is inflated', () => {
  it('a name that climbs out (A3)', async () => {
    expect(await refusals(testZip([...themeFiles(), garbage('../../etc/cron.d/x', 10)]))).toEqual(['A3 ../../etc/cron.d/x ../../etc/cron.d/x'])
    expect(await refusals(testZip([...themeFiles(), garbage('images/../../x.png', 10)]))).toEqual(['A3 images/../../x.png images/../../x.png'])
  })

  it('an absolute name, a backslash, a drive letter (A3)', async () => {
    for (const name of ['/etc/passwd', 'images\\..\\x.png', 'C:/x.png']) {
      expect((await refusals(testZip([...themeFiles(), garbage(name, 10)])))[0]).toStartWith('A3 ')
    }
  })

  it('a symlink (A3)', async () => {
    const link: TestEntry = { name: 'images/link.svg', data: new TextEncoder().encode('/etc/passwd'), symlink: true, rawData: NOT_DEFLATE, deflate: true }
    expect(await refusals(testZip([...themeFiles(), link]))).toContain('A3 images/link.svg images/link.svg')
  })

  it('a declared total past the ceiling, one file at a time within it (A5)', async () => {
    const big = Array.from({ length: 11 }, (_, i) => garbage(`images/p${i}.png`, THEME_LIMITS.imageBytes))
    expect(await refusals(testZip([...themeFiles(), ...big]))).toEqual([`A5  ${11 * THEME_LIMITS.imageBytes + 64 + 64 + 92 + 102 + CSS.length}`])
  })

  it('one file declared past its own ceiling (A5)', async () => {
    const found = await refusals(testZip([...themeFiles(), garbage('images/huge.png', 50 * 1024 * 1024)]))
    expect(found).toContain(`A5 images/huge.png ${50 * 1024 * 1024}`)
    expect(found.every((v) => v.startsWith('A5 '))).toBe(true)
  })

  it('more entries than a package may hold (A3)', async () => {
    const many = Array.from({ length: THEME_LIMITS.files }, (_, i) => garbage(`images/p${i}.png`, 10))
    expect(await refusals(testZip([...themeFiles(), ...many]))).toEqual([`A3  ${THEME_LIMITS.files + 5}`])
  })

  it('a zip larger than 5 MB, before even its directory is read (A5)', async () => {
    expect(await refusals(new Uint8Array(THEME_LIMITS.zipBytes + 1))).toEqual([`A5  ${THEME_LIMITS.zipBytes + 1}`])
  })

  it('bytes that are not a zip at all (A3)', async () => {
    expect(await refusals(new TextEncoder().encode('<html>not a zip</html>'))).toEqual(['A3  not_a_zip'])
  })

  it('a missing theme.json (A3)', async () => {
    expect(await refusals(themeZip({ 'theme.json': null }))).toEqual(['A3 theme.json missing'])
  })
})

describe('a bomb', () => {
  const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  const zeros = (n: number) => { const b = new Uint8Array(n); b.set(PNG); return b }

  it('declaring a small size and inflating to 20 MB is stopped at the ceiling, not after (A5)', async () => {
    const data = zeros(20 * 1024 * 1024)
    const zip = testZip([...themeFiles(), { name: 'images/bomb.png', data, deflate: true, declaredSize: 100 }])
    expect(zip.length).toBeLessThan(64 * 1024)
    expect(await refusals(zip)).toEqual(['A5  expands past the limit'])
  })

  it('declaring less than it holds, under every ceiling, is a lying record (A5)', async () => {
    const zip = testZip([...themeFiles(), { name: 'images/liar.png', data: zeros(500_000), deflate: true, declaredSize: 100 }])
    expect(await refusals(zip)).toEqual(['A5 images/liar.png 500000'])
  })

  it('stays small in the zip itself', () => {
    expect(deflateRawSync(zeros(20 * 1024 * 1024)).length).toBeLessThan(64 * 1024)
  })
})

describe('refused for what is inside', () => {
  it('an SVG with a script (A4)', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
    expect((await refusals(themeZip({ 'images/grain.svg': svg })))[0]).toStartWith('A4 images/grain.svg')
  })

  it('a stylesheet that calls out, or imports (A2, A1)', async () => {
    expect((await refusals(themeZip({ 'theme.css': `${CSS}\n.prose{background:url(https://evil.example/x.png)}` }))).map((v) => v.slice(0, 2))).toContain('A2')
    expect((await refusals(themeZip({ 'theme.css': `@import url(other.css);\n${CSS}` }))).map((v) => v.slice(0, 2))).toContain('A1')
  })

  it('an id a built-in theme has (A6)', async () => {
    expect(await refusals(themeZip({ 'theme.json': { ...MANIFEST, id: 'paper' } }))).toEqual(['A6 theme.json id'])
  })

  it('theme.json that is not JSON (A6)', async () => {
    expect(await refusals(themeZip({ 'theme.json': '{"api": 1,' }))).toEqual(['A6 theme.json not json'])
  })

  it('a font that is not one (A3)', async () => {
    expect((await refusals(themeZip({ 'fonts/body.woff2': SCREENSHOT })))[0]).toStartWith('A3 fonts/body.woff2')
    expect(FONT.length).toBe(64)
  })
})

// What Finder and Explorer make by default (measured 2026-11-03): the folder zipped rather than its
// contents, and, on macOS 15 and later, a `__MACOSX/._<name>` copy of every file plus `.DS_Store`.
describe('what the operating system adds, and one folder around the package', () => {
  const inFolder = (folder: string, entries = themeFiles()): TestEntry[] =>
    [{ name: `${folder}/`, data: new Uint8Array(0) }, ...entries.map((e) => ({ ...e, name: `${folder}/${e.name}` }))]
  const appleDouble = (names: readonly string[]): TestEntry[] =>
    [{ name: '__MACOSX/', data: new Uint8Array(0) }, ...names.map((n) => ({ name: `__MACOSX/${n.replace(/([^/]+)$/, '._$1')}`, data: new Uint8Array(163) }))]

  it('reads a Finder zip of the folder: the folder taken off, __MACOSX and .DS_Store left out and named', async () => {
    const files = themeFiles()
    const finder = [...inFolder('My Theme', files), ...appleDouble(files.map((f) => `My Theme/${f.name}`)),
      { name: 'My Theme/.DS_Store', data: new Uint8Array(8) }, { name: 'My Theme/fonts/.DS_Store', data: new Uint8Array(8) }]
    const r = await read(testZip(finder))
    const clean = await read(themeZip())
    if (!r.ok || !clean.ok) throw new Error(JSON.stringify(r))
    // The same package, to the byte: the same hash as the zip made the documented way.
    expect(r.pkg.hash).toBe(clean.pkg.hash)
    expect(r.pkg.files.map((f) => f.path)).toEqual(clean.pkg.files.map((f) => f.path))
    expect(r.folder).toBe('My Theme')
    expect(r.skipped).toHaveLength(files.length + 2)
    expect(r.skipped).toContain('My Theme/fonts/.DS_Store')
    expect(clean.skipped).toBeUndefined()
    expect(clean.folder).toBeUndefined()
  })

  it('reads a Finder zip of the contents, Thumbs.db and desktop.ini in any case left out too', async () => {
    const files = themeFiles()
    const r = await read(testZip([...files, ...appleDouble(files.map((f) => f.name)),
      { name: 'THUMBS.DB', data: new Uint8Array(4) }, { name: 'fonts/Desktop.ini', data: new Uint8Array(4) }]))
    if (!r.ok) throw new Error(JSON.stringify(r.violations))
    expect(r.folder).toBeUndefined()
    expect(r.skipped).toHaveLength(files.length + 2)
  })

  it('never inflates what it leaves out: an entry of the operating system\'s that is not deflate at all does not matter', async () => {
    const r = await read(testZip([...themeFiles(), garbage('__MACOSX/._theme.css', 4096), garbage('fonts/.DS_Store', 6148)]))
    expect(r.ok).toBe(true)
  })

  it('still counts what it leaves out against the package\'s ceiling', async () => {
    const big = { name: '__MACOSX/._screenshot.webp', data: new Uint8Array(THEME_LIMITS.totalBytes), deflate: true }
    const r = await read(testZip([...themeFiles(), big]))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.violations.map((v) => v.rule)).toContain('A5')
    expect(r.skipped).toEqual(['__MACOSX/._screenshot.webp'])
  })

  it('still refuses any other hidden file: nobody\'s operating system wrote .htaccess', async () => {
    expect(await refusals(themeZip({ '.htaccess': 'x' }))).toEqual(['A3 .htaccess .htaccess'])
  })

  it('takes off only ONE folder, and only one that holds theme.json itself', async () => {
    // Two levels down, two folders at the top, a folder whose theme.json is one level further in.
    const deep = await refusals(testZip(inFolder('a', inFolder('b'))))
    expect(deep).toContain('A3 theme.json missing')
    expect(deep).toContain('A3 a/b/theme.json a/b/theme.json')
    const two = await refusals(testZip([...inFolder('a'), ...inFolder('b')]))
    expect(two).toContain('A3 a/theme.json a/theme.json')
    expect((await read(testZip([...inFolder('a'), { name: 'loose.css', data: new Uint8Array(1) }]))).ok).toBe(false)
  })

  it('judges every path after the folder is taken off: no .. or rooted name gets in through it', async () => {
    const files = themeFiles()
    // A `..` hidden behind the folder comes out as `../x` and is refused as one.
    const behind = await refusals(testZip([...inFolder('t', files), { name: 't/../evil.css', data: new Uint8Array(1) }]))
    expect(behind).toContain('A3 ../evil.css ../evil.css')
    // A folder that is itself `..`, `.`, rooted, a drive or a backslashed name is never taken off.
    for (const folder of ['..', '.', '', 'C:', 'a\\..']) {
      const r = await read(testZip(files.map((e) => ({ ...e, name: `${folder}/${e.name}` }))))
      expect(r.ok, folder).toBe(false)
      expect(r.folder, folder).toBeUndefined()
    }
  })
})
