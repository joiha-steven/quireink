// Limited inline markdown for owner-authored chrome (the site footer): plain TEXT
// with **bold**, *italic*, ++underline++ and [label](url) links only. Security model
// mirrors comment-md + Invariant 5 (raw HTML in content is escaped, never executed):
// we ESCAPE the whole string FIRST, so the only tags that can ever appear are the
// <strong>/<em>/<u>/<a> WE inject — no user-supplied tag survives. Link hrefs are
// protocol-checked (http/https/mailto, root-relative, or a #anchor); anything else
// (e.g. javascript:) falls back to plain text. Pure + isomorphic: the server layout
// renders the footer with it and the admin editor previews with the same function.

import { escapeHtml } from '@/utils'

const MAX_LEN = 600

// A safe href (checked on the already-escaped url; quotes are gone so it cannot
// break out of the attribute): absolute http(s)/mailto, root-relative, or anchor.
function safeHref(url: string): string | null {
  const h = url.trim()
  if (/^(https?:|mailto:)/i.test(h)) return h
  if (/^\/[^/]/.test(h) || h.startsWith('#')) return h
  return null
}

// Render the limited footer source to SAFE html. `newTab` opens EXTERNAL (http/https)
// links in a new tab (default for footer links); internal/anchor/mailto stay in-tab.
export function renderInlineMarkdown(input: string, opts?: { newTab?: boolean }): string {
  let s = escapeHtml(input.slice(0, MAX_LEN))
  // Links first so emphasis inside a label still resolves afterwards.
  s = s.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (whole, label: string, url: string) => {
    const href = safeHref(url)
    if (!href) return whole
    const blank = opts?.newTab && /^https?:/i.test(href) ? ' target="_blank"' : ''
    return `<a href="${href}"${blank} rel="noopener">${label}</a>`
  })
  return s
    .replace(/\*\*([^\n]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^\n]+?)__/g, '<strong>$1</strong>')
    .replace(/\+\+([^\n]+?)\+\+/g, '<u>$1</u>')
    .replace(/\*([^\n]+?)\*/g, '<em>$1</em>')
    .replace(/_([^\n]+?)_/g, '<em>$1</em>')
    .replace(/\r\n|\r|\n/g, '<br>')
    .trim()
}

// Replace the {year}/{title} tokens BEFORE rendering (so the title is escaped too).
export function expandFooterTokens(footer: string, title: string): string {
  return footer.replace(/\{year\}/g, String(new Date().getFullYear())).replace(/\{title\}/g, title)
}
