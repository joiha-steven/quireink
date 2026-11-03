// Parse a Substack or Medium export — both arrive as a ZIP of HTML files — into Quire
// Ink posts. PURE over unzipped entries: the route does the unzip (`import/unzip.ts`) and hands
// `{ name, text }` pairs in, so these parsers stay I/O-free like the other two.
//
// Sniffing is structural, not by filename: a Substack zip has `posts.csv` beside a
// `posts/` folder; a Medium zip has `posts/*.html` whose markup wears Medium's own
// class names. The owner uploads "my export" and the server works out whose it is.

import {
  htmlToMarkdown, importSlug, slugTracker, decodeEntities, deriveExcerpt,
  type ImportedPost, type ImportResult,
} from '@/import/convert'

export type Entry = { name: string; text: string }

// ---- a small RFC-4180 reader ----------------------------------------------------------
// Substack's posts.csv quotes fields that contain commas and doubles inner quotes. A
// split-on-comma reader corrupts exactly the rows that matter (every titled post with a
// comma), so this is the real grammar, ~30 lines, no dependency.

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') inQuotes = false
      else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.length > 1 || row[0] !== '') rows.push(row)
      row = []
    } else field += c
  }
  row.push(field)
  if (row.length > 1 || row[0] !== '') rows.push(row)
  return rows
}

// ---- Substack ---------------------------------------------------------------------------

const findEntry = (entries: Entry[], suffix: string): Entry | undefined =>
  entries.find((e) => e.name === suffix || e.name.endsWith(`/${suffix}`))

export const isSubstack = (entries: Entry[]): boolean => findEntry(entries, 'posts.csv') !== undefined

export function parseSubstack(entries: Entry[], now: string): ImportResult {
  const csv = findEntry(entries, 'posts.csv')
  if (!csv) return { posts: [], pages: [], skipped: 0 }
  const rows = parseCsv(csv.text)
  const header = rows[0] ?? []
  const col = (name: string): number => header.indexOf(name)
  const [idC, dateC, pubC, titleC, subC, typeC, audienceC] =
    ['post_id', 'post_date', 'is_published', 'title', 'subtitle', 'type', 'audience'].map(col)

  const html = new Map<string, string>()
  for (const e of entries) {
    const m = e.name.match(/(?:^|\/)posts\/([^/]+)\.html$/)
    if (m) html.set(m[1]!, e.text)
  }

  const uniqueSlug = slugTracker()
  const posts: ImportedPost[] = []
  let skipped = 0
  let locked = 0

  for (const r of rows.slice(1)) {
    const id = r[idC] ?? ''
    const body = html.get(id)
    // A podcast row has no html file; a thread's file holds the thread. No body, no post.
    if (!id || body === undefined) { skipped++; continue }
    const type = typeC >= 0 ? (r[typeC] ?? '') : ''
    if (type && !['newsletter', 'thread', 'podcast'].includes(type)) { skipped++; continue }

    // Substack's post_id is `123456.the-slug` — the slug half is the public URL's.
    const slugPart = id.includes('.') ? id.slice(id.indexOf('.') + 1) : id
    const title = decodeEntities((r[titleC] ?? '').trim()) || 'Untitled'
    const content = htmlToMarkdown(body)
    const excerpt = decodeEntities((r[subC] ?? '').trim()) || deriveExcerpt(content)
    const d = new Date(r[dateC] ?? '')
    const publicSlug = importSlug(slugPart, title)
    // For subscribers only there (`only_paid`, `only_free`): a draft here, which has no paywall.
    const audience = audienceC >= 0 ? (r[audienceC] ?? '').trim() : ''
    const guarded = audience !== '' && audience !== 'everyone'
    if (guarded) locked++
    const isPublished = !guarded && (r[pubC] ?? '').toLowerCase() === 'true'
    posts.push({
      title,
      slug: uniqueSlug(publicSlug),
      date: Number.isNaN(d.getTime()) ? now : d.toISOString(),
      status: isPublished ? 'published' : 'draft',
      categories: [],
      tags: [],
      excerpt,
      content,
      // Substack serves every post at /p/<slug>. Only worth a redirect for a publication
      // that had its own domain — for the rest the row simply never fires. Medium gets
      // nothing: its old URLs live on medium.com, which will never point here.
      path: isPublished ? `/p/${publicSlug}` : undefined,
    })
  }
  return { posts, pages: [], skipped, locked }
}

// ---- Medium -------------------------------------------------------------------------------

export const isMedium = (entries: Entry[]): boolean =>
  entries.some((e) => /(?:^|\/)posts\/[^/]+\.html$/.test(e.name) && e.text.includes('class="h-entry"'))

// ⚠️ BY indexOf, NOT BY REGEX (2026-11-04). Each pattern here was `<tag[^>]*…>([\s\S]*?)</tag>`,
// and a regex tries it again from every place the tag could start, each try running to the end of
// the file: 200 KB of unclosed `<title>` took 2.5 s and 100 KB of `<` in a title 5.1 s, the whole
// process stalled meanwhile, and an entry may be 64 MiB. `finder` asks each needle once per stretch.

