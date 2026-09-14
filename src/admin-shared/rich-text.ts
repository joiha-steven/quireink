// The small subset of Markdown a chat answer actually uses, described as marks.
//
// THE RULE THAT SHAPES THIS: a mark is only a mark once it is CLOSED. While `**Ligature`
// is still arriving it is four literal characters and stays four literal characters; the
// moment the closing `**` lands the whole run becomes bold. Anything else flickers — the
// asterisks would vanish on the opening delta and the text would reflow on the closing
// one, twice per emphasis, on every answer.
//
// Deliberately not the site's own Markdown renderer. That one exists for posts: footnotes,
// tables, mathematics, syntax highlighting, and a bundle to match. The admin does not need
// it to show a sentence with two bold words in it, and `check:bundle` watches the size of
// what the owner downloads.
//
// ⚠️ It answers in `Mark`s rather than in React elements (ADR 0054). The same answer is drawn
// by the server for a conversation reopened from the database and by the island for one
// arriving over the wire, and those two have to be the same markup or a reload would change
// the page under the reader. See `admin-shared/markup.ts`.
import { el, leaf, txt, type Mark } from '@/admin-shared/markup'

/** `**bold**`, `*italic*`, `` `code` `` — each only once its closing mark has arrived. */
const INLINE = /(\*\*[^*\n]+\*\*|(?<!\*)\*[^*\n]+\*(?!\*)|`[^`\n]+`)/g

const CODE = 'rounded bg-neutral-100 px-1 py-0.5 font-mono text-[0.85em] dark:bg-neutral-800'

const TH = 'border-b border-neutral-200 pb-1.5 pr-4 font-medium text-neutral-900'
  + ' dark:border-neutral-700 dark:text-neutral-100'
const TD = 'border-b border-neutral-100 py-1.5 pr-4 align-top dark:border-neutral-800'
const MARKER = 'shrink-0 tabular-nums text-neutral-400 dark:text-neutral-500'

function inline(text: string): Mark[] {
  return text.split(INLINE).filter((p) => p !== '').map((piece) => {
    if (piece.startsWith('**') && piece.endsWith('**') && piece.length > 4) {
      return leaf('strong', 'font-semibold', piece.slice(2, -2))
    }
    if (piece.startsWith('`') && piece.endsWith('`') && piece.length > 2) {
      return leaf('code', CODE, piece.slice(1, -1))
    }
    if (piece.startsWith('*') && piece.endsWith('*') && piece.length > 2) {
      return leaf('em', '', piece.slice(1, -1))
    }
    return txt(piece)
  })
}

/** `- item` and `1. item`, which is how a model answers "list them for me". */
const BULLET = /^\s*[-*+]\s+(.*)$/
const NUMBER = /^\s*(\d+)[.)]\s+(.*)$/

/** `---` between paragraphs, which models use to fence an answer they were asked for. */
const RULE = /^\s*([-*_])\1{2,}\s*$/

/** `| a | b |`, and the `|---|---|` that turns the line above it into a header. */
const CELLS = /^\s*\|(.+)\|\s*$/
const DIVIDER = /^\s*\|[\s:|-]+\|\s*$/

const cells = (line: string): string[] =>
  (CELLS.exec(line)?.[1] ?? '').split('|').map((c) => c.trim())

type Row =
  | { kind: 'text'; text: string }
  | { kind: 'item'; marker: string; text: string }
  | { kind: 'rule' }
  | { kind: 'table'; head: string[]; body: string[][] }

/**
 * Lines into blocks.
 *
 * A table is the one thing here that spans lines, and it obeys the same rule as an
 * emphasis mark: it is not a table until the divider row has arrived. Until then the
 * pipes stay pipes, so a table being streamed does not flicker into existence one row at
 * a time and then re-lay itself out when the widths change.
 */
export function rows(source: string): Row[] {
  const lines = source.split('\n')
  const out: Row[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (CELLS.test(line) && i + 1 < lines.length && DIVIDER.test(lines[i + 1]!)) {
      const head = cells(line)
      const body: string[][] = []
      let j = i + 2
      while (j < lines.length && CELLS.test(lines[j]!)) { body.push(cells(lines[j]!)); j++ }
      out.push({ kind: 'table', head, body })
      i = j - 1
      continue
    }
    if (RULE.test(line)) { out.push({ kind: 'rule' }); continue }
    const numbered = NUMBER.exec(line)
    if (numbered) { out.push({ kind: 'item', marker: `${numbered[1]}.`, text: numbered[2] ?? '' }); continue }
    const bullet = BULLET.exec(line)
    if (bullet) { out.push({ kind: 'item', marker: '·', text: bullet[1] ?? '' }); continue }
    out.push({ kind: 'text', text: line })
  }
  return out
}

const table = (row: { head: string[]; body: string[][] }): Mark =>
  // Scrolls INSIDE its own box: a four-column answer must not widen the sheet and give the
  // whole transcript a horizontal scrollbar.
  el('span', 'my-3 block overflow-x-auto', [
    el('table', 'w-full border-collapse text-left', [
      el('thead', '', [el('tr', '', row.head.map((h) => el('th', TH, inline(h))))]),
      el('tbody', '', row.body.map((cs) => el('tr', '', cs.map((c) => el('td', TD, inline(c)))))),
    ]),
  ])

/**
 * A chat answer, drawn.
 *
 * Blank lines become spacing rather than empty paragraphs, and a list item keeps its
 * marker in a fixed column so a five-item answer lines up instead of stepping right.
 */
export function richMarks(text: string): Mark[] {
  return rows(text).map((row) => {
    if (row.kind === 'table') return table(row)
    if (row.kind === 'rule') return el('span', 'my-3 block border-t border-neutral-200 dark:border-neutral-700', [])
    if (row.kind === 'item') {
      return el('span', 'flex gap-2', [
        leaf('span', MARKER, row.marker),
        el('span', '', inline(row.text)),
      ])
    }
    // An empty line is a gap, not a paragraph with nothing in it.
    if (row.text.trim() === '') return el('span', 'block h-2', [])
    return el('span', 'block', inline(row.text))
  })
}
