// Parse a Ghost export (.json) into Quire Ink posts + pages. PURE — no I/O, like the
// WordPress parser beside it.
//
// Ghost's export is one JSON document: `{ db: [{ data: {...} }] }` from the Labs export
// button, or the bare `{ data: {...} }` some tools produce — both shapes are read. Pages
// live in the same `posts` array wearing `type: 'page'`, tags arrive as a join table
// (`posts_tags` → `tags`), and the body is `html`. Ghost also stores lexical/mobiledoc
// source, but `html` is present on every export and is the one rendering truth.

import {
  makeTurndown, htmlToMarkdown, slugTracker, deriveExcerpt,
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
  const td = makeTurndown()
  const posts: ImportedPost[] = []
  const pages: ImportedPage[] = []
  let skipped = 0

  for (const p of (d.posts as GhostPost[] | undefined) ?? []) {
    const status = str(p.status)
    // 'sent' is a Ghost email-only post that WAS delivered — published, in our terms.
    // 'scheduled' has not happened yet and imports as a draft the owner can re-schedule.
    if (!['published', 'draft', 'scheduled', 'sent'].includes(status)) {
      skipped++
      continue
    }
    const title = str(p.title).trim() || 'Untitled'
    const slug = uniqueSlug(slugify(str(p.slug) || title))
    const body = htmlToMarkdown(td, str(p.html))
    const published = status === 'published' || status === 'sent'

    if (str(p.type) === 'page') {
      pages.push({ title, slug, status: published ? 'published' : 'draft', content: body })
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
    })
  }
  return { posts, pages, skipped }
}
