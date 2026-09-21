import { describe, it, expect } from '@/test/vitest'
import sharp from 'sharp'
import { RASTER, PASSTHROUGH, capOriginal, ORIGINAL_CAP, makeDisplay } from '@/media/image'

// Type routing decides the upload pipeline: RASTER (jpeg/png) keeps the original +
// generates responsive AVIF/WebP variants; PASSTHROUGH (svg/gif/webp/avif) is stored
// as-is. Misclassifying either skips variants for a photo or tries to re-encode a
// vector — so pin the contract. AVIF must be passthrough (already efficient), never raster.
describe('image type classification', () => {
  it('routes jpeg/png through the raster pipeline', () => {
    expect(RASTER.test('image/jpeg')).toBe(true)
    expect(RASTER.test('image/png')).toBe(true)
    expect(PASSTHROUGH.test('image/jpeg')).toBe(false)
  })

  it('keeps vector/animation/efficient formats as passthrough (incl. avif)', () => {
    for (const t of ['image/svg+xml', 'image/gif', 'image/webp', 'image/avif']) {
      expect(PASSTHROUGH.test(t)).toBe(true)
      expect(RASTER.test(t)).toBe(false)
    }
  })

  it('rejects unsupported types from both pipelines', () => {
    for (const t of ['image/heic', 'image/bmp', 'application/pdf', '']) {
      expect(RASTER.test(t)).toBe(false)
      expect(PASSTHROUGH.test(t)).toBe(false)
    }
  })
})

// capOriginal is the hard ceiling: an oversized upload (any cappable format) is
// downscaled to ORIGINAL_CAP px wide, keeping its format; small images and vectors
// pass through byte-for-byte so nothing is needlessly recompressed.
describe('capOriginal — 2048px ceiling on stored originals', () => {
  const raster = (w: number, h: number, fmt: 'png' | 'webp' | 'avif') =>
    sharp({ create: { width: w, height: h, channels: 3, background: { r: 100, g: 120, b: 140 } } })[fmt]().toBuffer()

  it('caps an oversized image to 2048px wide, keeping format', async () => {
    // sharp reports an AVIF buffer's format as its HEIF container.
    const reported = { png: 'png', webp: 'webp', avif: 'heif' } as const
    for (const fmt of ['png', 'webp', 'avif'] as const) {
      const capped = await capOriginal(await raster(4000, 2000, fmt), `image/${fmt}`)
      const meta = await sharp(capped).metadata()
      expect(meta.width).toBe(ORIGINAL_CAP)
      expect(meta.format).toBe(reported[fmt])
    }
  })

  it('leaves an already-small image untouched (same bytes)', async () => {
    const src = await raster(800, 600, 'png')
    const out = await capOriginal(src, 'image/png')
    expect(out.equals(src)).toBe(true)
  })

  it('never touches svg/gif (not cappable)', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="9000" height="10"/>')
    expect((await capOriginal(svg, 'image/svg+xml')).equals(svg)).toBe(true)
  })
})

// The display set is encoded in CHILD PROCESSES now (`encode-variant.ts`), one per variant,
// because libvips does not hand memory back and the climb is permanent in a long-lived
// server. That makes it the one part of this file whose correctness depends on a process
// boundary holding, so it is exercised for real rather than described.
describe('makeDisplay — six variants, each from its own process', () => {
  // A picture with structure in it: a flat fill compresses to almost nothing and would not
  // tell us whether the encoders ran at all.
  const photo = async (): Promise<Buffer> =>
    sharp({
      create: {
        width: 1800, height: 1200, channels: 3,
        background: { r: 0, g: 0, b: 0 },
        noise: { type: 'gaussian', mean: 128, sigma: 40 },
      },
    }).jpeg({ quality: 92 }).toBuffer()

  it('returns all three widths in both formats, decodable and correctly sized', async () => {
    const files = await makeDisplay(await photo())
    expect(files.map((f) => f.suffix)).toEqual([
      '-512.webp', '-512.avif', '-1024.webp', '-1024.avif', '-1600.webp', '-1600.avif',
    ])
    for (const f of files) {
      const meta = await sharp(f.data).metadata()
      // sharp reports an AVIF buffer's format as its HEIF container, as `capOriginal` above.
      expect(meta.format).toBe(f.suffix.endsWith('.avif') ? 'heif' : 'webp')
      expect(meta.width).toBe(Number(/-(\d+)\./.exec(f.suffix)![1]))
      expect(f.data.byteLength).toBeGreaterThan(0)
    }
  })

  it('never enlarges past the original', async () => {
    // 900px source: the 1024 and 1600 variants must both come back 900 wide. This is carried
    // by `withoutEnlargement` in the child and by nothing else — the `Math.min(width,
    // originalWidth)` that used to sit beside it was redundant, and removing it is what lets
    // the child be told a width and nothing else.
    const small = await sharp({
      create: {
        width: 900, height: 600, channels: 3,
        background: { r: 0, g: 0, b: 0 },
        noise: { type: 'gaussian', mean: 128, sigma: 40 },
      },
    }).jpeg().toBuffer()
    const widths = await Promise.all(
      (await makeDisplay(small)).map(async (f) => (await sharp(f.data).metadata()).width),
    )
    expect(widths).toEqual([512, 512, 900, 900, 900, 900])
  })

  it('raises the child failure instead of storing an empty variant', async () => {
    // A child that dies has usually been KILLED for memory. There is no in-process fallback
    // on purpose — that would run the same work in the server — so the one thing that must
    // hold is that the caller HEARS about it. `finalize.ts` then leaves the row pending and
    // the next tick tries again; silently writing a zero-byte `.avif` into the blob store
    // would give every reader a <picture> naming a file that decodes to nothing.
    await expect(makeDisplay(Buffer.from('this is not an image'))).rejects.toThrow(/exited [1-9]/)
  })
})
