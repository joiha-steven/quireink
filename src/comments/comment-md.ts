// Limited markdown for reader comments: TEXT with **bold** and *italic* only.
// Everything else (links, images, headings, lists, code, raw HTML) is rendered as
// plain escaped text — never executed. Security model: we ESCAPE the whole string
// first, so only the `<strong>`/`<em>`/`<br>` tags WE inject can ever appear (no
// user-supplied tag survives). Mirrors Invariant 5 (raw HTML in content is escaped).

import { escapeHtml } from '@/utils'

const MAX_LEN = 1000

// Render comment source to SAFE html. Bold before italic (so `**` is consumed
// before single `*`); emphasis never spans a newline. Newlines become <br>.
export function renderCommentMarkdown(input: string): string {
  const escaped = escapeHtml(input.slice(0, MAX_LEN))
  return escaped
    .replace(/\*\*([^\n]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^\n]+?)__/g, '<strong>$1</strong>')
    .replace(/\*([^\n]+?)\*/g, '<em>$1</em>')
    .replace(/_([^\n]+?)_/g, '<em>$1</em>')
    .replace(/\r\n|\r|\n/g, '<br>')
    .trim()
}

/**
 * The same comment as the words a reader sees, with the emphasis markers taken off and nothing
 * escaped: what the admin searches and highlights. Same four patterns, so a `*word*` that
 * renders as emphasis is the word here, and one that does not render keeps its asterisk.
 */
export function commentPlainText(input: string): string {
  return input.slice(0, MAX_LEN)
    .replace(/\*\*([^\n]+?)\*\*/g, '$1')
    .replace(/__([^\n]+?)__/g, '$1')
    .replace(/\*([^\n]+?)\*/g, '$1')
    .replace(/_([^\n]+?)_/g, '$1')
    .trim()
}
