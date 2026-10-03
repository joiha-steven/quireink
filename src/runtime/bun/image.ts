// Bun: pictures through sharp (libvips), loaded on first use (`./sharp.ts` says why and how it is
// configured). The bodies below were `media/image.ts`, `media/site-files.ts` and
// `render/og-card.ts` until 2026-10-03 (ADR 0066), moved without a change to a single option, so
// a Bun install encodes byte for byte what it did before.
import { join } from 'node:path'
import { sharp } from '@/runtime/bun/sharp'
import type { ImagePort } from '@/runtime/ports'

const CAPPABLE = /^image\/(jpeg|png|webp|avif)$/ // formats we can safely downscale in place (svg/gif excluded)

export const capOriginal: ImagePort['capOriginal'] = async (buf, contentType, cap) => {
  if (!CAPPABLE.test(contentType)) return buf
  try {
    const { width = 0 } = await (await sharp())(buf, { failOn: 'none' }).rotate().metadata()
    if (!width || width <= cap) return buf
    const pipe = (await sharp())(buf, { failOn: 'none' }).rotate().resize({ width: cap })
    if (contentType === 'image/png') return pipe.png().toBuffer()
    if (contentType === 'image/webp') return pipe.webp({ quality: 82 }).toBuffer()
    if (contentType === 'image/avif') return pipe.avif({ quality: 55 }).toBuffer()
    return pipe.jpeg({ quality: 85 }).toBuffer()
  } catch {
    return buf
  }
}

export const imageSize: ImagePort['imageSize'] = async (buf) => {
  const meta = await (await sharp())(buf, { failOn: 'none' }).rotate().metadata()
  return { width: meta.width ?? 0, height: meta.height ?? 0 }
}

export const makeThumb: ImagePort['makeThumb'] = async (buf, width) =>
  (await sharp())(buf, { failOn: 'none' })
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 70 })
    .toBuffer()

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
 * `process.execPath` rather than the name `bun`: the parent is already running under the
 * interpreter the child needs, and PATH is not guaranteed to be anything in a unit file or a
 * container entrypoint.
 */
export const encodeVariant: ImagePort['encodeVariant'] = async (original, width, format) => {
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

export const renderLogo: ImagePort['renderLogo'] = async (src, cssWidth) => {
  const draw = await sharp()
  // @2x for retina; withoutEnlargement never upscales past the source.
  const webp = await draw(src, { failOn: 'none' })
    .rotate()
    .resize({ width: Math.round(cssWidth * 2), withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer()
  const meta = await draw(webp).metadata()
  // The email twin: same @2x box, PNG, alpha preserved so it sits on any background.
  let png: Buffer | null = null
  try {
    png = await draw(src, { failOn: 'none' })
      .rotate()
      .resize({ width: Math.round(cssWidth * 2), withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toBuffer()
  } catch {
    // Best effort: a missing email twin costs the newsletter its logo, not the header.
  }
  return { webp, width: meta.width ?? 0, height: meta.height ?? 0, png }
}

export const rasterizeSvg: ImagePort['rasterizeSvg'] = async (svg, density) => {
  const draw = await sharp()
  return new Uint8Array(await draw(Buffer.from(svg), { density }).png().toBuffer())
}
