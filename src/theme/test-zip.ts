// Theme packages for tests, honest and hostile. Shared by the installer's tests only; nothing in the
// engine imports it.
//
// A zip is written by hand here rather than by `import/zip-write.ts` because the hostile cases need
// what no honest writer does: a directory that declares a size the entry does not have, a name
// with `..` in it, a Unix symlink, bytes that are not deflate at all.
import { crc32, deflateRawSync } from 'node:zlib'

export type TestEntry = {
  name: string
  data: Uint8Array
  /** Stored by default; `deflate` compresses, which is how a bomb fits in a small zip. */
  deflate?: boolean
  /** What the directory says the entry inflates to, when it should lie. */
  declaredSize?: number
  /** A Unix symlink by its mode bits. */
  symlink?: boolean
  /** Bytes written in place of the (compressed) data, CRC and sizes left as computed. */
  rawData?: Uint8Array
}

const u16 = (n: number) => [n & 255, (n >>> 8) & 255]
const u32 = (n: number) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]

export function testZip(entries: readonly TestEntry[]): Uint8Array {
  const local: number[] = []
  const central: number[] = []
  for (const e of entries) {
    const name = new TextEncoder().encode(e.name)
    const packed = e.rawData ?? (e.deflate ? new Uint8Array(deflateRawSync(e.data)) : e.data)
    const method = e.deflate ? 8 : 0
    const crc = crc32(e.data) >>> 0
    const size = e.declaredSize ?? e.data.length
    const offset = local.length
    local.push(...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(method), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(packed.length), ...u32(size), ...u16(name.length), ...u16(0), ...name, ...packed)
    const madeBy = e.symlink ? (3 << 8) | 20 : 20
    const external = e.symlink ? (0o120777 << 16) >>> 0 : 0
    central.push(...u32(0x02014b50), ...u16(madeBy), ...u16(20), ...u16(0), ...u16(method), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(packed.length), ...u32(size), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(external), ...u32(offset), ...name)
  }
  const end = [...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(entries.length), ...u16(entries.length),
    ...u32(central.length), ...u32(local.length), ...u16(0)]
  return new Uint8Array([...local, ...central, ...end])
}

const ascii = (t: string) => Array.from(t, (c) => c.charCodeAt(0))
const u24 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255]
/** A WebP whose VP8X chunk declares 1200 by 900, the screenshot's required size. */
export const SCREENSHOT = (() => {
  const head = [...ascii('RIFF'), 22, 0, 0, 0, ...ascii('WEBPVP8X'), 10, 0, 0, 0, 0, 0, 0, 0, ...u24(1199), ...u24(899)]
  const bytes = new Uint8Array(64)
  bytes.set(head)
  return bytes
})()
/** Bytes that start like a woff2, which is all the checker asks of a font. */
export const FONT = new Uint8Array([...ascii('wOF2'), ...new Array<number>(60).fill(7)])

const text = (t: string) => new TextEncoder().encode(t)

export const MANIFEST = { api: 1, id: 'broadsheet', name: 'Broadsheet', version: '1.0.0', author: 'A. Writer', license: 'MIT' }
/** Styles one blog surface and the front page, and points at a font and a picture in the package. */
export const CSS = [
  '.prose{color:var(--c-text);background:url(images/grain.svg)}',
  '.front{color:var(--c-heading)}',
].join('\n')
export const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2"><rect width="1" height="1"/></svg>'

/** An installable package's files, with `over` replacing or adding entries by name (null drops one). */
export function themeFiles(over: Record<string, Uint8Array | string | object | null> = {}): TestEntry[] {
  const base: Record<string, Uint8Array | string | object | null> = {
    'theme.json': MANIFEST,
    'theme.css': CSS,
    'screenshot.webp': SCREENSHOT,
    'fonts/body.woff2': FONT,
    'images/grain.svg': SVG,
    ...over,
  }
  return Object.entries(base).flatMap(([name, v]) => {
    if (v === null) return []
    const data = v instanceof Uint8Array ? v : text(typeof v === 'string' ? v : JSON.stringify(v))
    return [{ name, data, deflate: !name.endsWith('.webp') }]
  })
}

export const themeZip = (over: Record<string, Uint8Array | string | object | null> = {}): Uint8Array => testZip(themeFiles(over))
