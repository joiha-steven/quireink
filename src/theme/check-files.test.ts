// The package's entries: paths that cannot escape or collide, content that is the type its
// name says (A3), and the size ceilings (A5). SVG content (A4) is in check-svg.test.ts.
import { describe, expect, it } from 'bun:test'
import { checkThemeFiles, type ThemeFileEntry } from '@/theme/check-files'
import { decodeThemeText } from '@/theme/file-content'
import { THEME_LIMITS } from '@/theme/types'

const ascii = (t: string) => Array.from(t, (c) => c.charCodeAt(0))
const u24 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255]
const sized = (head: number[], length = 64) => {
  const bytes = new Uint8Array(Math.max(length, head.length))
  bytes.set(head)
  return bytes
}
/** A WebP whose first chunk is VP8X, declaring a canvas of `w` by `h`. */
const webpX = (w: number, h: number) =>
  sized([...ascii('RIFF'), 22, 0, 0, 0, ...ascii('WEBPVP8X'), 10, 0, 0, 0, 0, 0, 0, 0, ...u24(w - 1), ...u24(h - 1)])
const text = (t: string) => new TextEncoder().encode(t)
const file = (path: string, bytes: Uint8Array, size = bytes.length): ThemeFileEntry => ({ path, size, bytes })

const SIGNATURE: Record<string, number[]> = {
  woff2: ascii('wOF2'),
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  jpg: [0xff, 0xd8, 0xff, 0xe0],
  jpeg: [0xff, 0xd8, 0xff, 0xdb],
  webp: [...ascii('RIFF'), 1, 0, 0, 0, ...ascii('WEBP')],
  avif: [0, 0, 0, 24, ...ascii('ftypavif'), 0, 0, 0, 0, ...ascii('mif1miaf')],
}
/** A file of `path`'s type: the right signature, `size` bytes. */
const typed = (path: string, size = 64) => file(path, sized(SIGNATURE[path.slice(path.lastIndexOf('.') + 1)]!, size))

const BASE: ThemeFileEntry[] = [
  file('theme.json', text('{"api":1}')),
  file('theme.css', text('.post{}')),
  file('screenshot.webp', webpX(1200, 900)),
]
const run = (...extra: ThemeFileEntry[]) =>
  checkThemeFiles([...BASE, ...extra]).map((v) => `${v.rule} ${v.file} ${v.subject}`)

describe('A3: package paths', () => {
  it('accepts the required files, fonts, every image type and directory entries', () => {
    expect(run(
      { path: 'fonts/', size: 0 }, { path: 'images/', size: 0 },
      typed('fonts/body-400.woff2'),
      ...['webp', 'png', 'jpg', 'jpeg', 'avif'].map((ext) => typed(`images/a.${ext}`)),
    )).toEqual([])
  })

  it('refuses each missing required file by name', () => {
    expect(checkThemeFiles([BASE[1]!]).map((v) => `${v.rule} ${v.subject}`)).toEqual(['A3 theme.json', 'A3 screenshot.webp'])
  })

  it('refuses climbing, rooted, backslashed, drive-lettered and NUL paths', () => {
    for (const path of ['a/../theme.css', '../theme.css', '/theme.css', '\\theme.css', 'images\\a.png', 'C:/x', 'C:x.png', 'images/a.png\0.svg', 'images/./a.png']) {
      expect(run(typed('images/a.png'), { ...typed('images/a.png'), path })).toEqual([`A3 ${path} ${path}`])
    }
  })

  it('refuses files the standard does not list, and the right type in the wrong place', () => {
    for (const path of ['README.md', 'theme.js', 'images/x.gif', 'fonts/x.ttf', 'fonts/sub/x.woff2', 'images/a b.png', 'images/.hidden.png', 'x.woff2']) {
      expect(run({ path, size: 1, bytes: new Uint8Array(1) })).toEqual([`A3 ${path} ${path}`])
    }
  })

  it('refuses a symlink, even under an allowed name', () => {
    expect(run({ ...typed('images/a.png'), isSymlink: true })).toEqual(['A3 images/a.png images/a.png'])
  })

  it('refuses a directory entry that climbs, while not counting directories as files', () => {
    expect(run({ path: '../', size: 0 })).toEqual(['A3 ../ ../'])
  })

  it('refuses a name twice, and two names that differ only in case', () => {
    expect(run(typed('images/a.png'), typed('images/a.png'))).toEqual(['A3 images/a.png images/a.png'])
    expect(run(typed('images/A.png'), typed('images/a.png'))).toEqual(['A3 images/a.png images/a.png'])
  })

  it('accepts 64 files and refuses 65', () => {
    const images = (n: number) => Array.from({ length: n }, (_, i) => typed(`images/i${i}.png`))
    expect(run(...images(61))).toEqual([])
    expect(run(...images(62))).toEqual(['A3  65'])
  })
})

