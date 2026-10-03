// The image port against workerd's Images binding (`wrangler dev --local`), for `bun run test:cf`.
//
// `cf/image.ts` handed the binding `new Blob([new Uint8Array(buf)]).stream()` — two copies of the
// picture per call — and now hands it one chunk that is a view of the buffer. Two things could go
// wrong with that, and this asks both of the real binding: that the chunk is transferred (detached)
// on the way in, which the second use of the same buffer would show, and that the binding answers a
// single-chunk stream any differently, which comparing every output with the old path's would show.
import { bound } from '@/runtime/cf/bindings'
import { capOriginal, encodeVariant, imageSize, makeThumb, rasterizeSvg } from '@/runtime/cf/image'

/**
 * Every call an upload makes to the binding for one picture, in the order `media/media.ts` and
 * `media/finalize.ts` make them: the cap, its size, the thumbnail, then the six display variants.
 * Served at `/load/image` so a scratch run can read workerd's memory around a 25 MB upload.
 */
export async function uploadPictureWork(buf: Buffer): Promise<{ bytes: number; variants: number }> {
  const original = await capOriginal(buf, 'image/png', 2048)
  await imageSize(original)
  await makeThumb(original, 400)
  let variants = 0
  for (const w of [512, 1024, 1600]) {
    for (const f of ['webp', 'avif'] as const) variants += (await encodeVariant(original, w, f)).length
  }
  return { bytes: original.length, variants }
}

/** A picture with detail in it, so a resize has something to do: 1200×800 at density 72. */
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c33"/><stop offset="1" stop-color="#36c"/></linearGradient></defs>
  <rect width="1200" height="800" fill="url(#g)"/>
  ${Array.from({ length: 40 }, (_, i) => `<circle cx="${(i * 97) % 1200}" cy="${(i * 61) % 800}" r="${20 + (i % 7) * 9}" fill="#${((i * 2654435761) >>> 8).toString(16).padStart(6, '0').slice(0, 6)}" opacity="0.7"/>`).join('')}
</svg>`

const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i])

export async function imagesFromTheBuffer(): Promise<void> {
  const images = bound().env.IMAGES
  if (!images) throw new Error('no IMAGES binding in scripts/cf-test/wrangler.jsonc')
  const buf = Buffer.from(await rasterizeSvg(SVG, 72))
  const before = Buffer.from(buf)
  // The old path, kept here as the reference the new one must match.
  const old = async (width: number, format: 'image/webp' | 'image/avif', quality: number) => {
    const out = await images.input(new Blob([new Uint8Array(buf)]).stream()).transform({ width, fit: 'scale-down' }).output({ format, quality })
    return new Uint8Array(await out.response().arrayBuffer())
  }
  const size = await imageSize(buf)
  if (size.width !== 1200 || size.height !== 800) throw new Error(`imageSize said ${size.width}×${size.height}`)
  const checks: [string, Uint8Array, Uint8Array][] = [
    ['thumb', await makeThumb(buf, 400), await old(400, 'image/webp', 70)],
    ['512 webp', await encodeVariant(buf, 512, 'webp'), await old(512, 'image/webp', 80)],
    ['1024 avif', await encodeVariant(buf, 1024, 'avif'), await old(1024, 'image/avif', 50)],
  ]
  for (const [name, now, then] of checks) {
    if (now.length < 100) throw new Error(`${name}: ${now.length} bytes is not a picture`)
    if (!same(now, then)) throw new Error(`${name}: ${now.length} bytes from the view, ${then.length} from the old copy`)
  }
  if (!same(buf, before)) throw new Error('the buffer handed to the binding changed or was detached')
}
