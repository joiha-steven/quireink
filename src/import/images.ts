// Bring remote images home: find every image a post or page still loads from another
// host, fetch it through the SSRF guard, add it to the media library, and rewrite the
// references. This is the missing half of a move — every importer converts the words
// and leaves the pictures where they were, which reads fine right up until the old
// host is switched off.
//
// The importers stay PURE parsers on purpose (see wordpress.ts); this module is the
// I/O half, and it deliberately keeps NO import-time state. Each call re-reads the
// content and asks "what is still remote?", which buys three things at once: the work
// happens in small batches (a photo blog can point at hundreds of images on a slow
// host, and fetching them all inside one upload request lets some proxy's read timeout
// decide how the story ends), a crash mid-way loses nothing (the untouched posts still
// point at URLs that still work), and a blog imported before this module existed is
// served exactly as well as one imported today.
//
// The admin client and the MCP tool both call it in a loop: each call moves up to
// `IMAGE_BATCH` images and reports how many remain. A caller should stop when
// `remaining` is 0 — or when a call moves nothing, which means what is left is only
// failures and retrying them buys the same errors again.

import { readEnv } from '@/env'
import { getIndex, getPost, savePost } from '@/content/posts'
import { getPageIndex, getPage, savePage } from '@/content/pages'
import { addMedia } from '@/media/media'
import { checkUpload, readCapped, uploadLimits } from '@/media/limits'
import { finalizeContentMedia } from '@/media/finalize'
import { safeFetch, BlockedUrlError } from '@/server/safe-fetch'
import { clearCache } from '@/server/cache'
import type { PostWithContent, PageWithContent } from '@/types'

export const IMAGE_BATCH = 5

/** Filename from a URL's last path segment (fallback when none is usable). */
export function filenameFromUrl(url: string): string {
  try {
    const name = new URL(url).pathname.split('/').filter(Boolean).pop()
    return name || 'image'
  } catch {
    return 'image'
  }
}

// ---- finding the remote references ---------------------------------------------------

