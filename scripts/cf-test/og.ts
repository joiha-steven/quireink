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
import { ogCardDate } from '@/render/og'
import { formatDate } from '@/i18n/i18n'
import { DEFAULT_SETTINGS } from '@/content/settings'

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

export async function ogCardRendersHere(): Promise<void> {
  const png = await renderOgCard({ title: 'A card drawn inside workerd', desc: 'Words under it.', site: 'blog.test' })
  if (!PNG.every((b, i) => png[i] === b)) throw new Error('the card is not a PNG')
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  const width = view.getUint32(16)
  const height = view.getUint32(20)
  if (width < OG_SIZE.width || height < OG_SIZE.height) throw new Error(`the card is ${width}x${height}`)
}

/**
 * The card's date in workerd's own ICU (ADR 0074): V8 writes dates with its own data, not JSC's,
 * so the fallback is only right if V8's Japanese date carries the kanji the card cannot draw and
 * its Vietnamese one is drawn. A Vietnamese post on an English blog is dated in Vietnamese; a
 * Japanese one keeps the site's date; both cards render.
 */
export async function ogCardDatesHere(): Promise<void> {
  const at = '2020-01-01T12:00:00.000Z'
  const site = { ...DEFAULT_SETTINGS, language: 'en' as const, timezone: 'UTC' }
  const ja = formatDate(at, 'ja', 'UTC')
  if (!ja.includes('年')) throw new Error(`V8 dates Japanese as ${ja}, without the 年 the fallback turns on`)
  const vi = ogCardDate(at, 'vi', site)
  if (vi !== formatDate(at, 'vi', 'UTC') || !/tháng|thg/.test(vi)) throw new Error(`a Vietnamese post's card is dated ${vi}`)
  const kept = ogCardDate(at, 'ja', site)
  if (kept !== formatDate(at, 'en', 'UTC')) throw new Error(`a Japanese post's card is dated ${kept}, not the site's`)
  for (const date of [vi, kept]) {
    const png = await renderOgCard({ title: 'Dated in its own language', desc: 'Words under it.', date })
    if (!PNG.every((b, i) => png[i] === b)) throw new Error(`the card dated ${date} is not a PNG`)
  }
}
