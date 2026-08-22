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