/** indexOf for rising starting points: asked from a point not past its last answer, it gives that one again. */
function finder(s: string, needle: string): (from: number) => number {
  let from = -1
  let found = -2
  return (at) => {
    if (found === -1 && at >= from) return -1
    if (found >= at && at >= from) return found
    from = at
    found = s.indexOf(needle, at)
    return found
  }
}

/**
 * What the first `<name…>` whose attributes pass `wants` holds, up to `</name>`; '' when there is none.
 * A start inside a tag that failed is skipped: its attributes are the tail of the ones that failed.
 */
function element(html: string, name: string, wants: (attrs: string) => boolean): string {
  const next = finder(html, `<${name}`)
  const gtAt = finder(html, '>')
  for (let at = next(0); at >= 0; at = next(at)) {
    const gt = gtAt(at)
    if (gt < 0) return ''
    if (wants(html.slice(at + name.length + 1, gt))) {
      const end = html.indexOf(`</${name}>`, gt + 1)
      return end < 0 ? '' : html.slice(gt + 1, end)
    }
    at = gt
  }
  return ''
}

/** Does a `class="…"` among these attributes list `token`? */
function hasClass(attrs: string, token: string): boolean {
  for (let at = attrs.indexOf('class="'); at >= 0; at = attrs.indexOf('class="', at + 1)) {
    const end = attrs.indexOf('"', at + 7)
    if (end < 0) return false
    if (attrs.slice(at + 7, end).includes(token)) return true
    at = end
  }
  return false
}

/** `datetime` of the first `<time>` with `class="dt-published"` before it. */
function publishedAt(html: string): string {
  const next = finder(html, '<time')
  const gtAt = finder(html, '>')
  for (let at = next(0); at >= 0; at = next(at)) {
    const gt = gtAt(at)
    const attrs = html.slice(at + 5, gt < 0 ? html.length : gt)
    const cls = attrs.indexOf('class="dt-published"')
    for (let dt = cls < 0 ? -1 : attrs.indexOf('datetime="', cls + 20); dt >= 0; dt = attrs.indexOf('datetime="', dt + 1)) {
      const value = at + 5 + dt + 10
      const end = html.indexOf('"', value)
      if (end < 0) return ''
      if (end > value) return html.slice(value, end)
    }
    if (gt < 0) return ''
    at = gt
  }
  return ''
}

// Tags out of a title, which is plain TEXT — stored as Markdown and escaped again on render. Each
// `<` goes with everything up to the next `>`, as `/<[^>]*>/g` did, and one pass is the fixpoint
// that pass was looped to: a `<` left over has no `>` after it, and removing text adds none (so
// `<scr<b>ipt>` leaves `ipt>`, never `<script>`). As a regex it was quadratic in the `<`s left over.
function stripTags(s: string): string {
  let out = ''
  let at = 0
  for (;;) {
    const lt = s.indexOf('<', at)
    const gt = lt < 0 ? -1 : s.indexOf('>', lt)
    if (gt < 0) return out + s.slice(at)
    out += s.slice(at, lt)
    at = gt + 1
  }
}

export function parseMedium(entries: Entry[], now: string): ImportResult {
  const uniqueSlug = slugTracker()
  const posts: ImportedPost[] = []
  let skipped = 0

  for (const e of entries) {
    const m = e.name.match(/(?:^|\/)posts\/([^/]+)\.html$/)
    if (!m) continue
    if (!e.text.includes('class="h-entry"')) { skipped++; continue }

    const title = decodeEntities(
      stripTags(element(e.text, 'h1', (attrs) => hasClass(attrs, 'p-name'))).trim()
      || element(e.text, 'title', () => true).trim(),
    ) || 'Untitled'

    // Drafts carry no publish time and their filenames start with `draft_`.
    const published = publishedAt(e.text)
    const isDraft = !published || /^draft_/.test(m[1]!)

    const section = element(e.text, 'section', (attrs) => attrs.includes('data-field="body"'))
    let content = htmlToMarkdown(section || e.text)
    // Medium repeats the title as the body's first heading; one copy is enough.
    // A prefix check, not a regex built from the title: one over about 1 MiB is "too large" to compile.
    const heading = /^#{1,4} /.exec(content)?.[0].length ?? 0
    if (heading && content.startsWith(`${title}\n`, heading)) content = content.slice(heading + title.length).replace(/^\n+/, '')

    const d = new Date(published)
    posts.push({
      title,
      slug: uniqueSlug(importSlug(m[1]!.replace(/^draft_/, '').replace(/_/g, '-').replace(/-[0-9a-f]{8,}$/, ''), title)),
      date: !isDraft && !Number.isNaN(d.getTime()) ? d.toISOString() : now,
      status: isDraft ? 'draft' : 'published',
      categories: [],
      tags: [],
      excerpt: deriveExcerpt(content),
      content,
    })
  }
  return { posts, pages: [], skipped }
}
