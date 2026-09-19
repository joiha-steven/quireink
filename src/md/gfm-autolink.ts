// GFM's extended autolinks: a URL written as itself, with no angle brackets round it.
//
// `<https://example.com>` is CommonMark and handled in the scan. This is the other kind —
// `https://example.com` sitting in a sentence, or `www.example.com`, or a bare email address —
// which is how people actually paste links and which CommonMark deliberately does not do.
//
// A PASS OVER THE TEXT NODES, after parsing, rather than a case in the scanner. Two reasons,
// and the second is the real one: the text a link should be found in is the text that survived
// every other rule, so a code span or an existing link has already taken its characters out of
// reach; and the trailing-punctuation rules below need to look at a whole run at once, which a
// character-at-a-time scanner cannot do.

import type { Inline } from './ast'
import { mergeText } from './ast'

/**
 * Where a link may begin: the start of a run, or after whitespace or one of `*_~(`.
 *
 * The last four are there because emphasis and brackets sit tight against the words they wrap,
 * so `(www.example.com)` and `*https://example.com*` have to work — while `xhttps://x.com`
 * must not, or every word ending in a scheme name would become a link.
 */
const BOUNDARY = /[\s*_~(]/

const SCHEME = /^(?:https?:\/\/|ftp:\/\/)/i

/** A label of a domain: letters, digits, `-` and `_`, and at least one dot overall. */
const DOMAIN = /^[\w.-]*[A-Za-z0-9_-](?:\.[\w-]+)+/

const EMAIL = /^[A-Za-z0-9._+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+/

/**
 * Trim what the spec calls trailing punctuation, in the order it says to.
 *
 * `?`, `!`, `.`, `,`, `:`, `*`, `_`, `~` never end a link — they end the SENTENCE the link is
 * in. A `)` is kept only while the parentheses balance, so `(see https://en.wikipedia.org/wiki/A_(b))`
 * links the inner pair and gives the outer one back to the prose. And a trailing `&…;` is an
 * entity belonging to the text, not to the URL.
 */
function trimTrailing(url: string): string {
  let out = url
  for (;;) {
    const before = out
    out = out.replace(/[?!.,:*_~]+$/, '')
    if (out.endsWith(')')) {
      const opens = (out.match(/\(/g) ?? []).length
      const closes = (out.match(/\)/g) ?? []).length
      if (closes > opens) out = out.slice(0, -1)
    }
    const entity = /&[A-Za-z0-9]+;$/.exec(out)
    if (entity) out = out.slice(0, -entity[0].length)
    if (out === before) return out
  }
}

/**
 * One autolink starting exactly at `from`, or null.
 *
 * Exported since 2026-09-15 so the EDITOR's typing rule can ask the same question the reader's
 * page and the serializer ask. It answers with the `url` (which may differ from the text — a
 * `www.` host gets a scheme, an address gets `mailto:`) and the `length` of the text it
 * consumed, which is how a sentence-final full stop stays outside the link.
 */
export function bareLinkAt(text: string, from: number): { url: string; label: string; length: number } | null {
  const rest = text.slice(from)

  const scheme = SCHEME.exec(rest)
  if (scheme) {
    const after = rest.slice(scheme[0].length)
    const domain = DOMAIN.exec(after)
    if (!domain) return null
    const tail = /^[^\s<]*/.exec(after.slice(domain[0].length))![0]
    const whole = trimTrailing(scheme[0] + domain[0] + tail)
    return whole.length > scheme[0].length ? { url: whole, label: whole, length: whole.length } : null
  }

  if (/^www\./i.test(rest)) {
    const domain = DOMAIN.exec(rest)
    if (!domain) return null
    const tail = /^[^\s<]*/.exec(rest.slice(domain[0].length))![0]
    const whole = trimTrailing(domain[0] + tail)
    // The scheme a bare `www.` link is given. GFM's choice, not ours.
    return { url: `http://${whole}`, label: whole, length: whole.length }
  }

  const mail = EMAIL.exec(rest)
  if (mail) {
    // A `-` or `_` RIGHT AFTER the address refuses the whole thing rather than being trimmed
    // off it: `a.b@c.d-` is not an address with a dash after it, it is text. A `.` after one
    // is the sentence's full stop and does come off, which `trimTrailing` above handles for
    // URLs and the regex's own tail handles here.
    const next = rest[mail[0].length]
    if (next === '-' || next === '_') return null
    return { url: `mailto:${mail[0]}`, label: mail[0], length: mail[0].length }
  }

  return null
}

/** Split one text node into the links it contains and the text around them. */
function splitText(value: string): Inline[] | null {
  const out: Inline[] = []
  let plain = ''
  let i = 0
  let found = false

  while (i < value.length) {
    const atBoundary = i === 0 || BOUNDARY.test(value[i - 1]!)
    if (atBoundary) {
      const hit = bareLinkAt(value, i)
      if (hit) {
        if (plain) {
          out.push({ type: 'text', value: plain })
          plain = ''
        }
        out.push({ type: 'link', url: hit.url, children: [{ type: 'text', value: hit.label }] })
        i += hit.length
        found = true
        continue
      }
    }
    plain += value[i]
    i += 1
  }

  if (!found) return null
  if (plain) out.push({ type: 'text', value: plain })
  return out
}

/**
 * Find them everywhere text can be, except inside a link — a link inside a link is not a thing,
 * and the label of an existing one is its author's words rather than an address to be found.
 */
/**
 * Whether this URL, written BARE in prose, reads back as exactly this link.
 *
 * The serializer's question. GFM turns a URL standing in text into a link by itself, so a link
 * whose label IS its destination can be written as the URL and nothing else — which is what the
 * author typed. It asks the real matcher rather than testing for `https://`, because the
 * trailing-punctuation rules decide it: `https://x.test/a.` linkifies without the full stop, so
 * writing that one bare would lose a character on the next read.
 */
export function isBareAutolink(url: string): boolean {
  const m = bareLinkAt(url, 0)
  return m !== null && m.length === url.length && m.url === url
}

export function linkifyAll(nodes: Inline[]): Inline[] {
  const out: Inline[] = []
  // ⚠️ MERGED FIRST, because a URL is found in ONE text node and the parser does not always
  // leave one. `**https://vi.wikipedia.org/wiki/Trang_Chính**` comes out of emphasis as three
  // nodes — the link's text, `_`, `Chính` — since an underscore that opened no emphasis is left
  // standing as a node of its own. This pass then found the URL only as far as the underscore,
  // so a bolded link went to `…/wiki/Trang` and the rest of the address was printed as text.
  // The same address in plain prose was one node and worked, which is why nothing caught it.
  for (const node of mergeText(nodes)) {
    switch (node.type) {
      case 'text': {
        const split = splitText(node.value)
        if (split) out.push(...split)
        else out.push(node)
        break
      }
      case 'link':
        out.push(node)
        break
      case 'emph':
      case 'strong':
      case 'strike':
      case 'ink':
      case 'underline':
      case 'ring':
        out.push({ ...node, children: linkifyAll(node.children) })
        break
      default:
        out.push(node)
    }
  }
  return out
}
