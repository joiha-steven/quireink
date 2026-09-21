// Image encoding — pure sharp pipeline (Buffer -> Buffer / dimensions). No DB, no
// storage, no app state. media.ts depends on this ONE WAY (media -> image, never back).

// sharp is loaded on the FIRST image operation and not at boot, and `media/sharp.ts` is the
// one place that does it: the reasons for deferring it were written out in three files that
// each deferred it separately, and libvips' own settings are process-global and so could not
// belong to any of them. Every export below was already `async`, so it costs one `await`.
import { join } from 'node:path'
import { sharp } from '@/media/sharp'

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

/**
 * How hard the AVIF encoder searches. sharp's scale is 0 (fastest) to 9; the default is 4.
 *
 * ⚠️ 4 IS THE WRONG END OF A CURVE THAT HAS ALREADY FLATTENED. Measured 2026-09-21 in a
 * container, over twelve real photographs, for the 1600px copy of each:
 *
 *   effort  time      size      PSNR
 *   4       28,528ms  1,790 KB  33.46 dB   the default
 *   3        6,888ms  1,785 KB  33.22 dB   <- here
 *   2        3,564ms  1,793 KB  33.02 dB
 *   1        2,111ms  1,740 KB  32.41 dB
 *
 * Four times the work for a quarter of a decibel, at the same number of bytes. A quarter of
 * a decibel is not a thing anybody can see; 22 seconds is a thing a small box feels, and on a
 * quarter of a CPU that figure is eight times larger again. Peak memory moves with it, 135 MB
 * to 111 MB for one 1600px encode in a fresh process.
 *
 * ⚠️ READ THE PSNR COLUMN, NOT THE SIZE COLUMN. On bytes alone effort 1 looks best of all —
 * it produced SMALLER files than the default on ten of those twelve images, which reads as
 * fourteen times the CPU bought nothing. It is not: effort 1 is 1.05 dB worse, on every
 * image, because at a fixed `quality` a cheaper search spends fewer bits AND gets less for
 * them. This constant was nearly set to 1 on the strength of the size column alone.
 *
 * 2 is available and costs 0.44 dB for eight times the speed. 3 is chosen because it is the
 * largest step that costs nothing measurable.
 */
const AVIF_EFFORT = 3

/**
 * One variant, encoded in a process of its own. `encode-variant.ts` says why.
 *
 * NO FALLBACK TO ENCODING IT HERE, and that is deliberate rather than missing. A child that
 * exits non-zero has usually been KILLED for memory, and answering that by doing the same
 * work in the server is how the failure this arrangement exists to prevent arrives anyway.
 * The sweep already retries: `finalize.ts` selects on `variants < VARIANT_VERSION`, so a
 * variant that failed is simply still pending on the next tick.
 *
 * Spawning is not a new requirement either — `server/backup.ts` has spawned `tar` for real
 * since the port, so an installation that cannot start a child process already cannot take a
 * backup.
 *
 * `process.execPath` rather than the name `bun`: the parent is already running under the
 * interpreter the child needs, and PATH is not guaranteed to be anything in a unit file or a
 * container entrypoint.
 */
async function encodeElsewhere(original: Buffer, width: number, format: 'webp' | 'avif'): Promise<Buffer> {
  const child = Bun.spawn(
    [process.execPath, '--smol', join(import.meta.dir, 'encode-variant.ts'),
      String(width), format, String(AVIF_EFFORT)],
    { stdin: new Blob([new Uint8Array(original)]), stdout: 'pipe', stderr: 'pipe' },
  )
  // BOTH PIPES ARE DRAINED BEFORE THE EXIT IS AWAITED. A child blocked writing into a pipe
  // nobody is reading never exits, and `backup.ts` carries the same note about `tar`.
  const [encoded, complaint] = await Promise.all([
    Bun.readableStreamToArrayBuffer(child.stdout),
    new Response(child.stderr).text(),
  ])
  await child.exited
  if (child.exitCode !== 0) {
    throw new Error(
      `encode ${width}.${format} exited ${child.exitCode}${
        child.signalCode ? ` (${child.signalCode})` : ''}: ${complaint.trim().slice(0, 200)}`,
    )
  }
  return Buffer.from(encoded)
}

// The heavy display set (AVIF + WebP @ each size) — deferred to AFTER save so the
// save request never blocks on the AVIF encode (the original always renders).
export async function makeDisplay(original: Buffer): Promise<Variant[]> {
  const files: Variant[] = []
  for (const w of SIZES) {
    files.push({ suffix: `-${w}.webp`, data: await encodeElsewhere(original, w, 'webp'), contentType: 'image/webp' })
    files.push({ suffix: `-${w}.avif`, data: await encodeElsewhere(original, w, 'avif'), contentType: 'image/avif' })
  }
  return files
}
