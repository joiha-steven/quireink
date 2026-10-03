// Image policy — which widths, which formats, how big an original may stay. No DB, no storage,
// no app state. media.ts depends on this ONE WAY (media -> image, never back).
//
// The pixels themselves are the runtime's (`@/runtime/impl/image`, ADR 0066): sharp on Bun, one
// child process per display variant (ADR 0061); the Images binding on Cloudflare.
import * as pixels from '@/runtime/impl/image'

export const RASTER = /^image\/(jpeg|png)$/ // full responsive pipeline
export const PASSTHROUGH = /^image\/(svg\+xml|gif|webp|avif)$/ // stored as-is, no variants (avif is already efficient)
/**
 * Display widths. 512 joined them on 2026-08-28, and it is the one that pays.
 *
 * The set was written for a picture that holds the reading column, where 1024 is already
 * the smaller answer. It is wrong for every picture that does NOT: a gallery tile renders
 * at 167px on a 390px phone and at 80px before the phone rule capped galleries at two
 * columns, and the smallest file it could be given was 1024. Measured on the Hokusai post:
 * three pictures, 190.2 KB at 1024 against 66.7 KB at 512.
 *
 * It costs about 8% of an image's stored bytes (+72 KB on 901 KB, measured over the six
 * files an original keeps), which is the trade this step is: storage is cheap on the box,
 * the reader's connection is not.
 */
export const SIZES = [512, 1024, 1600] as const

/**
 * Which SET of widths an original has on disk, so the renderer never names a file that
 * is not there.
 *
 * A `<picture>` has NO fallback: if the candidate the browser picks 404s, the image fails —
 * it does not drop back to the `<img>`. So the day 512 was added, every already-finalised
 * image in every install would have started serving a `srcset` naming a file nobody had
 * generated. The old flag was a boolean and could not tell the difference.
 *
 * 0 = nothing yet · 1 = 1024/1600 (everything finalised before 2026-08-28) · 2 = with 512.
 * A v1 image keeps working exactly as it did and is upgraded by the ordinary sweep, so the
 * change needs no migration, no downtime, and no re-upload.
 */
export const VARIANT_VERSION = 2
export const THUMB_WIDTH = 400
export const ORIGINAL_CAP = 2048 // hard ceiling for a stored original's width — no full-size bytes are ever kept/served

// Cap an uploaded original to ORIGINAL_CAP px wide, KEEPING its format, so a
// multi-thousand-pixel upload never gets stored or served at full size (in-content,
// as a <picture> fallback, or in the lightbox). Vector/animation and images already
// within the cap pass through untouched (no needless recompression). Best-effort: a
// decode/encode hiccup returns the original bytes so an upload never fails on this.
export async function capOriginal(body: ArrayBuffer | Buffer, contentType: string): Promise<Buffer> {
  return pixels.capOriginal(Buffer.isBuffer(body) ? body : Buffer.from(body), contentType, ORIGINAL_CAP)
}

export type Variant = { suffix: string; data: Buffer; contentType: string }

// From the original bytes, read pixel dimensions (auto-oriented).
export const imageSize = (original: Buffer): Promise<{ width: number; height: number }> => pixels.imageSize(original)

// Pixel dimensions for any image we can decode (raster + webp/gif, and most svg).
export async function safeSize(buf: Buffer): Promise<{ width?: number; height?: number }> {
  try {
    const { width, height } = await imageSize(buf)
    return width && height ? { width, height } : {}
  } catch {
    return {}
  }
}

// Small library thumbnail — cheap, made on upload so the grid renders at once.
export const makeThumb = (original: Buffer): Promise<Buffer> => pixels.makeThumb(original, THUMB_WIDTH)

// The heavy display set (AVIF + WebP @ each size) — deferred to AFTER save so the
// save request never blocks on the AVIF encode (the original always renders).
export async function makeDisplay(original: Buffer): Promise<Variant[]> {
  const files: Variant[] = []
  for (const w of SIZES) {
    files.push({ suffix: `-${w}.webp`, data: await pixels.encodeVariant(original, w, 'webp'), contentType: 'image/webp' })
    files.push({ suffix: `-${w}.avif`, data: await pixels.encodeVariant(original, w, 'avif'), contentType: 'image/avif' })
  }
  return files
}
