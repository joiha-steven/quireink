// SVG in a theme package (A4): an ALLOW list, read by one linear scan.
//
// A deny list of dangerous tags lost twice in review: `<s:script>` under a re-declared SVG
// namespace prefix, and `<set attributeName="onclick">`. Each new trick needs a new entry, so
// this accepts only what a static drawing needs and refuses everything else: the elements
// below, attributes that are neither event handlers nor `style`, internal references only.
//
// The scan moves forward only. Every search starts where the last one ended and the scan
// returns at the first refusal, so the work is linear in the file size: an earlier regex
// over `<?xml ... encoding` was quadratic and took 31 s on 384 KB of `<?xml ` repeated.

const ELEMENTS: ReadonlySet<string> = new Set([
  'svg', 'g', 'path', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'rect', 'defs',
  'symbol', 'use', 'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask', 'pattern',
  'title', 'desc', 'text', 'tspan',
])

const SVG_NS = 'http://www.w3.org/2000/svg'
const XLINK_NS = 'http://www.w3.org/1999/xlink'
const ID_REF = /^#[A-Za-z_][A-Za-z0-9_.-]*$/
/** Substrings no attribute value may hold: fetches, scripts, and escapes that could spell them. */
const VALUE_DENY = ['image-set', 'image(', '&#', '\\', 'javascript:', 'data:']

const isSpace = (c: string | undefined) => c === ' ' || c === '\t' || c === '\n' || c === '\r'
const isNameChar = (c: string | undefined) => c !== undefined && /[A-Za-z0-9_:.-]/.test(c)

/** Why an attribute is refused, or null. `name` is as written; `value` is the raw quoted text. */
function attributeFinding(name: string, value: string): string | null {
  const lower = name.toLowerCase()
  if (lower.startsWith('on')) return name
  if (lower === 'style') return name
  if (name === 'xmlns') return value === SVG_NS ? null : `${name}=${value}`
  if (name === 'xmlns:xlink') return value === XLINK_NS ? null : `${name}=${value}`
  const colon = name.indexOf(':')
  if (colon >= 0) {
    const prefix = name.slice(0, colon)
    // `xml:space`, `xml:lang`; and from xlink only the two attributes a drawing uses.
    if (!(prefix === 'xml' || name === 'xlink:href' || name === 'xlink:title')) return name
  }
  if (lower === 'href' || name === 'xlink:href') return ID_REF.test(value) ? null : `${name}=${value}`
  const v = value.toLowerCase()
  for (const needle of VALUE_DENY) if (v.includes(needle)) return needle
  // url() only as `url(#id)`: a reference to a gradient, clip or mask in this file.
  for (let at = v.indexOf('url('); at >= 0; at = v.indexOf('url(', at + 4)) {
    const close = v.indexOf(')', at)
    if (close < 0 || !ID_REF.test(value.slice(at + 4, close))) return value.slice(at, at + 40)
  }
  return null
}

/** Reads the attributes of a tag from `pos`; returns the index after `>` or a refusal. */
function readAttributes(text: string, pos: number): { end: number } | { finding: string } {
  let i = pos
  for (;;) {
    while (isSpace(text[i])) i += 1
    const c = text[i]
    if (c === undefined) return { finding: 'unclosed tag' }
    if (c === '>') return { end: i + 1 }
    if (c === '/' && text[i + 1] === '>') return { end: i + 2 }
    const nameStart = i
    while (isNameChar(text[i])) i += 1
    if (i === nameStart) return { finding: text.slice(i, i + 20) }
    const name = text.slice(nameStart, i)
    while (isSpace(text[i])) i += 1
    if (text[i] !== '=') return { finding: name }
    i += 1
    while (isSpace(text[i])) i += 1
    const quote = text[i]
    if (quote !== '"' && quote !== "'") return { finding: name }
    const close = text.indexOf(quote, i + 1)
    if (close < 0) return { finding: name }
    const value = text.slice(i + 1, close)
    if (value.includes('<')) return { finding: name }
    const finding = attributeFinding(name, value)
    if (finding !== null) return { finding }
    i = close + 1
    if (text[i] === undefined) return { finding: 'unclosed tag' }
    // XML wants whitespace between attributes; `a="1"b="2"` is not well-formed.
    if (!isSpace(text[i]) && text[i] !== '>' && text[i] !== '/') return { finding: text.slice(i, i + 20) }
  }
}

/** The one XML declaration allowed, at the very start; returns where content begins or a refusal. */
function readDeclaration(text: string): { end: number } | { finding: string } {
  if (!text.startsWith('<?xml') || !isSpace(text[5])) return { end: 0 }
  const close = text.indexOf('?>', 5)
  if (close < 0) return { finding: '<?xml' }
  const body = text.slice(5, close)
  const enc = body.indexOf('encoding')
  if (enc >= 0) {
    let i = enc + 'encoding'.length
    while (isSpace(body[i])) i += 1
    if (body[i] !== '=') return { finding: '<?xml' }
    i += 1
    while (isSpace(body[i])) i += 1
    const q = body[i]
    const end = q === '"' || q === "'" ? body.indexOf(q, i + 1) : -1
    const value = end < 0 ? '' : body.slice(i + 1, end).toLowerCase()
    if (value !== 'utf-8' && value !== 'utf8') return { finding: `encoding=${body.slice(i, i + 20)}` }
  }
  return { end: close + 2 }
}

/**
 * Why an SVG may not be stored, as the text that gave it away, or null when it is a static
 * drawing. Bytes must be UTF-8 with no BOM and no NUL: a pattern scan over UTF-8 is blind to
 * UTF-16 or a declared legacy charset, which a browser would honour.
 */
export function svgFinding(bytes: Uint8Array | undefined): string | null {
  if (bytes === undefined) return 'no bytes'
  if ((bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) ||
    (bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff)) return 'BOM'
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
  } catch {
    return 'not utf-8'
  }
  if (text.includes('\0')) return 'NUL'

  const decl = readDeclaration(text)
  if ('finding' in decl) return decl.finding
  let pos = decl.end
  for (;;) {
    const lt = text.indexOf('<', pos)
    if (lt < 0) return null
    if (text.startsWith('<!--', lt)) {
      const close = text.indexOf('-->', lt + 4)
      if (close < 0) return '<!--'
      const body = text.slice(lt + 4, close)
      if (body.includes('--') || body.endsWith('-')) return '--'
      pos = close + 3
      continue
    }
    // DOCTYPE, ENTITY, CDATA, and any processing instruction after the declaration.
    if (text[lt + 1] === '!' || text[lt + 1] === '?') return text.slice(lt, lt + 12)
    const closing = text[lt + 1] === '/'
    let i = closing ? lt + 2 : lt + 1
    const nameStart = i
    while (isNameChar(text[i])) i += 1
    const name = text.slice(nameStart, i)
    if (name.includes(':')) return `<${name}`
    if (!ELEMENTS.has(name)) return `<${closing ? '/' : ''}${name}`
    if (closing) {
      while (isSpace(text[i])) i += 1
      if (text[i] !== '>') return `</${name}`
      pos = i + 1
      continue
    }
    if (!isSpace(text[i]) && text[i] !== '>' && text[i] !== '/') return `<${name}${text.slice(i, i + 10)}`
    const attrs = readAttributes(text, i)
    if ('finding' in attrs) return attrs.finding
    pos = attrs.end
  }
}
