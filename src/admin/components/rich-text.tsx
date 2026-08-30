// The small subset of Markdown a chat answer actually uses, rendered as it arrives.
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
import type { JSX } from 'react'

/** `**bold**`, `*italic*`, `` `code` `` — each only once its closing mark has arrived. */
const INLINE = /(\*\*[^*\n]+\*\*|(?<!\*)\*[^*\n]+\*(?!\*)|`[^`\n]+`)/g

const CODE = 'rounded bg-neutral-100 px-1 py-0.5 font-mono text-[0.85em] dark:bg-neutral-800'

function inline(text: string, key: string): (JSX.Element | string)[] {
  return text.split(INLINE).filter((p) => p !== '').map((piece, i) => {
    const at = `${key}-${i}`
    if (piece.startsWith('**') && piece.endsWith('**') && piece.length > 4) {
      return <strong key={at} className="font-semibold">{piece.slice(2, -2)}</strong>
    }
    if (piece.startsWith('`') && piece.endsWith('`') && piece.length > 2) {
      return <code key={at} className={CODE}>{piece.slice(1, -1)}</code>
    }
    if (piece.startsWith('*') && piece.endsWith('*') && piece.length > 2) {
      return <em key={at}>{piece.slice(1, -1)}</em>
    }
    return piece
  })
}

/** `- item` and `1. item`, which is how a model answers "list them for me". */
const BULLET = /^\s*[-*+]\s+(.*)$/
const NUMBER = /^\s*(\d+)[.)]\s+(.*)$/

/** `---` between paragraphs, which models use to fence an answer they were asked for. */
const RULE = /^\s*([-*_])\1{2,}\s*$/

type Row =
  | { kind: 'text'; text: string }
  | { kind: 'item'; marker: string; text: string }
  | { kind: 'rule' }

function rows(source: string): Row[] {
  return source.split('\n').map((line) => {
    if (RULE.test(line)) return { kind: 'rule' }
    const numbered = NUMBER.exec(line)
    if (numbered) return { kind: 'item', marker: `${numbered[1]}.`, text: numbered[2] ?? '' }
    const bullet = BULLET.exec(line)
    if (bullet) return { kind: 'item', marker: '·', text: bullet[1] ?? '' }
    return { kind: 'text', text: line }
  })
}

/**
 * A chat answer, drawn.
 *
 * Blank lines become spacing rather than empty paragraphs, and a list item keeps its
 * marker in a fixed column so a five-item answer lines up instead of stepping right.
 */
export function RichText({ text }: { text: string }): JSX.Element {
  return (
    <>
      {rows(text).map((row, i) => {
        if (row.kind === 'rule') {
          return <span key={i} className="my-3 block border-t border-neutral-200 dark:border-neutral-700" />
        }
        if (row.kind === 'item') {
          return (
            <span key={i} className="flex gap-2">
              <span className="shrink-0 tabular-nums text-neutral-400 dark:text-neutral-500">{row.marker}</span>
              <span>{inline(row.text, String(i))}</span>
            </span>
          )
        }
        // An empty line is a gap, not a paragraph with nothing in it.
        if (row.text.trim() === '') return <span key={i} className="block h-2" />
        return <span key={i} className="block">{inline(row.text, String(i))}</span>
      })}
    </>
  )
}
