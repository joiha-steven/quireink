// A Quire Ink bundle's `uploads/`, brought home with its writing.
//
// The bundle carries every picture and file its writing points at (`server/export-md.ts`), and the
// import read only the text: on another blog each one was a 404 (2026-11-03). Here they are written
// to the store, each only where nothing is yet — a path already holding something is left as it
// is, so importing a bundle back into the blog it came from changes no picture — and the library
// is told about them: a row per original picture (its thumb and widths are made again, as for any
// upload) and per file.
//
// TWO PASSES OVER THE ARCHIVE, and memory is why. `unzipBlob` answers with every entry it kept,
// inflated, so keeping all of `uploads/` at once would hold the whole bundle's pictures in this
// process — up to the 256 MB the unzipper allows, on a box sized for a blog and in a Cloudflare
// isolate that has 128. The first pass only reads the directory for the names; the second inflates
// them a few at a time.
import type { ZipEntry } from '@/import/unzip'
import { uploadFile } from '@/media/blob'
import { mimeOf } from '@/media/mime'
import { registerMediaBatch } from '@/media/media-register'
import { registerFilesBatch } from '@/media/files'
import { one } from '@/store/query'

type Unzip = (file: Blob, keep: (name: string) => boolean) => Promise<ZipEntry[]>

/** How many entries are inflated at once: each is at most the unzipper's 64 MB entry cap. */
const AT_ONCE = 16

/** A store path this blog writes, and nothing that could climb out of it. */
const STORE_PATH = /^(media|files)\/(?!.*(?:^|\/)\.\.?(?:\/|$))[^\0\\]+$/
/** The smaller copies the library makes of a picture: made again here, never carried in. */
const DERIVED = /-(?:thumb|\d{2,4})\.(?:webp|avif)$/

export async function bringBundleUploads(file: Blob, unzip: Unzip): Promise<number> {
  const names: string[] = []
  await unzip(file, (name) => {
    const path = name.startsWith('uploads/') ? name.slice('uploads/'.length) : ''
    if (STORE_PATH.test(path) && !DERIVED.test(path)) names.push(name)
    return false
  })

  const pictures: { url: string; filename: string }[] = []
  const files: { url: string; filename: string; size: number; contentType: string }[] = []
  let written = 0
  for (let at = 0; at < names.length; at += AT_ONCE) {
    const batch = new Set(names.slice(at, at + AT_ONCE))
    for (const { name, bytes } of await unzip(file, (n) => batch.has(n))) {
      const path = name.slice('uploads/'.length)
      const contentType = mimeOf(path)
      try {
        await uploadFile(path, Buffer.from(bytes), contentType, { exclusive: true })
      } catch (error) {
        // Something is there already: this blog's own copy wins, and it is not counted.
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') continue
        throw error
      }
      written++
      const filename = path.slice(path.indexOf('/') + 1)
      if (path.startsWith('media/')) {
        if (!one(`select path from media where path = ?`, path)) pictures.push({ url: path, filename })
      } else if (!one(`select url from files where url = ?`, path)) {
        files.push({ url: path, filename, size: bytes.byteLength, contentType })
      }
    }
  }
  if (pictures.length) await registerMediaBatch(pictures)
  if (files.length) await registerFilesBatch(files)
  return written
}
