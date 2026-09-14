// What the library screen reads, and the boundary it must not cross.
//
// EVERYTHING HERE IS A READ, and all of it is local: three lists out of SQLite. Nothing in
// this file resizes a picture, asks a model to describe one, or reaches a network — those live
// behind explicit clicks (`src/web/admin/uploads.ts`), and drawing the page must never become
// one of them. `describeUpload` in particular bills the owner per image.
import { getMedia } from '@/media/media'
import { getFiles, getSiteIcons } from '@/media/files'
import { isVideoAttachment } from '@/render/video'
import type { FileItem, MediaItem } from '@/types'

export type MediaScreenView = {
  images: MediaItem[]
  /** Attachments that are not video: the Files tab. */
  files: FileItem[]
  /** The same store, filtered to what a browser can play: the Videos tab. */
  videos: FileItem[]
  /** The favicon and app icon, uploaded in Settings and listed here for visibility only. */
  icons: FileItem[]
}

/**
 * All three tabs in one read.
 *
 * The React face fetched each tab when it was first opened, so two of the three were a spinner
 * the first time anybody clicked them. Three local list queries cost less than the round trip
 * they replace, and the whole screen arrives drawn.
 */
export async function mediaScreenView(): Promise<MediaScreenView> {
  const [images, attachments, icons] = await Promise.all([getMedia(), getFiles(), getSiteIcons()])
  const videos: FileItem[] = []
  const files: FileItem[] = []
  for (const f of attachments) {
    if (isVideoAttachment(f.filename, f.contentType)) videos.push(f)
    else files.push(f)
  }
  return { images, files, videos, icons }
}
