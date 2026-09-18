// What the library screen reads, and the boundary it must not cross.
//
// EVERYTHING HERE IS A READ, and all of it is local: three lists out of SQLite. Nothing in
// this file resizes a picture, asks a model to describe one, or reaches a network — those live
// behind explicit clicks (`src/web/admin/uploads.ts`), and drawing the page must never become
// one of them. `describeUpload` in particular bills the owner per image.
import { countMedia, getMedia } from '@/media/media'
import { getFiles, getSiteIcons } from '@/media/files'
import { isVideoAttachment } from '@/render/video'
import type { FileItem, MediaItem } from '@/types'

/**
 * ONE PAGE OF THE LIBRARY, and why there is a page at all.
 *
 * The screen turns every row into a tile with a picture in it. At a few hundred that is a grid;
 * at several thousand it is a page the browser thinks about for seconds and a scrollbar nobody
 * can aim with. So the library is paged, the way a library is: the address carries which page,
 * the pager under the grid carries the way to the next, and the count above it goes on naming
 * the whole collection so the number never depends on which page you are looking at.
 */
export const MEDIA_PAGE = 200

export type MediaKind = 'images' | 'videos' | 'files'

export type MediaScreenView = {
  images: MediaItem[]
  /** Attachments that are not video: the Files tab. */
  files: FileItem[]
  /** The same store, filtered to what a browser can play: the Videos tab. */
  videos: FileItem[]
  /** The favicon and app icon, uploaded in Settings and listed here for visibility only. */
  icons: FileItem[]
  /** The whole library, not this page of it: the line above the grid. */
  totals: { images: number; bytes: number; videos: number; files: number }
  /** Which page each tab is showing, and how many it has. */
  at: Record<MediaKind, number>
  pages: Record<MediaKind, number>
}

const pageCount = (total: number): number => Math.max(1, Math.ceil(total / MEDIA_PAGE))

/**
 * All three tabs in one read.
 *
 * The React face fetched each tab when it was first opened, so two of the three were a spinner
 * the first time anybody clicked them. Three local list queries cost less than the round trip
 * they replace, and the whole screen arrives drawn.
 *
 * ⚠️ ONE PAGE NUMBER, AND IT BELONGS TO THE OPEN TAB. Switching tabs is an attribute rather
 * than a navigation (`screens/media.ts`), so the other two are drawn at their first page and
 * their pagers say so. A reader who turns a page is navigating, and the link carries its own
 * tab with it.
 *
 * ⚠️ IMAGES PAGE IN SQL AND ATTACHMENTS PAGE IN MEMORY, which is not an inconsistency. Videos
 * and files are ONE table split by a predicate about the filename, so a `limit` in SQL would
 * cut the two apart before the split and hand a short page to one of them. Attachments are also
 * the small half of a library — the pictures are what grows — so the read is whole and the
 * slice is here.
 */
export async function mediaScreenView(kind: MediaKind = 'images', page = 1): Promise<MediaScreenView> {
  const at = Math.max(1, Math.floor(page) || 1)
  const skip = (open: MediaKind) => (kind === open ? (at - 1) * MEDIA_PAGE : 0)
  const [images, attachments, icons] = await Promise.all([
    getMedia({ limit: MEDIA_PAGE, offset: skip('images') }),
    getFiles(),
    getSiteIcons(),
  ])
  const totalImages = countMedia()
  const videosAll: FileItem[] = []
  const filesAll: FileItem[] = []
  for (const f of attachments) {
    if (isVideoAttachment(f.filename, f.contentType)) videosAll.push(f)
    else filesAll.push(f)
  }
  const slice = (list: FileItem[], open: MediaKind) => list.slice(skip(open), skip(open) + MEDIA_PAGE)
  return {
    images,
    videos: slice(videosAll, 'videos'),
    files: slice(filesAll, 'files'),
    icons,
    totals: {
      images: totalImages.count, bytes: totalImages.bytes,
      videos: videosAll.length, files: filesAll.length,
    },
    at: {
      images: kind === 'images' ? at : 1,
      videos: kind === 'videos' ? at : 1,
      files: kind === 'files' ? at : 1,
    },
    pages: {
      images: pageCount(totalImages.count),
      videos: pageCount(videosAll.length),
      files: pageCount(filesAll.length),
    },
  }
}