describe('A3: content is the type its name says', () => {
  it('refuses bytes of another type, quoting the first bytes', () => {
    expect(run(file('fonts/a.woff2', sized(ascii('wOFF'), 12)))).toEqual(['A3 fonts/a.woff2 774f46460000000000000000'])
    expect(run(file('images/a.png', sized(ascii('<svg onload'), 12)))).toEqual(['A3 images/a.png 3c737667206f6e6c6f616400'])
    expect(run(file('images/a.jpg', sized([0xff, 0xd8, 0x00], 12)))).toEqual(['A3 images/a.jpg ffd800000000000000000000'])
    expect(run(file('images/a.webp', sized([...ascii('RIFF'), 1, 0, 0, 0, ...ascii('WAVE')])))).toHaveLength(1)
    expect(run(file('images/a.avif', sized([0, 0, 0, 24, ...ascii('ftypheic'), 0, 0, 0, 0, ...ascii('mif1miaf')])))).toHaveLength(1)
  })

  it('accepts avif named only as a compatible brand', () => {
    expect(run(file('images/a.avif', sized([0, 0, 0, 20, ...ascii('ftypmif1'), 0, 0, 0, 0, ...ascii('avis')])))).toEqual([])
  })

  it('refuses an entry without bytes, of every type', () => {
    for (const path of ['fonts/a.woff2', 'images/a.png', 'images/a.svg']) expect(run({ path, size: 10 })).toEqual([`A3 ${path} no bytes`])
    expect(checkThemeFiles([BASE[0]!, { path: 'theme.css', size: 7 }, BASE[2]!]).map((v) => v.subject)).toEqual(['no bytes'])
  })

  it('requires the screenshot at 1200 by 900, read from a VP8X, VP8 or VP8L header', () => {
    const vp8 = (w: number, h: number) =>
      sized([...ascii('RIFF'), 1, 0, 0, 0, ...ascii('WEBPVP8 '), 10, 0, 0, 0, 0, 0, 0, 0x9d, 0x01, 0x2a, w & 255, w >> 8, h & 255, h >> 8])
    const vp8l = (w: number, h: number) => {
      const bits = (w - 1) | ((h - 1) << 14)
      return sized([...ascii('RIFF'), 1, 0, 0, 0, ...ascii('WEBPVP8L'), 5, 0, 0, 0, 0x2f, bits & 255, (bits >> 8) & 255, (bits >> 16) & 255, (bits >>> 24) & 255])
    }
    const shot = (bytes: Uint8Array) => checkThemeFiles([BASE[0]!, BASE[1]!, file('screenshot.webp', bytes)]).map((v) => `${v.rule} ${v.subject}`)
    expect(shot(vp8(1200, 900))).toEqual([])
    expect(shot(vp8l(1200, 900))).toEqual([])
    expect(shot(webpX(1200, 901))).toEqual(['A3 1200x901'])
    expect(shot(vp8(800, 600))).toEqual(['A3 800x600'])
    expect(shot(vp8l(1199, 900))).toEqual(['A3 1199x900'])
    expect(shot(sized(SIGNATURE.png!))).toEqual(['A3 89504e470d0a1a0a00000000'])
  })
})

