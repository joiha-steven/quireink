// Cloudflare: pictures through the Images binding (`IMAGES`, measured 2026-10-03: AVIF and WebP from
// R2, 30–380 ms). `fit: 'scale-down'` is sharp's `withoutEnlargement`. The same qualities as
// `bun/image.ts`, so a picture costs about the same bytes on either runtime. The OG card's SVG→PNG
// is not the Images binding's job: resvg, compiled to WASM and imported statically, draws it.
import { Resvg, initWasm } from '@resvg/resvg-wasm'
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm'
import type { ImagePort } from '@/runtime/ports'
import { bound } from './bindings'

type Format = 'image/webp' | 'image/avif' | 'image/jpeg' | 'image/png'

function images(): ImagesBinding {
  const binding = bound().env.IMAGES
  if (!binding) throw new Error('runtime/cf: no IMAGES binding in wrangler.jsonc')
  return binding
}

const input = (buf: Buffer) => new Blob([new Uint8Array(buf)]).stream()

async function draw(buf: Buffer, width: number, format: Format, quality?: number): Promise<Buffer> {
  const out = await images().input(input(buf)).transform({ width, fit: 'scale-down' }).output({ format, quality })
  return Buffer.from(await out.response().arrayBuffer())
}

const CAPPABLE: Record<string, { format: Format; quality?: number }> = {
  'image/jpeg': { format: 'image/jpeg', quality: 85 },
  'image/png': { format: 'image/png' },
  'image/webp': { format: 'image/webp', quality: 82 },
  'image/avif': { format: 'image/avif', quality: 55 },
}

export const imageSize: ImagePort['imageSize'] = async (buf) => {
  const info = await images().info(input(buf))
  if (!('width' in info)) throw new Error('not a raster image')
  return { width: info.width, height: info.height }
}

export const capOriginal: ImagePort['capOriginal'] = async (buf, contentType, cap) => {
  const target = CAPPABLE[contentType]
  if (!target) return buf
  try {
    const { width } = await imageSize(buf)
    if (!width || width <= cap) return buf
    return await draw(buf, cap, target.format, target.quality)
  } catch {
    return buf
  }
}

export const makeThumb: ImagePort['makeThumb'] = (buf, width) => draw(buf, width, 'image/webp', 70)

export const encodeVariant: ImagePort['encodeVariant'] = (buf, width, format) =>
  format === 'webp' ? draw(buf, width, 'image/webp', 80) : draw(buf, width, 'image/avif', 50)

export const renderLogo: ImagePort['renderLogo'] = async (src, cssWidth) => {
  const webp = await draw(src, Math.round(cssWidth * 2), 'image/webp', 85)
  const { width, height } = await imageSize(webp)
  let png: Buffer | null = null
  try {
    png = await draw(src, Math.round(cssWidth * 2), 'image/png')
  } catch {
    // Best effort: a missing email twin costs the newsletter its logo, not the header.
  }
  return { webp, width, height, png }
}

let resvgReady: Promise<void> | null = null

/** `density` in dpi, as sharp takes it: 144 draws the 1200×630 card at twice its size, like Bun does. */
export const rasterizeSvg: ImagePort['rasterizeSvg'] = async (svg, density) => {
  await (resvgReady ??= initWasm(resvgWasm))
  const rendered = new Resvg(svg, { fitTo: { mode: 'zoom', value: density / 72 }, font: { loadSystemFonts: false } }).render()
  return rendered.asPng()
}
