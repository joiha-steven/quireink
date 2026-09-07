// The four storage figures the dashboard prints, kept current instead of re-derived.
//
// They come from a walk of the whole blob store: 5,120 files on the measuring machine, one
// `stat` each, 734ms. The dashboard asked for them on every load, so the walk was cached; but
// every uploaded file dropped the cache, and the quota check on the NEXT upload is another
// reader of these numbers, so an upload paid for a full walk of a directory it had just added
// one file to.
//
// So the walk happens once per process and what it produced is kept: a size per file, updated
// by the write announcements themselves. An upload of ten images now costs ten map writes
// instead of ten directory walks, and the answer is exact rather than approximated — an
// overwrite replaces a size it already knows rather than adding to a total it cannot correct.
//
// Deliberately NOT computed from the `media` and `files` tables, which would be one cheap
// query: those rows carry the ORIGINAL's size and a has-variants flag, not a row per derived
// file, so the totals would quietly start meaning something narrower than they did. A cache
// that returns the same numbers is a performance change; a query that returns different ones
// is a behaviour change wearing the same label.

import { listBlobs, onBlobWrite } from '@/media/blob'

export type StorageStats = {
  /** Uploaded images, not counting the sizes derived from them. */
  originals: number
  /** Derived files: thumbnails and the display widths, named by convention. */
  variants: number
  /** Attachments under `files/`. */
  files: number
  /** Every byte in the store, derivatives and icons and fonts included. */
  totalBytes: number
}

const isVariant = (p: string) => /-(?:thumb|\d+)\.(?:avif|webp)$/.test(p)

/** One size per stored file. Null until the one walk that fills it. */
let sizes: Map<string, number> | null = null

async function index(): Promise<Map<string, number>> {
  if (sizes) return sizes
  const built = new Map<string, number>()
  for (const b of await listBlobs()) built.set(b.pathname, b.size)
  sizes = built
  return built
}

export async function storageStats(): Promise<StorageStats> {
  const held = await index()
  let originals = 0
  let variants = 0
  let files = 0
  let totalBytes = 0
  for (const [pathname, size] of held) {
    totalBytes += size
    if (pathname.startsWith('files/')) files++
    else if (pathname.startsWith('media/') && !pathname.endsWith('_index.json')) {
      if (isVariant(pathname)) variants++
      else originals++
    }
  }
  return { originals, variants, files, totalBytes }
}

/** Throw the index away, so the next read walks the store again. */
export function forgetStorageStats(): void {
  sizes = null
}

// Registered at import rather than from the server entry point, unlike the cache warmer: a
// script that forgot to register it would print stale numbers.
//
// Before the first walk there is nothing to keep current, and no reason to start: a process
// that writes a file without anybody ever asking for these figures should not walk the store
// to find out what it just did.
onBlobWrite(({ pathname, size }) => {
  if (!sizes) return
  if (size === null) sizes.delete(pathname)
  else sizes.set(pathname, size)
})
