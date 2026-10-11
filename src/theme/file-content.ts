// What the bytes of a package file must look like: text files decoded one way only, binary
// files starting with the signature their extension promises, the screenshot at its size.

import type { Violation } from '@/theme/types'

const ascii = (bytes: Uint8Array, at: number, text: string) =>
  text.split('').every((ch, k) => bytes[at + k] === ch.charCodeAt(0))

/** The first bytes as hex: the subject when content does not match its name. */
export const hexHead = (bytes: Uint8Array) =>
  Array.from(bytes.subarray(0, 12), (b) => b.toString(16).padStart(2, '0')).join('')

/**
 * The ONE way theme.css and theme.json become text. UTF-8, fatal on any invalid sequence, no
 * byte order mark of any kind and no NUL.
 *
 * Why it matters: `checkThemeCss` reads the string it is given, while a browser reads the
 * BYTES and honours a BOM over everything else. A stylesheet starting FF FE decodes, leniently
 * as UTF-8, into a harmless comment, and in a browser into UTF-16 rules the checker never saw.
 * `checkThemeCss` is only a gate for a string that came from this function.
 */
export function decodeThemeText(bytes: Uint8Array, file = 'theme.css'): string | Violation {
  const fail = (subject: string): Violation => ({ rule: 'A3', file, line: 0, col: 0, subject })
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return fail('UTF-8 BOM')
  if ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff)) return fail('UTF-16 BOM')
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
  } catch {
    return fail('not utf-8')
  }
  if (text.includes('\0')) return fail('NUL')
  return text
}

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/** AVIF is an ISO-BMFF file whose leading `ftyp` box names avif or avis, as major or compatible brand. */
function isAvif(bytes: Uint8Array): boolean {
  if (bytes.length < 16 || !ascii(bytes, 4, 'ftyp')) return false
  const size = ((bytes[0]! << 24) | (bytes[1]! << 16) | (bytes[2]! << 8) | bytes[3]!) >>> 0
  if (size < 16 || size > bytes.length || size % 4 !== 0) return false
  for (let at = 8; at < size; at += 4) {
    if (at === 12) continue // the minor version, not a brand
    if (ascii(bytes, at, 'avif') || ascii(bytes, at, 'avis')) return true
  }
  return false
}

/** Whether a font or raster image starts with the signature its extension promises. */
export function hasSignature(path: string, bytes: Uint8Array): boolean {
  const ext = path.slice(path.lastIndexOf('.') + 1)
  switch (ext) {
    case 'woff2': return ascii(bytes, 0, 'wOF2')
    case 'png': return PNG.every((b, k) => bytes[k] === b)
    case 'jpg':
    case 'jpeg': return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    case 'webp': return ascii(bytes, 0, 'RIFF') && ascii(bytes, 8, 'WEBP')
    case 'avif': return isAvif(bytes)
    default: return true
  }
}

/**
 * A WebP's canvas size from its first chunk header, without decoding the image: VP8 (lossy)
 * keeps 14-bit sizes after the frame start code, VP8L (lossless) packs width-1 and height-1
 * into 14 bits each, VP8X (extended) stores width-1 and height-1 as 24-bit little-endian.
 */
export function webpSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 30 || !ascii(bytes, 0, 'RIFF') || !ascii(bytes, 8, 'WEBP')) return null
  const u16 = (at: number) => bytes[at]! | (bytes[at + 1]! << 8)
  const u24 = (at: number) => bytes[at]! | (bytes[at + 1]! << 8) | (bytes[at + 2]! << 16)
  if (ascii(bytes, 12, 'VP8 ')) {
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null
    return { width: u16(26) & 0x3fff, height: u16(28) & 0x3fff }
  }
  if (ascii(bytes, 12, 'VP8L')) {
    if (bytes[20] !== 0x2f) return null
    const bits = (bytes[21]! | (bytes[22]! << 8) | (bytes[23]! << 16) | (bytes[24]! << 24)) >>> 0
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 }
  }
  if (ascii(bytes, 12, 'VP8X')) return { width: u24(24) + 1, height: u24(27) + 1 }
  return null
}
