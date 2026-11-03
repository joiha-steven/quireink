// A share card inside workerd, for `bun run test:cf`.
//
// Bun's tests render the card on Bun and cannot see what a Worker refuses. satori 0.33.5, the first
// release with the fix for GHSA-wx4j-mvgx-mqwp, shapes every line with `harfbuzzjs`, whose entry
// reads its WASM with `fs` at import and whose setup then COMPILES small WASM modules from bytes
// (emscripten's `addFunction`); workerd answers "Wasm code generation disallowed by embedder", so
// the card fails on every Cloudflare install while every Bun test passes. Measured 2026-11-03: this
// case is red on 0.33.5 and green on 0.29.1. It renders the whole card here, fonts from Static
// Assets through the layout to the PNG, and holds it to the card's size.
import { OG_SIZE, renderOgCard } from '@/render/og-card'

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

export async function ogCardRendersHere(): Promise<void> {
  const png = await renderOgCard({ title: 'A card drawn inside workerd', desc: 'Words under it.', site: 'blog.test' })
  if (!PNG.every((b, i) => png[i] === b)) throw new Error('the card is not a PNG')
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  const width = view.getUint32(16)
  const height = view.getUint32(20)
  if (width < OG_SIZE.width || height < OG_SIZE.height) throw new Error(`the card is ${width}x${height}`)
}
