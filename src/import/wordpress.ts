// Parse a WordPress export (WXR .xml) into Quire Ink posts + pages. PURE — no I/O; the
// API route (api/import/wordpress) persists the result via savePost/savePage. Each
// post's HTML body is converted to Markdown (turndown + GFM), and categories, tags,
// dates, status and excerpt are preserved. Image URLs are kept as-is (they point at
// the source site) — the importer does not download/rehost binaries.
//
// The Markdown pipe, the entity decoder and the slug allocator moved to `convert.ts`
// on 2026-08-23, when Ghost, Substack and Medium arrived and would otherwise each have
// carried a hand copy. This file keeps only what is WordPress: WXR's field names, its
// zero dates, and its shortcode habits (handled inside the shared cleanup).

import { XMLParser } from 'fast-xml-parser'
import {
  makeTurndown, htmlToMarkdown, slugTracker, decodeEntities, deriveExcerpt,
  type ImportedPost, type ImportedPage, type ImportResult,
} from '@/import/convert'
import { slugify } from '@/utils'

export type { ImportedPost, ImportedPage }
export type WxrResult = ImportResult

// ---- WXR field helpers (the parser yields untyped nodes) --------------------

function asArray(v: unknown): unknown[] {
  return v == null ? [] : Array.isArray(v) ? v : [v]
}
function raw(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'object') {
    const t = (v as Record<string, unknown>)['#text']
    return t == null ? '' : String(t)
  }
  return String(v)
}
const text = (v: unknown): string => decodeEntities(raw(v))

// The path of the item's public URL. Only a PUBLISHED item ever had one — WordPress
// fills <link> on drafts with a ?p=123 guess that nothing ever linked to — and the
// domain half is dropped on purpose: a redirect only matters once the old domain
// points at this blog, and then only the path identifies the page.
function oldPath(link: unknown, published: boolean): string | undefined {
  if (!published) return undefined
  try {
    const path = new URL(text(link)).pathname
    return path && path !== '/' ? path : undefined
  } catch {
    return undefined
  }
}

function toIso(wpDate: unknown, fallback: string): string {
  const s = text(wpDate)
  if (!s || s.startsWith('0000')) return fallback
  const d = new Date(s.replace(' ', 'T') + 'Z')
  return Number.isNaN(d.getTime()) ? fallback : d.toISOString()
}

// ---- parse ------------------------------------------------------------------

export function parseWxr(xml: string, now: string): WxrResult {
  const td = makeTurndown()
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', trimValues: false })
  const doc = parser.parse(xml) as { rss?: { channel?: { item?: unknown } } }
  const items = asArray(doc?.rss?.channel?.item) as Record<string, unknown>[]

  const uniqueSlug = slugTracker()

  const posts: ImportedPost[] = []
  const pages: ImportedPage[] = []
  let skipped = 0

  for (const item of items) {
    const type = text(item['wp:post_type'])
    const status = text(item['wp:status'])
    if ((type !== 'post' && type !== 'page') || !['publish', 'draft', 'pending', 'private'].includes(status)) {
      skipped++
      continue
    }
    const title = text(item.title).trim() || 'Untitled'
    const slug = uniqueSlug(slugify(text(item['wp:post_name']) || title))
    const html = raw(item['content:encoded'])
    const body = htmlToMarkdown(td, html)
    const mappedStatus = status === 'publish' ? 'published' : 'draft'
    const path = oldPath(item.link, mappedStatus === 'published')

    if (type === 'page') {
      pages.push({ title, slug, status: mappedStatus, content: body, path })
      continue
    }

    const cats: string[] = []
    const tags: string[] = []
    for (const c of asArray(item.category)) {
      const label = text(c).trim()
      if (!label) continue
      const domain = (c as Record<string, unknown>)['@_domain']
      if (domain === 'post_tag') tags.push(label)
      else if (domain === 'category' && label.toLowerCase() !== 'uncategorized') cats.push(label)
    }
    posts.push({
      title,
      slug,
      // WordPress leaves `post_date_gmt` as "0000-00-00 00:00:00" on posts that were never
      // published, so `??` would take that zero date and every draft would import dated
      // today. Fall back to the local `post_date`, which WordPress does fill in. It carries
      // no zone, so it is read as UTC — off by the site's offset, but a draft keeping its
      // real month is worth more than the hours.
      date: toIso(item['wp:post_date_gmt'], toIso(item['wp:post_date'], now)),
      status: mappedStatus,
      categories: [...new Set(cats)],
      tags: [...new Set(tags)],
      excerpt: text(item['excerpt:encoded']).trim() || deriveExcerpt(body),
      content: body,
      path,
    })
  }
  return { posts, pages, skipped }
}
