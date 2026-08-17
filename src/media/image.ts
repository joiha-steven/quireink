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
export const SIZES = [1024, 1600] as const // display widths (in-column / wider)
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
