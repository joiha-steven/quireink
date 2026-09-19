// WHAT THE BLOG HOLDS: a post, a page, a note, a picture, a file.
//
// Split out of `types.ts` on 2026-09-19, when that file reached its 400-line ceiling. The seam
// is the one `types-settings.ts` was already cut on: everything here is a thing the owner
// WROTE or UPLOADED, and what is left there is how the blog is configured to show it.
//
// `SiteLang` comes with them rather than staying behind, because a post now names the language
// it is written in (ADR 0056) — and a type this file needs from the file that re-exports it is
// a cycle, which TypeScript tolerates and a reader should not have to.

export type SiteLang = 'vi' | 'en' | 'de' | 'ja' | 'zh' | 'ko' | 'fr' | 'es' | 'pt' | 'it' | 'ru'

export type PostStatus = 'draft' | 'published'

// Frontmatter + metadata for a single post.
// Stored as YAML frontmatter inside posts/{slug}.md and mirrored in _index.json.
export type Post = {
  title: string
  slug: string // custom URL, auto-generated from title if empty
  date: string // ISO 8601, past/present/future all valid
  status: PostStatus
  categories: string[]
  tags: string[]
  featuredImage?: string // stored image URL; used only for SEO/social meta, never shown
  excerpt?: string // auto-extracted from first paragraph if empty
  readingMinutes?: number // estimated read time, computed from the body at save (for lists)
  series?: string // optional series/collection name this post belongs to (undefined = none)
  seriesOrder?: number // position within the series (ascending); undefined when no series
  metaTitle?: string // SEO <title> override (else the post title)
  metaDescription?: string // SEO description/OG override (else the excerpt)
  coverImage?: string // visible hero image shown at the top of the post
  updatedAt?: string // ISO 8601 of the last save; surfaces "Updated" + JSON-LD dateModified
  deletedAt?: string // ISO 8601; set only on trashed (soft-deleted) rows, else undefined
  // The language this piece is WRITTEN in, and an opaque id its translations share. Undefined
  // lang = the site's language, and the two are different facts: `content/translations.ts`
  // and ADR 0056 both turn on the distinction.
  lang?: SiteLang
  translationGroup?: string
}

// Full post = metadata + markdown body.
export type PostWithContent = Post & {
  content: string
}

// A snapshot of a post taken right before it was overwritten. Up to 3 are kept
// per slug at revisions/{slug}.json so the editor's "time machine" can restore
// recently-overwritten versions.
export type PostRevision = PostWithContent & {
  savedAt: string // ISO 8601, when the snapshot was taken
}

// A static page (About, Contact...). Like a post but with no taxonomy or date:
// not part of the feed, only reachable directly at /page/{slug}.
export type Page = {
  title: string
  slug: string
  status: PostStatus
  featuredImage?: string // stored image URL; used only for SEO/social meta, never shown
  updatedAt?: string // ISO 8601 of the last save; the admin's one list sorts on it
  deletedAt?: string // ISO 8601; set only on trashed (soft-deleted) rows, else undefined
  /** Same pair as `Post`, same rule (ADR 0056). */
  lang?: SiteLang
  translationGroup?: string
}

// Full page = metadata + markdown body.
export type PageWithContent = Page & {
  content: string
}

/**
 * A note: written like a post, kept apart from the posts (ADR 0044). Its own table, its own
 * URL space (`/notes/{slug}`), never in the post feed. The `source*` fields are what a CLIP
 * carries — a passage kept from somewhere else — and are absent on a note the owner wrote.
 */
export type Note = {
  title: string
  slug: string
  date: string // ISO 8601; a note has its own date, so a notebook reads in order
  status: PostStatus
  sourceUrl?: string // where a clipped passage came from
  sourceTitle?: string // the title of that page, as it was when clipped
  quote?: string // the passage itself, verbatim
  updatedAt?: string // ISO 8601 of the last save
  deletedAt?: string // ISO 8601; set only on trashed rows
}

export type NoteWithContent = Note & {
  content: string
}

// One entry in media/_index.json.
export type MediaItem = {
  url: string // ORIGINAL (uncompressed) — stored store-relative, absolute on read
  filename: string
  size: number // bytes of the original
  uploadedAt: string // ISO 8601
  width?: number // original pixel dimensions (raster only)
  height?: number
  thumb?: string // library thumbnail — store-relative, absolute on read
  variants?: boolean // true if responsive -1024/-1600 (avif+webp) were generated
  alt?: string // AI-suggested or owner-edited description; the editor's default alt
  deletedAt?: string // ISO 8601; set only on trashed (soft-deleted) rows, else undefined
}

// A non-image file in the "Files" library (PDF, zip, docx, audio…). Stored under
// `files/` in the local store with its own manifest, separate from the image media library.
export type FileItem = {
  url: string // store-relative, absolute on read
  filename: string // display name (original upload name)
  size: number // bytes
  contentType: string // MIME type as uploaded
  uploadedAt: string // ISO 8601
  deletedAt?: string // ISO 8601; set only on trashed (soft-deleted) rows, else undefined
}

// Site-wide settings, stored at settings/site.json.
/**
 * The four dialects the public site can be dressed in. A closed list rather than a theme
 * store on purpose: each one has to reach a group of writers that would otherwise not use
 * this software, and three is the ceiling agreed with it ('plain' is the absence of one).
 */
