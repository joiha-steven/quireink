// READING A QUIRE INK BUNDLE — the other end of `server/export-md.ts`.
//
// Its reason for existing is not that anyone asked to move a blog from Quire Ink to Quire Ink.
// It is that an export whose losslessness is nobody's job is an export that quietly stops
// being lossless: a field added to a post next month is a field the writer starts emitting and
// nothing notices is unreadable. With a reader here, "everything survives the round trip" is a
// test that goes red, and it goes red in the same commit that broke it.
//
// PURE over unzipped entries, like the other three parsers in this folder: the route does the
// unzip and hands `{ name, text }` pairs in.
//
// THE YAML IT READS IS ONLY THE YAML WE WRITE. `export-md.ts` emits one spelling per type —
// a double-quoted scalar, a bare number, a bare boolean, a flow sequence of quoted scalars —
// and this reads exactly those and refuses anything else. That is a deliberate refusal to
// grow a YAML parser: a file this cannot read is skipped and counted, never half-understood.

import type { ImportedNote, ImportedPage, ImportedPost, ImportResult } from '@/import/convert'
import type { Entry } from '@/import/archive'

type Value = string | number | boolean | string[]

/** One double-quoted scalar, or null when the text is not one. */
function readQuoted(raw: string): string | null {
  if (raw.length < 2 || !raw.startsWith('"') || !raw.endsWith('"')) return null
  const body = raw.slice(1, -1)
  let out = ''
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]!
    if (ch !== '\\') {
      // An unescaped quote inside means the value ended early and the rest is something else.
      if (ch === '"') return null
      out += ch
      continue
    }
    const next = body[++i]
    if (next === 'n') out += '\n'
    else if (next === 't') out += '\t'
    else if (next === 'r') out += '\r'
    else if (next === '"') out += '"'
    else if (next === '\\') out += '\\'
    else if (next === 'u') {
      const hex = body.slice(i + 1, i + 5)
      if (!/^[0-9a-fA-F]{4}$/.test(hex)) return null
      out += String.fromCharCode(parseInt(hex, 16))
      i += 4
    } else return null
  }
  return out
}

function readValue(raw: string): Value | null {
  const v = raw.trim()
  if (v === 'true') return true
  if (v === 'false') return false
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v)
  if (v.startsWith('[') && v.endsWith(']')) {
    const inner = v.slice(1, -1).trim()
    if (inner === '') return []
    // Split on the commas BETWEEN scalars, not the ones inside them: a category called
    // "Books, read" is one item and a naive split makes it two.
    const items: string[] = []
    let at = 0
    while (at < inner.length) {
      if (inner[at] !== '"') return null
      let end = at + 1
      while (end < inner.length && !(inner[end] === '"' && inner[end - 1] !== '\\')) end++
      if (end >= inner.length) return null
      const one = readQuoted(inner.slice(at, end + 1))
      if (one === null) return null
      items.push(one)
      at = end + 1
      while (at < inner.length && (inner[at] === ',' || inner[at] === ' ')) at++
    }
    return items
  }
  return readQuoted(v)
}

export type Parsed = { fields: Record<string, Value>; body: string }

/**
 * The front matter and the body, or null when the file has no readable block.
 *
 * The opening fence must be the FIRST thing in the file. A `---` further down is a horizontal
 * rule in somebody's writing, and a reader that scans for one turns the middle of a post into
 * metadata.
 */
export function parseFrontMatter(text: string): Parsed | null {
  const normalized = text.replace(/\r\n/g, '\n')
  if (!normalized.startsWith('---\n')) return null
  const end = normalized.indexOf('\n---\n', 3)
  if (end === -1) return null
  const fields: Record<string, Value> = {}
  for (const line of normalized.slice(4, end + 1).split('\n')) {
    if (line.trim() === '') continue
    const colon = line.indexOf(': ')
    if (colon <= 0) return null
    const value = readValue(line.slice(colon + 2))
    if (value === null) return null
    fields[line.slice(0, colon)] = value
  }
  // The body is trimmed at BOTH ends, which is exactly what `export-md.ts` does on the way
  // out: it drops trailing whitespace and ends the file with one newline, because a text file
  // that does not end in a newline is a text file half the tools in the world complain about.
  // Reading that newline back as content would make the round trip add a line every pass.
  return { fields, body: normalized.slice(end + 5).replace(/^\n+/, '').replace(/\s+$/, '') }
}

