// Which dropped or pasted files the writing takes, and which upload route each one goes to.
// Images go through the image route (it sniffs the bytes); video goes through the attachments
// route, which is where the Library's Videos tab already sends it.
import { isVideoAttachment, videoFileUrl } from '@/render/video'

export type MediaKind = 'image' | 'video'
type Named = { name: string; type: string }

export function mediaKind(f: Named): MediaKind | null {
  if (f.type.startsWith('image/')) return 'image'
  return isVideoAttachment(f.name, f.type) ? 'video' : null
}

/** A video the page can play: the extension must be one the player knows (not .mkv, .avi). */
export const isPlayableVideo = (f: Named): boolean => videoFileUrl(`/${f.name}`) !== null

/** The files the writing can take, in the order they came, from a drop or the clipboard. */
export const mediaFiles = (list: FileList | null | undefined): File[] =>
  Array.from(list ?? []).filter((f) => mediaKind(f) !== null)

/** A QuickTime file: it uploads fine but plays only in Safari, so the writer gets a heads-up. */
export const isQuickTime = (f: Named): boolean =>
  f.type === 'video/quicktime' || /\.mov$/i.test(f.name)
