// Twelve public-domain artworks for the media library, committed rather than drawn.
//
// The six plates in `seed-media.ts` are geometry because sharp cannot be trusted with
// `<text>` on the demo box. These are photographs of real pages and real paint, so they are
// committed as JPEG bytes under `scripts/art/` and uploaded through the same path an author's
// own photo takes. Downloading them at seed time was rejected for the same reason the plates
// are drawn: `refresh.sh` runs on a 1 GB server whose network is not part of the contract,
// and a reseed that needs Wikimedia to be up is a reseed that will one day wipe the library
// and refill half of it.
//
// EVERY WORK IS OUT OF COPYRIGHT, and that is a constraint, not a coincidence. Van Gogh died
// in 1890, Hokusai in 1849, the Kells folio is twelve centuries old and the Gutenberg page
// five; the reproductions are flat scans of two-dimensional pages, which acquire no new
// rights of their own. A Picasso — dead 1973, rights running to 2044 in most of the world —
// cannot be in this list, however famous.
//
// ON SUBJECT, still. The fixture's rule is letterforms and the making of pages, and each of
// these earns its place under it: Van Gogh's letters are the reed pen at work and his
// paintings are what the letters were about; Hokusai's prints are the woodblock press run
// the Printing category keeps describing; Kells is the half-uncial hand the calligraphy
// posts teach; the Gutenberg page is where the Printing category's whole subject begins.
//
// DETERMINISTIC NAMES, AND DELETED FIRST — same contract as `seed-media.ts`, and for the
// same two reasons: the blob store outlives the database across reseeds, and the demo's two
// instances share one store, which only works because the second seed rewrites the exact
// paths the first one wrote.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { addMediaBatch } from '@/media/media'
import { deleteByPathname } from '@/media/blob'

const DIR = join(import.meta.dir, 'art')

/** Committed filename under scripts/art/, which is also the blob stem the demo serves. */
export const ART = [
  'van-gogh-starry-night.jpg',
  'van-gogh-sunflowers.jpg',
  'van-gogh-bedroom-in-arles.jpg',
  'van-gogh-wheatfield-with-crows.jpg',
  'van-gogh-self-portrait.jpg',
  'van-gogh-letter-to-theo.jpg',
  'van-gogh-bedroom-letter-sketch.jpg',
  'hokusai-great-wave.jpg',
  'hokusai-red-fuji.jpg',
  'hokusai-storm-below-the-summit.jpg',
  'kells-chi-rho.jpg',
  'gutenberg-bible-epistle.jpg',
] as const

/** Upload the committed artworks through the real media path. Returns how many. */
export async function seedArt(): Promise<number> {
  for (const filename of ART) {
    const stem = `media/${filename.replace(/\.jpg$/, '')}`
    // The original, its thumb, and the four deferred display variants: all deterministic,
    // all deleted best-effort so a reseed rewrites rather than falls through to `-2`.
    for (const path of [
      `${stem}.jpg`, `${stem}-thumb.webp`,
      `${stem}-1024.avif`, `${stem}-1600.avif`, `${stem}-1024.webp`, `${stem}-1600.webp`,
    ]) {
      await deleteByPathname(path).catch(() => {})
    }
  }

  const items = await addMediaBatch(ART.map((filename) => {
    // A fresh copy, not `.buffer` off the read: Node pools small reads into one shared
    // ArrayBuffer, and handing that over uploads the pool, not the file.
    const bytes = readFileSync(join(DIR, filename))
    return {
      filename,
      body: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
      contentType: 'image/jpeg',
    }
  }))

  return items.length
}
