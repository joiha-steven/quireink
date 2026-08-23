// Parse a Substack or Medium export — both arrive as a ZIP of HTML files — into Quire
// Ink posts. PURE over unzipped entries: the route does the unzip (fflate) and hands
// `{ name, text }` pairs in, so these parsers stay I/O-free like the other two.
//
// Sniffing is structural, not by filename: a Substack zip has `posts.csv` beside a
// `posts/` folder; a Medium zip has `posts/*.html` whose markup wears Medium's own
// class names. The owner uploads "my export" and the server works out whose it is.

import {
  makeTurndown, htmlToMarkdown, slugTracker, decodeEntities, deriveExcerpt,
  type ImportedPost, type ImportResult,
} from '@/import/convert'
import { slugify } from '@/utils'

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
  const [idC, dateC, pubC, titleC, subC, typeC] =
    ['post_id', 'post_date', 'is_published', 'title', 'subtitle', 'type'].map(col)

  const html = new Map<string, string>()
  for (const e of entries) {
    const m = e.name.match(/(?:^|\/)posts\/([^/]+)\.html$/)
    if (m) html.set(m[1]!, e.text)
  }

  const uniqueSlug = slugTracker()
  const td = makeTurndown()
  const posts: ImportedPost[] = []
  let skipped = 0

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
    const content = htmlToMarkdown(td, body)
    const excerpt = decodeEntities((r[subC] ?? '').trim()) || deriveExcerpt(content)
    const d = new Date(r[dateC] ?? '')
    posts.push({
      title,
      slug: uniqueSlug(slugify(slugPart) || slugify(title)),
      date: Number.isNaN(d.getTime()) ? now : d.toISOString(),
      status: (r[pubC] ?? '').toLowerCase() === 'true' ? 'published' : 'draft',
      categories: [],
      tags: [],
      excerpt,
      content,
    })
  }
  return { posts, pages: [], skipped }
}

// ---- Medium -------------------------------------------------------------------------------

export const isMedium = (entries: Entry[]): boolean =>
  entries.some((e) => /(?:^|\/)posts\/[^/]+\.html$/.test(e.name) && e.text.includes('class="h-entry"'))

const first = (html: string, re: RegExp): string => html.match(re)?.[1] ?? ''

export function parseMedium(entries: Entry[], now: string): ImportResult {
  const uniqueSlug = slugTracker()
  const td = makeTurndown()
  const posts: ImportedPost[] = []
  let skipped = 0

  for (const e of entries) {
    const m = e.name.match(/(?:^|\/)posts\/([^/]+)\.html$/)
    if (!m) continue
    if (!e.text.includes('class="h-entry"')) { skipped++; continue }

    const title = decodeEntities(
      first(e.text, /<h1[^>]*class="[^"]*p-name[^"]*"[^>]*>([\s\S]*?)<\/h1>/).replace(/<[^>]+>/g, '').trim()
      || first(e.text, /<title[^>]*>([\s\S]*?)<\/title>/).trim(),
    ) || 'Untitled'

    // Drafts carry no publish time and their filenames start with `draft_`.
    const published = first(e.text, /<time[^>]*class="dt-published"[^>]*datetime="([^"]+)"/)
    const isDraft = !published || /^draft_/.test(m[1]!)

    const section = first(e.text, /<section[^>]*data-field="body"[^>]*>([\s\S]*?)<\/section>/)
    let content = htmlToMarkdown(td, section || e.text)
    // Medium repeats the title as the body's first heading; one copy is enough.
    const esc = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    content = content.replace(new RegExp(`^#{1,4} ${esc}\\n+`), '')

    const d = new Date(published)
    posts.push({
      title,
      slug: uniqueSlug(slugify(m[1]!.replace(/^draft_/, '').replace(/_/g, '-').replace(/-[0-9a-f]{8,}$/, '')) || slugify(title)),
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
