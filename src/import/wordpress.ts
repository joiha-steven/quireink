// Parse a WordPress export (WXR .xml) into Quire Ink posts + pages. PURE — no I/O; the
// API route (api/import/wordpress) persists the result via savePost/savePage. Each
// post's HTML body is converted to Markdown (`html-parse.ts` then `html-to-md.ts`), and tags,
// dates, status and excerpt are preserved. Image URLs point at the source site (a resized copy
// swapped for the original the export names, `fullSize`); `images.ts` brings them home later.
//
// The Markdown pipe, the entity decoder and the slug allocator moved to `convert.ts`
// on 2026-08-23, when Ghost, Substack and Medium arrived and would otherwise each have
// carried a hand copy. This file keeps only what is WordPress: WXR's field names, its
// zero dates, and its shortcode habits (handled inside the shared cleanup).

import { parseXml } from '@/import/xml'
import {
  htmlToMarkdown, importSlug, slugTracker, decodeEntities, deriveExcerpt,
  type ImportedPost, type ImportedPage, type ImportResult,
} from '@/import/convert'

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

// ---- the original of a resized picture --------------------------------------

// WordPress names the copies it cuts `<name>-<w>x<h>.<ext>` and puts one of them in the post, so
// the picture brought home was the column-wide `photo-1024x683.jpg` (2026-11-03). The original is
// named by the export itself, as an attachment's URL (`-scaled` when WordPress capped a large
// upload) or in the same image's `srcset`, and only a name the export lists is ever used: a file
// that is merely CALLED `banner-468x60.png` has no other file behind it.
const RESIZED = /(https?:\/\/[^\s"'<>()]+?)-\d+x\d+(\.[a-z0-9]+)(?=[\s"',?#)]|$)/gi

function fullSize(html: string, attachments: ReadonlySet<string>): string {
  const listed = new Set(attachments)
  for (const m of html.matchAll(/\bsrcset=["']([^"']*)["']/gi)) {
    for (const candidate of m[1]!.split(',')) {
      const url = candidate.trim().split(/\s+/)[0]
      if (url) listed.add(url)
    }
  }
  return html.replace(RESIZED, (whole: string, stem: string, ext: string) =>
    [`${stem}${ext}`, `${stem}-scaled${ext}`].find((url) => listed.has(url)) ?? whole)
}

// ---- parse ------------------------------------------------------------------

export function parseWxr(xml: string, now: string): WxrResult {
  const doc = parseXml(xml) as { rss?: { channel?: { item?: unknown } } }
  const items = asArray(doc?.rss?.channel?.item) as Record<string, unknown>[]

  const uniqueSlug = slugTracker()
  const attachments = new Set(items
    .filter((item) => text(item['wp:post_type']) === 'attachment')
    .map((item) => text(item['wp:attachment_url']).trim())
    .filter(Boolean))

  const posts: ImportedPost[] = []
  const pages: ImportedPage[] = []
  let skipped = 0
  let locked = 0

  for (const item of items) {
    const type = text(item['wp:post_type'])
    const status = text(item['wp:status'])
    // 'future' is WordPress's scheduled post: published here with its future date, which is what
    // a schedule is on this blog. It was dropped with nothing said but a count (2026-09-30).
    if ((type !== 'post' && type !== 'page') || !['publish', 'future', 'draft', 'pending', 'private'].includes(status)) {
      skipped++
      continue
    }
    const title = text(item.title).trim() || 'Untitled'
    const slug = uniqueSlug(importSlug(text(item['wp:post_name']), title))
    const html = raw(item['content:encoded'])
    const body = htmlToMarkdown(fullSize(html, attachments))
    // Behind a password there: a draft here, which has no password to put on it (`locked`).
    const guarded = text(item['wp:post_password']).trim() !== ''
    if (guarded) locked++
    const mappedStatus = !guarded && (status === 'publish' || status === 'future') ? 'published' : 'draft'
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
  return { posts, pages, skipped, locked }
}
