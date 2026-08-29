// What an image file actually IS, read from its first bytes.
//
// The upload route used to trust `File.type` — a header the browser writes from the file
// EXTENSION, which the person who made the file also chose. The gap was not exploitable
// today (the SVG sandbox and `nosniff` cover the dangerous renders), but "safe because two
// other layers happen to hold" is the shape every incident report starts with. Reading the
// bytes closes the triangle: extension, declared type and content must all agree before a
// file enters the store.
//
// Families only, never a full parser: the job is "is this really a PNG", not "is this PNG
// valid" — sharp answers the second question later and fails one variant, not the batch.

const ascii = (bytes: Uint8Array, start: number, text: string): boolean => {
  if (bytes.length < start + text.length) return false
  for (let i = 0; i < text.length; i++) if (bytes[start + i] !== text.charCodeAt(i)) return false
  return true
}

/** The sniffed MIME type, or null when the bytes match no family the library accepts. */
export function sniffImage(buffer: ArrayBuffer): string | null {
  const b = new Uint8Array(buffer)
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b.length >= 8 && b[0] === 0x89 && ascii(b, 1, 'PNG\r\n\x1a\n')) return 'image/png'
  if (ascii(b, 0, 'GIF87a') || ascii(b, 0, 'GIF89a')) return 'image/gif'
  if (ascii(b, 0, 'RIFF') && ascii(b, 8, 'WEBP')) return 'image/webp'
  // ISO-BMFF: box size, then 'ftyp', then a brand. `avif` is the still image, `avis` the
  // sequence; both decode wherever AVIF does.
  if (ascii(b, 4, 'ftyp') && (ascii(b, 8, 'avif') || ascii(b, 8, 'avis'))) return 'image/avif'
  return sniffSvg(b) ? 'image/svg+xml' : null
}

/**
 * SVG is text, so there is no magic number — the test is "an XML-ish document whose first
 * element is svg". BOM and leading whitespace allowed, `<?xml`, comments and a DOCTYPE
 * before it allowed, because real exports carry all four.
 */
function sniffSvg(b: Uint8Array): boolean {
  const head = new TextDecoder('utf-8', { fatal: false })
    .decode(b.subarray(0, 1024))
    .replace(/^﻿/, '')
  let rest = head.trimStart()
  // Skip prolog, comments and doctype — none of them may contain '<' tricks that matter
  // here, because we only ever ACCEPT on a literal `<svg` root.
  for (let guard = 0; guard < 10; guard++) {
    if (rest.startsWith('<?')) { const end = rest.indexOf('?>'); if (end < 0) return false; rest = rest.slice(end + 2).trimStart(); continue }
    if (rest.startsWith('<!--')) { const end = rest.indexOf('-->'); if (end < 0) return false; rest = rest.slice(end + 3).trimStart(); continue }
    if (rest.startsWith('<!')) { const end = rest.indexOf('>'); if (end < 0) return false; rest = rest.slice(end + 1).trimStart(); continue }
    break
  }
  return /^<svg[\s>/]/i.test(rest)
}