describe('A3: theme.css and theme.json decode one way only', () => {
  // The review's input: FF FE, then a comment opener, then UTF-16LE rules. Read leniently as
  // UTF-8 it is one comment; a browser honours the BOM and applies the rules.
  const le = (t: string) => Array.from(t).flatMap((c) => [c.charCodeAt(0) & 255, c.charCodeAt(0) >> 8])
  const bomCss = new Uint8Array([0xff, 0xfe, ...ascii('/*'), ...le('{}\nbody{color:red !important}\n/*'), ...ascii('*/\n.post{}\n.fc{}\n')])

  it('refuses a UTF-16 stylesheet hiding behind a byte order mark', () => {
    expect(checkThemeFiles([BASE[0]!, file('theme.css', bomCss), BASE[2]!]).map((v) => `${v.rule} ${v.file} ${v.subject}`))
      .toEqual(['A3 theme.css UTF-16 BOM'])
  })

  it('refuses every BOM, invalid UTF-8 and NUL, in either text file', () => {
    expect(decodeThemeText(new Uint8Array([0xfe, 0xff, 0, 0x2e]))).toMatchObject({ rule: 'A3', subject: 'UTF-16 BOM' })
    expect(decodeThemeText(new Uint8Array([0xef, 0xbb, 0xbf, 0x2e]))).toMatchObject({ subject: 'UTF-8 BOM' })
    expect(decodeThemeText(new Uint8Array([0x2e, 0xc3, 0x28]))).toMatchObject({ subject: 'not utf-8' })
    expect(decodeThemeText(text('a\0b'), 'theme.json')).toMatchObject({ file: 'theme.json', subject: 'NUL' })
    expect(checkThemeFiles([file('theme.json', new Uint8Array([0xef, 0xbb, 0xbf, 0x7b, 0x7d])), BASE[1]!, BASE[2]!]).map((v) => v.subject))
      .toEqual(['UTF-8 BOM'])
  })

  it('returns plain UTF-8 as its text', () => {
    expect(decodeThemeText(text('.post{content:"\u2192"}'))).toBe('.post{content:"\u2192"}')
  })
})

describe('A5: sizes', () => {
  it('accepts each file at its ceiling and refuses one byte over', () => {
    expect(run(typed('fonts/a.woff2', THEME_LIMITS.fontBytes), typed('images/a.png', THEME_LIMITS.imageBytes))).toEqual([])
    expect(run(typed('fonts/a.woff2', THEME_LIMITS.fontBytes + 1))).toEqual(['A5 fonts/a.woff2 409601'])
    expect(run(typed('images/a.png', THEME_LIMITS.imageBytes + 1))).toEqual(['A5 images/a.png 1048577'])
    expect(checkThemeFiles([BASE[0]!, BASE[1]!, file('screenshot.webp', webpX(1200, 900), THEME_LIMITS.imageBytes + 1)]).map((v) => v.rule)).toEqual(['A5'])
    expect(checkThemeFiles([BASE[0]!, file('theme.css', text('a'), THEME_LIMITS.cssBytes + 1), BASE[2]!]).map((v) => v.rule)).toEqual(['A5'])
  })

  it('measures the bytes when they are larger than the size the entry claims', () => {
    expect(run(file('fonts/a.woff2', sized(SIGNATURE.woff2!, THEME_LIMITS.fontBytes + 1), 10))).toEqual(['A5 fonts/a.woff2 409601'])
  })

  it('refuses a negative or fractional size', () => {
    expect(run(file('images/a.png', sized(SIGNATURE.png!), -1))).toEqual(['A5 images/a.png 64'])
    expect(run(file('images/a.png', sized(SIGNATURE.png!), 1.5))).toEqual(['A5 images/a.png 64'])
  })

  it('refuses a package over 10 MB in total even when every file is under its own ceiling', () => {
    const images = Array.from({ length: 10 }, (_, i) => typed(`images/i${i}.png`, THEME_LIMITS.imageBytes))
    const base = BASE.reduce((n, e) => n + e.size, 0)
    expect(run(...images)).toEqual([`A5  ${10 * THEME_LIMITS.imageBytes + base}`])
  })

  it('names the zip ceiling the installer applies before reading entries', () => {
    expect(THEME_LIMITS.zipBytes).toBe(5242880)
  })
})
