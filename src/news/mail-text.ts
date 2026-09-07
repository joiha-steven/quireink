// The text/plain half of an email, from the HTML half. SERVER-ONLY.
//
// Every message this product sends is built as HTML and carries no plain-text alternative of
// its own, so this is what the second MIME part is made of — and until 2026-09-07 it was one
// regular expression, `html.replace(/<[^>]+>/g, '')`. Three things were wrong with the output
// that produced, and all three are visible in any mail client set to plain text:
//
//   · NO LINES. The template is a table, so every block boundary is a tag; with the tags gone
//     the whole letter arrived as one paragraph.
//   · NO LINKS. An <a> became its label. A newsletter whose text part contains neither the
//     post's address nor the unsubscribe link is a newsletter that cannot be read or left in
//     that part, and the unsubscribe link is the one a filter looks for.
//   · RAW ENTITIES. `&amp;` and `&nbsp;` are HTML spellings; nothing decoded them, so they
//     were read as themselves.
//
// It is also what CodeQL flagged (js/incomplete-multi-character-sanitization): removing a
// bracketed run can JOIN what stood either side of it, so one pass over `<scr<x>ipt>` hands
// back `<script>`. That alert was dismissed twice on the grounds that this is not a sanitiser
// — the output is a `text/plain` body and never an HTML context — and the reasoning was right
// and the code was still the wrong code. A scanner cannot reintroduce anything: it walks the
// string once and COPIES what is outside a tag, so nothing it emits was ever assembled from
// two halves.
//
// It parses only the HTML this codebase generates (`news/newsletter-email.ts`), which is why
// `<` inside an attribute value is not a case here.

/** Elements whose CONTENT is markup rather than words, dropped whole. */
const DROPPED = new Set(['script', 'style', 'head'])

/** What the HTML half does not show either: the preheader is a `display:none` div. */
const HIDDEN = /style\s*=\s*("[^"]*|'[^']*)display\s*:\s*none/i

/** Elements that end a line. `td` and `tr` are in it because the template lays out with tables. */
const BREAKS = new Set([
  'br', 'p', 'div', 'tr', 'td', 'table', 'li', 'ul', 'ol', 'hr', 'blockquote', 'section',
  'header', 'footer', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
])

/**
 * The entities this template can emit, decoded in ONE pass.
 *
 * One pass matters: decoding `&amp;` in a second sweep would turn a literal `&amp;lt;` into
 * `<`, which is the double-unescaping bug. With a single alternation each entity is read
 * exactly once and what it produces is never looked at again.
 */
const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'", '#x27': "'", nbsp: ' ',
  // The arrow on the read-the-post link. Every entity in the templates and the locale
  // dictionaries is in this table; anything else is left as it was written, which is the
  // right answer for a spelling nothing here produces.
  rarr: '\u2192',
}

const decode = (text: string): string =>
  text.replace(/&(amp|lt|gt|quot|apos|nbsp|rarr|#39|#x27);/gi, (whole, name: string) =>
    ENTITIES[name.toLowerCase()] ?? whole)

/** The element name a tag opens or closes, lowercased. '' when it is a comment or a doctype. */
function nameOf(tag: string): string {
  const match = /^\/?\s*([a-z][a-z0-9]*)/i.exec(tag)
  return match ? match[1]!.toLowerCase() : ''
}

/**
 * The `href` of an anchor tag, or '' when it has none.
 *
 * Left as it was WRITTEN, entities and all: everything this function returns is appended to
 * the same buffer the copied text goes into, and that buffer is decoded once at the end. An
 * address decoded here would be decoded a second time there, which is how `&amp;lt;` becomes
 * `<` in a URL that never contained one.
 */
function hrefOf(tag: string): string {
  const match = /\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag)
  return (match?.[2] ?? match?.[3] ?? match?.[4] ?? '').trim()
}

/** Where the element opened at `from` closes, or the end of the string. */
function endOfElement(html: string, name: string, from: number): number {
  const close = html.toLowerCase().indexOf(`</${name}`, from)
  if (close < 0) return html.length
  const gt = html.indexOf('>', close)
  return gt < 0 ? html.length : gt + 1
}

/**
 * Tidy the copied text: no trailing spaces, no runs of blank lines, no space runs inside a
 * line. The scanner emits a newline per block tag and the template nests them several deep,
 * so a letter comes out of it with a dozen blank lines between two sentences.
 */
function tidy(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/[^\S\n]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * The words in an HTML email, with its links, as the plain-text part.
 *
 * A link becomes `label (address)`, and only when the address is not already the label —
 * `Read it at https://…` written as a link to itself would otherwise print its address twice.
 */
export function htmlToText(html: string): string {
  let out = ''
  let index = 0
  // The address of the anchor being read, held until its closing tag so it can be printed
  // after the words it was wrapped around.
  let link: { href: string; at: number } | null = null

  while (index < html.length) {
    const lt = html.indexOf('<', index)
    if (lt < 0) {
      out += html.slice(index)
      break
    }
    out += html.slice(index, lt)
    const gt = html.indexOf('>', lt + 1)
    // An unclosed `<` is the end of the markup this can read, and everything after it would
    // be attributes rather than words.
    if (gt < 0) break
    const tag = html.slice(lt + 1, gt)
    const name = nameOf(tag)
    const closing = tag.trimStart().startsWith('/')

    // Markup rather than words, and the inbox preview line — a div the HTML half hides, so
    // a text part that prints it repeats the letter's first sentence before the letter.
    if (!closing && (DROPPED.has(name) || HIDDEN.test(tag))) {
      index = endOfElement(html, name, gt)
      continue
    }
    if (name === 'a') {
      if (closing) {
        const label = out.slice(link?.at ?? out.length).trim()
        if (link && link.href && !label.includes(link.href)) out += ` (${link.href})`
        link = null
      } else {
        link = { href: hrefOf(tag), at: out.length }
      }
    }
    if (BREAKS.has(name)) out += '\n'
    index = gt + 1
  }

  return tidy(decode(out))
}
