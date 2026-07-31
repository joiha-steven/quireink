// Pure helpers shared across lib and components. No side effects, no I/O.

// HTML-escape every special char so nothing user/author-typed becomes markup. The
// escape-first half of the limited-markdown security model (Invariant 5): shared by
// comment-md + inline-md, which then inject only their own whitelisted tags.
//
// Both quote forms are escaped, which is what makes this safe inside an attribute as well as
// in text. That is not a detail: a dozen renderers had grown their OWN three-replacement
// `escapeHtml` covering `& < >` alone, and one of them was interpolating the reader's search
// query straight into `value="…"`. `/search?q=" onfocus=alert(1) autofocus x="` came back as
// a live event handler on the public page. Two functions with one name, and the weaker one
// reached for by whoever wrote the next line.
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * The same escaping, named for the place it is going.
 *
 * An alias on purpose: the distinction that matters is not what the two functions DO, it is
 * that a reader of the call site can see which context the value lands in. Where they differ
 * is where the bug was, so here they cannot.
 */
export const escapeAttr = escapeHtml

// Convert arbitrary text to a URL-safe slug (supports Vietnamese diacritics).
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritic marks
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Terse date + 24h time for the admin tables, e.g. "4/6/26 - 14:05".
export function formatDateTimeShort(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const yy = String(d.getFullYear()).slice(-2)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${d.getDate()}/${d.getMonth() + 1}/${yy} - ${hh}:${mm}`
}

// Format an ISO date as "HH:mm" for the auto-save indicator.
export function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

// Max characters kept from an author-provided excerpt.
export const EXCERPT_MAX_CHARS = 200

// Strip markdown/HTML to plain text.
export function toPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ') // code blocks
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links -> text
    .replace(/<[^>]+>/g, ' ') // html tags (e.g. video iframes)
    .replace(/[#>*_`~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Auto excerpt: first `maxWords` words of the body, ending with "..." if cut.
export function deriveExcerpt(markdown: string, maxWords = 50): string {
  const plain = toPlainText(markdown)
  if (!plain) return ''
  const words = plain.split(' ')
  const trimmed = words.length <= maxWords ? plain : `${words.slice(0, maxWords).join(' ')}...`
  // Also cap by chars: a single long token (e.g. a URL) can blow past the word limit.
  return clampExcerpt(trimmed)
}

// All image URLs referenced in a piece of (rendered) content: markdown
// `![](url)`, HTML `src="url"`, and bare image URLs. De-duped, in order. Used for
// image SEO (sitemap `<image:image>` + Article schema) so search engines associate
// every image with the page that embeds it. Expects absolute URLs
// (content from getPost/getPage is already expanded to absolute Blob URLs).
export function extractImageUrls(content: string): string[] {
  // Match absolute (https://…) AND root-relative (/uploads/media/…) image URLs — self-
  // hosted images are stored store-relative, so an https-only regex missed them entirely
  // (which silently disabled the Lightbox + the article-schema image fallback).
  const re = /(?:https?:\/\/|\/)[^\s"')]+\.(?:jpe?g|png|webp|avif|gif|svg)/gi
  return [...new Set(content.match(re) ?? [])]
}

// Body word count (whitespace-split, markup stripped). Reused by readingMinutes so
// the two always agree. Note: whitespace-split, so CJK (no word spaces) undercounts —
// fine for space-delimited languages; the reading estimate has always worked this way.
export function wordCount(markdown: string): number {
  return toPlainText(markdown).split(' ').filter(Boolean).length
}

// Estimated reading time in whole minutes (>= 1), ~200 words per minute.
export function readingMinutes(markdown: string): number {
  return Math.max(1, Math.round(wordCount(markdown) / 200))
}

export type Heading = { id: string; text: string; level: 2 | 3 }

// Pull H2/H3 headings (with slug ids) from markdown for a table of contents.
// Mirrors the ids the renderer assigns, so anchors line up.
export function extractHeadings(markdown: string): Heading[] {
  const out: Heading[] = []
  // Skip fenced code blocks so a "## x" inside code isn't treated as a heading.
  const body = markdown.replace(/```[\s\S]*?```/g, '')
  // De-dupe collisions: 2nd "foo" -> "foo-2", 3rd -> "foo-3". MUST match
  // dedupeHeadingIds in PostContent (both walk H2/H3 in order) or anchors break.
  const counts = new Map<string, number>()
  for (const line of body.split('\n')) {
    const m = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line)
    if (!m) continue
    const text = m[2].replace(/[*_`]/g, '').trim()
    if (!text) continue
    const base = slugify(text)
    // No anchorable slug (e.g. "## !!!") → not a ToC entry; matches PostContent
    // emitting no id, so the two heading walks stay in sync.
    if (!base) continue
    const n = counts.get(base) ?? 0
    counts.set(base, n + 1)
    out.push({ id: n === 0 ? base : `${base}-${n + 1}`, text, level: m[1].length as 2 | 3 })
  }
  return out
}

// Lowercase + strip diacritics, for accent-insensitive search matching.
export function foldAccents(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
}

// Clamp an author-provided excerpt to a character limit (cut on a word boundary).
export function clampExcerpt(text: string, maxChars = EXCERPT_MAX_CHARS): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= maxChars) return clean
  const cut = clean.slice(0, maxChars)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim()}...`
}

// Human-readable file size from bytes, e.g. "1.2 MB".
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(1)} ${units[i]}`
}

// Is this post visible on the public blog right now? Published + date reached.
export function isPublicallyVisible(status: string, isoDate: string): boolean {
  if (status !== 'published') return false
  const d = new Date(isoDate).getTime()
  if (Number.isNaN(d)) return true
  return d <= Date.now()
}

// Scheduled = published but its date is still in the future, so the read layer
// (isPublicallyVisible) hides it until that time. A malformed date is never scheduled.
export function isScheduled(status: string, isoDate: string): boolean {
  if (status !== 'published') return false
  const d = new Date(isoDate).getTime()
  if (Number.isNaN(d)) return false
  return d > Date.now()
}