const str = (f: Record<string, Value>, k: string): string | undefined =>
  typeof f[k] === 'string' ? f[k] : undefined
const list = (f: Record<string, Value>, k: string): string[] =>
  Array.isArray(f[k]) ? f[k] : []
const status = (f: Record<string, Value>): 'draft' | 'published' =>
  f.status === 'published' ? 'published' : 'draft'

/**
 * Is this our own bundle?
 *
 * STRUCTURAL, like the Substack and Medium sniffs beside it: a `site.json` AND at least one
 * Markdown file under one of the three folders. Either alone is somebody else's archive —
 * a folder of Markdown is what half the static site generators in the world produce, and
 * claiming those would mis-import them rather than refuse them honestly.
 */
export function isQuireInk(entries: Entry[]): boolean {
  const hasSettings = entries.some((e) => e.name === 'site.json' || e.name.endsWith('/site.json'))
  const hasWriting = entries.some((e) => /(^|\/)(posts|pages|notes)\/[^/]+\.md$/.test(e.name))
  return hasSettings && hasWriting
}

/** Which of the three folders a name sits in, ignoring any wrapper directory the ZIP added. */
const folderOf = (name: string): 'posts' | 'pages' | 'notes' | null => {
  const m = /(?:^|\/)(posts|pages|notes)\/[^/]+\.md$/.exec(name)
  return m ? (m[1] as 'posts' | 'pages' | 'notes') : null
}

export function parseQuireInk(entries: Entry[], now: string): ImportResult {
  const posts: ImportedPost[] = []
  const pages: ImportedPage[] = []
  const notes: ImportedNote[] = []
  let skipped = 0

  for (const entry of entries) {
    const folder = folderOf(entry.name)
    if (!folder) continue
    const parsed = parseFrontMatter(entry.text)
    // A file whose block will not read is COUNTED, not guessed at. The owner is told a number
    // and can go and look; a parser that shrugs produces a post with its metadata in the body.
    if (!parsed) { skipped += 1; continue }
    const f = parsed.fields
    const slug = str(f, 'slug') ?? ''
    const title = str(f, 'title') ?? ''
    if (!slug && !title) { skipped += 1; continue }

    if (folder === 'pages') {
      pages.push({
        title, slug, status: status(f), content: parsed.body,
        ...(str(f, 'featuredImage') ? { featuredImage: str(f, 'featuredImage') } : {}),
      })
    } else if (folder === 'notes') {
      notes.push({
        title, slug, date: str(f, 'date') ?? now, status: status(f), content: parsed.body,
        sourceUrl: str(f, 'sourceUrl'), sourceTitle: str(f, 'sourceTitle'), quote: str(f, 'quote'),
      })
    } else {
      posts.push({
        title, slug, date: str(f, 'date') ?? now, status: status(f),
        categories: list(f, 'categories'), tags: list(f, 'tags'),
        excerpt: str(f, 'excerpt') ?? '', content: parsed.body,
        // Every other field the export writes rides along untouched, which is what keeps the
        // round trip honest: a field dropped here is a field lost on the way home.
        ...(str(f, 'series') ? { series: str(f, 'series') } : {}),
        ...(typeof f.seriesOrder === 'number' ? { seriesOrder: f.seriesOrder } : {}),
        ...(str(f, 'coverImage') ? { coverImage: str(f, 'coverImage') } : {}),
        ...(str(f, 'featuredImage') ? { featuredImage: str(f, 'featuredImage') } : {}),
        ...(str(f, 'metaTitle') ? { metaTitle: str(f, 'metaTitle') } : {}),
        ...(str(f, 'metaDescription') ? { metaDescription: str(f, 'metaDescription') } : {}),
      })
    }
  }
  return { posts, pages, notes, skipped }
}