// Where an image URL can live in markdown: an image target `![alt](URL)` — possibly
// carrying our own `#grid` tag, which belongs to the renderer and not to the fetch —
// and a raw `src="URL"` on inline HTML. A plain LINK `[text](URL)` is left alone even
// when it points at a picture: linking out is something an author does on purpose.
const MD_IMAGE_RE = /!\[[^\]]*\]\(\s*(https?:\/\/[^)\s#]+)/g
const HTML_SRC_RE = /src=["'](https?:\/\/[^"'#]+)/g

function hostOf(url: string): string | null {
  try {
    return new URL(url).host
  } catch {
    return null
  }
}

/** Absolute image URLs in one markdown body that point at some OTHER host, in order. */
export function remoteImageUrls(content: string, ownHost: string | null): string[] {
  const found: string[] = []
  for (const re of [MD_IMAGE_RE, HTML_SRC_RE]) {
    for (const m of content.matchAll(re)) {
      const url = m[1]!
      if (ownHost !== null && hostOf(url) === ownHost) continue
      found.push(url)
    }
  }
  return found
}

/**
 * Replace `from` with `to` wherever `from` is a WHOLE URL — followed by a delimiter or
 * the end, never mid-URL. A bare `replaceAll` would also rewrite the inside of a longer
 * URL that happens to start with this one (`…/photo.jpg` inside `…/photo.jpg.webp`).
 */
export function rewriteUrl(text: string, from: string, to: string): string {
  const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text.replace(new RegExp(`${escaped}(?=[)\\s"'#]|$)`, 'g'), to)
}

// ---- fetching one image within the limits --------------------------------------------

export type FetchedImage = { body: ArrayBuffer; contentType: string }

/**
 * Fetch one image, refusing everything the upload path refuses. The same three guards
 * as the MCP `add_media_from_url` tool, which shaped them first: the SSRF check
 * (outbound fetches are the one byte path no reverse proxy can see), the per-file cap
 * enforced WHILE reading, and the storage quota. Throws with a sentence — the report
 * carries it to the admin as-is.
 */
export async function fetchImageCapped(url: string): Promise<FetchedImage> {
  let res: Response
  try {
    res = await safeFetch(url)
  } catch (error) {
    if (error instanceof BlockedUrlError) throw new Error('URL is not allowed')
    throw new Error('could not fetch')
  }
  if (!res.ok) throw new Error(`fetch failed (${res.status})`)
  const contentType = res.headers.get('content-type')?.split(';')[0]?.trim() ?? ''
  const { maxFileBytes } = await uploadLimits()
  const read = await readCapped(res, maxFileBytes)
  if ('tooLarge' in read) throw new Error(`larger than the ${read.limit}-byte upload limit`)
  const refusal = await checkUpload([read.body.byteLength])
  if (refusal !== null) {
    throw new Error(refusal.reason === 'quota_exceeded' ? 'storage quota reached' : `larger than the ${refusal.limit}-byte upload limit`)
  }
  return { body: read.body, contentType }
}

// ---- one batch -----------------------------------------------------------------------

export type HomeReport = {
  /** Distinct remote image URLs the scan found. */
  found: number
  /** Fetched, stored and rewritten by THIS call. */
  moved: number
  /** Still remote after this call — failures included, so a caller that keeps seeing `moved: 0` should stop. */
  remaining: number
  failed: { url: string; reason: string }[]
}

type Doc =
  | { kind: 'post'; doc: PostWithContent }
  | { kind: 'page'; doc: PageWithContent }

function docUrls(d: Doc, ownHost: string | null): string[] {
  const urls = remoteImageUrls(d.doc.content, ownHost)
  for (const field of [d.doc.featuredImage, d.kind === 'post' ? d.doc.coverImage : undefined]) {
    if (field && /^https?:\/\//.test(field) && (ownHost === null || hostOf(field) !== ownHost)) urls.push(field)
  }
  return urls
}

async function liveDocs(): Promise<Doc[]> {
  const docs: Doc[] = []
  for (const meta of await getIndex()) {
    const doc = await getPost(meta.slug)
    if (doc) docs.push({ kind: 'post', doc })
  }
  for (const meta of await getPageIndex()) {
    const doc = await getPage(meta.slug)
    if (doc) docs.push({ kind: 'page', doc })
  }
  return docs
}

type Fetcher = (url: string) => Promise<FetchedImage>

/**
 * Move up to `limit` remote images into the media library and point their references at
 * the stored copies. Documents touched in this batch are saved ONCE each (through the
 * ordinary save path, so the previous version lands in the time machine), and the page
 * cache is emptied when anything changed — Invariant 1 knows no partial flush.
 */
export async function bringImagesHome(limit = IMAGE_BATCH, fetcher: Fetcher = fetchImageCapped): Promise<HomeReport> {
  const ownHost = hostOf(readEnv().siteUrl)
  const docs = await liveDocs()

  // Distinct URLs in first-seen order, so a caller's loop walks the same queue the
  // whole way through and every batch takes the head of what is left.
  const queue: string[] = []
  const seen = new Set<string>()
  for (const d of docs) {
    for (const url of docUrls(d, ownHost)) {
      if (!seen.has(url)) {
        seen.add(url)
        queue.push(url)
      }
    }
  }

  const failed: HomeReport['failed'] = []
  const stored = new Map<string, string>() // remote URL -> stored URL
  for (const url of queue.slice(0, limit)) {
    try {
      const image = await fetcher(url)
      const item = await addMedia(filenameFromUrl(url), image.body, image.contentType)
      stored.set(url, item.url)
    } catch (error) {
      failed.push({ url, reason: (error as Error).message })
    }
  }

  // Apply every successful move to every document that references it, then save each
  // touched document once — a post with five images in this batch gets one revision,
  // not five.
  for (const d of docs) {
    let { content } = d.doc
    let featuredImage = d.doc.featuredImage
    let coverImage = d.kind === 'post' ? d.doc.coverImage : undefined
    for (const [from, to] of stored) {
      content = rewriteUrl(content, from, to)
      if (featuredImage === from) featuredImage = to
      if (coverImage === from) coverImage = to
    }
    const changed = content !== d.doc.content || featuredImage !== d.doc.featuredImage
      || (d.kind === 'post' && coverImage !== d.doc.coverImage)
    if (!changed) continue
    if (d.kind === 'post') {
      await savePost({ ...d.doc, content, featuredImage, coverImage }, d.doc.slug)
    } else {
      await savePage({ ...d.doc, content, featuredImage }, d.doc.slug)
    }
    // Same nudge the admin save gives: variants for the newly stored images render on
    // the next tick instead of the next hour. Fire-and-forget by design.
    void finalizeContentMedia(content, featuredImage).catch((error) => {
      console.error(`[ERROR] bringImagesHome finalize: ${(error as Error).message}`)
    })
  }
  if (stored.size > 0) clearCache()

  return { found: queue.length, moved: stored.size, remaining: queue.length - stored.size, failed }
}
