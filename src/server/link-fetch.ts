// THE ONE PLACE THIS BLOG REACHES OUT FOR A LINK CARD, and it is a scheduled job rather than
// part of anybody's request.
//
// ADR 0058. A body that renders with a standalone link writes the URL down and returns; this
// takes the written-down rows, a few at a time, and reads each page once. The shape is the one
// `media/finalize.ts` already uses for image variants: the expensive half is not on the path
// that produced the work.
//
// ⚠️ A ROW IS FETCHED ONCE, EVER. There is no refresh, and that is a promise about how much this
// feature costs rather than an omission: a card that said something true when the owner linked
// it goes on saying it, and this blog does not quietly re-crawl a list of other people's pages
// every week on their behalf. Correcting one is deleting the row.

import { makeThumb } from '@/media/image'
import { uploadFile } from '@/media/blob'
import { fetchImageCapped } from '@/import/images'
import { readPageMeta, type Fetcher } from '@/server/link-meta'
import { pendingLinks, storeCard } from '@/content/link-cards'
import { clearCache } from '@/server/cache'
import { getSettings } from '@/content/settings'
import { createHash } from 'node:crypto'

/**
 * How many pages one tick reads.
 *
 * Small on purpose. The minute tick's character is "one indexed query when there is nothing
 * due", and a blog that has just imported four hundred posts should spend an hour catching up
 * rather than four hundred outbound requests in one second — which is what a stranger's server
 * would read as an attack, correctly.
 */
export const PER_TICK = 5

/**
 * The preview picture, brought home.
 *
 * ⚠️ NOT INTO THE LIBRARY. `addMedia` would put somebody else's og:image in the owner's own
 * media list, among their photographs, with a row and a variant set — fifty links would be
 * fifty things to scroll past that they never uploaded. This writes one small WebP straight to
 * the blob store under `cards/`, which the uploads route serves like any other path and the
 * backup carries like any other blob, and which nothing in the admin lists as the owner's work.
 *
 * ⚠️ AND IT IS BROUGHT HOME AT ALL because the reading side of this product loads nothing from
 * anybody else. A card that hotlinked its picture would put a third-party request, and a
 * third-party's view of who is reading this blog, on every page that carried a link.
 *
 * '' for every failure. A card with words and no picture is a good card; a broken image inside
 * one is not.
 */
async function bringPreviewHome(imageUrl: string): Promise<string> {
  try {
    const { body, contentType } = await fetchImageCapped(imageUrl)
    if (!contentType.startsWith('image/')) return ''
    // The library's own thumbnail size, 400px of WebP — a card's picture sits beside two lines
    // of text, and re-encoding is also what stops a 4 MB og:image being stored as one.
    const thumb = await makeThumb(Buffer.from(body))
    // Named for the SOURCE, so the same picture behind two links is written once and a re-fetch
    // of the same URL overwrites rather than accumulating.
    const name = createHash('sha256').update(imageUrl).digest('hex').slice(0, 24)
    return await uploadFile(`cards/${name}.webp`, thumb, 'image/webp')
  } catch {
    return ''
  }
}

/**
 * Read the pages nobody has read yet, and write down what they said.
 *
 * Returns how many CARDS were made — not how many rows were touched. A page that refused, timed
 * out or had no title is stored as a row that was tried, so it is never asked again, and it
 * changes nothing a reader sees: the paragraph stays the plain link it already was, which is
 * the same answer a row nobody has reached yet gives.
 */
export async function sweepLinkCards(limit = PER_TICK, fetcher?: Fetcher): Promise<number> {
  // ⚠️ THE SWITCH IS CHECKED HERE, WHERE THE REQUEST WOULD LEAVE. Noting a URL is free and
  // stays unconditional, so a blog that turns the feature on later already has its backlog and
  // fills in without anybody re-saving a post — but a blog with it OFF must not be fetching
  // other people's pages on a timer. Reaching out is the whole of what this switch controls.
  if (!(await getSettings()).features.bookmarkCards) return 0
  const urls = pendingLinks(limit)
  if (urls.length === 0) return 0
  let made = 0
  for (const url of urls) {
    try {
      const meta = await readPageMeta(url, fetcher)
      if (!meta) {
        storeCard(url, null)
        continue
      }
      const image = meta.image ? await bringPreviewHome(meta.image) : ''
      storeCard(url, { ...meta, image })
      made += 1
    } catch (error) {
      // One bad URL must not stop the other four, and it must not be retried forever either.
      storeCard(url, null)
      console.error(`[ERROR] link-card ${url}: ${(error as Error).message}`)
    }
  }
  // Only when something actually became a card. A row that was tried and yielded nothing is not
  // in any body's cache key, so flushing for it would throw the page cache away to change
  // nothing — and this runs every minute.
  if (made > 0) clearCache()
  return made
}
