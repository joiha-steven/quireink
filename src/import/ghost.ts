// Parse a Ghost export (.json) into Quire Ink posts + pages. PURE — no I/O, like the
// WordPress parser beside it.
//
// Ghost's export is one JSON document: `{ db: [{ data: {...} }] }` from the Labs export
// button, or the bare `{ data: {...} }` some tools produce — both shapes are read. Pages
// live in the same `posts` array wearing `type: 'page'`, tags arrive as a join table
// (`posts_tags` → `tags`), and the body is `html`. Ghost also stores lexical/mobiledoc
// source, but `html` is present on every export and is the one rendering truth.

import {
  htmlToMarkdown, slugTracker, deriveExcerpt,
  type ImportedPost, type ImportedPage, type ImportResult,
} from '@/import/convert'
import { slugify } from '@/utils'

type GhostPost = Record<string, unknown>

function data(doc: unknown): Record<string, unknown> | null {
  const j = doc as Record<string, any>
  const d = j?.db?.[0]?.data ?? j?.data
  return d && typeof d === 'object' ? d as Record<string, unknown> : null
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

function toIso(v: unknown, fallback: string): string {
  // Ghost writes ISO strings; very old exports wrote epoch milliseconds.
  if (typeof v === 'number') return new Date(v).toISOString()
  const s = str(v)
  if (!s) return fallback
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? fallback : d.toISOString()
}

/** True when this is plausibly a Ghost export — the route's cheap shape check. */
export function looksLikeGhost(json: unknown): boolean {
  const d = data(json)
  return Array.isArray(d?.posts)
}

export function parseGhost(doc: unknown, now: string): ImportResult {
  const d = data(doc)
  if (!d) return { posts: [], pages: [], skipped: 0 }

  // The tag join: posts_tags rows carry sort_order, and the FIRST tag is what Ghost
  // shows as the post's primary tag — it becomes the category here, the rest stay tags.
  const tagName = new Map<unknown, string>()
  for (const t of (d.tags as GhostPost[] | undefined) ?? []) {
    const name = str(t.name).trim()
    if (name) tagName.set(t.id, name)
  }
  const tagsOf = new Map<unknown, string[]>()
  const joins = ((d.posts_tags as GhostPost[] | undefined) ?? [])
    .slice()
    .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
  for (const j of joins) {
    const name = tagName.get(j.tag_id)
    if (!name) continue
    const list = tagsOf.get(j.post_id) ?? []
    list.push(name)
    tagsOf.set(j.post_id, list)
  }

  const uniqueSlug = slugTracker()
  const posts: ImportedPost[] = []
  const pages: ImportedPage[] = []
  let skipped = 0

  for (const p of (d.posts as GhostPost[] | undefined) ?? []) {
    const status = str(p.status)
    // 'sent' is a Ghost email-only post that WAS delivered — published, in our terms.
    // 'scheduled' stays scheduled: published here with its future date, which is what a
    // schedule IS on this blog. It came in as a draft, while WordPress's 'future' was dropped
    // outright; the two importers now agree (2026-09-30).
    if (!['published', 'draft', 'scheduled', 'sent'].includes(status)) {
      skipped++
      continue
    }
    const title = str(p.title).trim() || 'Untitled'
    const slug = uniqueSlug(slugify(str(p.slug) || title))
    // A post Ghost kept only as lexical (`html: null`) imported with an EMPTY body; its words
    // come from the lexical tree when there is no HTML.
    const body = str(p.html) ? htmlToMarkdown(str(p.html)) : lexicalToMarkdown(str(p.lexical))
    const published = status === 'published' || status === 'sent' || status === 'scheduled'
    // The featured image was never mapped, so every post lost it (2026-09-30).
    const featuredImage = str(p.feature_image) || undefined

    if (str(p.type) === 'page') {
      pages.push({ title, slug, status: published ? 'published' : 'draft', content: body, ...(featuredImage ? { featuredImage } : {}) })
      continue
    }

    const [category, ...tags] = tagsOf.get(p.id) ?? []
    posts.push({
      title,
      slug,
      date: toIso(p.published_at, toIso(p.created_at, now)),
      status: published ? 'published' : 'draft',
      categories: category ? [category] : [],
      tags: [...new Set(tags)],
      excerpt: str(p.custom_excerpt).trim() || deriveExcerpt(body),
      content: body,
      ...(featuredImage ? { featuredImage } : {}),
    })
  }
  return { posts, pages, skipped }
}

/**
 * The words of a Ghost lexical document, as Markdown paragraphs and headings. Not a full
 * converter: it is the fallback for a post that has no `html`, and keeping its text with its
 * headings is the difference between an import and an empty page.
 */
export function lexicalToMarkdown(source: string): string {
  let root: { root?: { children?: unknown[] } }
  try { root = JSON.parse(source) } catch { return '' }
  const text = (node: unknown): string => {
    const n = node as { text?: unknown; children?: unknown[]; type?: string }
    if (typeof n?.text === 'string') return n.text
    if (n?.type === 'linebreak') return '\n'
    return (n?.children ?? []).map(text).join('')
  }
  return (root.root?.children ?? []).map((node) => {
    const n = node as { type?: string; tag?: string; listType?: string; children?: unknown[] }
    const words = text(node).trim()
    if (!words) return ''
    if (n.type === 'heading') return `${'#'.repeat(Math.min(6, Number(n.tag?.slice(1)) || 2))} ${words}`
    if (n.type === 'quote') return `> ${words}`
    if (n.type === 'list') return (n.children ?? []).map((li) => `- ${text(li).trim()}`).join('\n')
    return words
  }).filter(Boolean).join('\n\n')
}
