// Image encoding — pure sharp pipeline (Buffer -> Buffer / dimensions). No DB, no
// storage, no app state. media.ts depends on this ONE WAY (media -> image, never back).

/**
 * sharp is loaded on the FIRST image operation, not at boot.
 *
 * `og-card.ts` already deferred it and said why (a compiled binary bundles sharp's
 * JavaScript but not its native module, so a top-level import killed the boot rather than
 * one route). That deferral bought nothing while THIS file imported it statically: media.ts
 * is reachable from the route table, so every process loaded sharp at boot anyway and the
 * comment over there described a protection that was not in force.
 *
 * The second reason is the hosted tier. sharp is the largest single import in the tree, and
 * a blog whose owner has not uploaded an image since the process started should not be
 * holding an image codec resident. Every export below was already `async`, so deferring it
 * costs one `await` per call and changes no signature.
 */
type Sharp = typeof import('sharp')['default']
let mod: Sharp | null = null
async function sharp(): Promise<Sharp> {
  return (mod ??= (await import('sharp')).default)
}

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
const THUMB_WIDTH = 400
export const ORIGINAL_CAP = 2048 // hard ceiling for a stored original's width — no full-size bytes are ever kept/served
const CAPPABLE = /^image\/(jpeg|png|webp|avif)$/ // formats we can safely downscale in place (svg/gif excluded)

// Cap an uploaded original to ORIGINAL_CAP px wide, KEEPING its format, so a
// multi-thousand-pixel upload never gets stored or served at full size (in-content,
// as a <picture> fallback, or in the lightbox). Vector/animation and images already
// within the cap pass through untouched (no needless recompression). Best-effort: a
// decode/encode hiccup returns the original bytes so an upload never fails on this.
export async function capOriginal(body: ArrayBuffer | Buffer, contentType: string): Promise<Buffer> {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body)
  if (!CAPPABLE.test(contentType)) return buf
  try {
    const { width = 0 } = await (await sharp())(buf, { failOn: 'none' }).rotate().metadata()
    if (!width || width <= ORIGINAL_CAP) return buf
    const pipe = (await sharp())(buf, { failOn: 'none' }).rotate().resize({ width: ORIGINAL_CAP })
    if (contentType === 'image/png') return pipe.png().toBuffer()
    if (contentType === 'image/webp') return pipe.webp({ quality: 82 }).toBuffer()
    if (contentType === 'image/avif') return pipe.avif({ quality: 55 }).toBuffer()
    return pipe.jpeg({ quality: 85 }).toBuffer()
  } catch {
    return buf
  }
}

export type Variant = { suffix: string; data: Buffer; contentType: string }

// From the original bytes, read pixel dimensions (auto-oriented).
export async function imageSize(original: Buffer): Promise<{ width: number; height: number }> {
  const meta = await (await sharp())(original, { failOn: 'none' }).rotate().metadata()
  return { width: meta.width ?? 0, height: meta.height ?? 0 }
}

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
export async function makeThumb(original: Buffer): Promise<Buffer> {
  return (await sharp())(original, { failOn: 'none' })
    .rotate()
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .webp({ quality: 70 })
    .toBuffer()
}

// The heavy display set (AVIF + WebP @ each size) — deferred to AFTER save so the
// save request never blocks on the AVIF encode (the original always renders).
export async function makeDisplay(original: Buffer): Promise<Variant[]> {
  const { width: ow } = await imageSize(original)
  const files: Variant[] = []
  for (const w of SIZES) {
    const pipe = (await sharp())(original, { failOn: 'none' })
      .rotate()
      .resize({ width: ow ? Math.min(w, ow) : w, withoutEnlargement: true })
    files.push({ suffix: `-${w}.webp`, data: await pipe.clone().webp({ quality: 80 }).toBuffer(), contentType: 'image/webp' })
    files.push({ suffix: `-${w}.avif`, data: await pipe.clone().avif({ quality: 50 }).toBuffer(), contentType: 'image/avif' })
  }
  return files
}
