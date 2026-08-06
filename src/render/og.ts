// Resolve the OG/Twitter image URL for a post or page, honoring the SEO toggles.
// - Dynamic OG on  -> a generated /og card (title over featuredImage | fallback | gradient).
// - Dynamic OG off -> the featured image, else the owner's fallback image, else none.
import type { SiteSettings } from '@/types'

// One typeface everywhere — incl. the OG image. When the owner uploaded a custom
// font, pass its URL so the card renders in that face too (the route fetches it,
// Inter stays the glyph fallback). Pick the weight nearest 600 (the card weight).
function ogFontParam(settings: SiteSettings, base: string, p: URLSearchParams): void {
  const faces = settings.customFont.faces
  if (!faces.length) return
  const pick = [...faces].sort((a, b) => Math.abs(a.weight - 600) - Math.abs(b.weight - 600))[0]
  // Absolutize: the local driver yields `/uploads/...` refs, but the edge OG route
  // can only fetch absolute URLs. No-op for an already-absolute URL.
  if (pick?.url) p.set('font', new URL(pick.url, base).toString())
}

/**
 * Can the card's bundled faces actually DRAW this text?
 *
 * satori is not a browser and has no system fallback: handed a glyph none of its fonts
 * carry, it draws a black box reading "NO GLYPH" and returns a perfectly valid PNG. A
 * Japanese title came back as twenty of those boxes under a highlighter stroke, and every
 * structural test passed — the route answered 200 with an image of the right size.
 *
 * The card ships three Inter subsets: latin, latin-ext and vietnamese. So Latin plus the
 * shared punctuation and digits is exactly what it can draw, and Japanese, Korean, Chinese,
 * Russian, Greek, Thai and Arabic are exactly what it cannot. Quire Ink ships UI
 * translations for ja, ko and zh, which means this was reachable by a supported
 * configuration rather than by an exotic one.
 *
 * When the answer is no the site falls back to its own image, or to no card at all. A link
 * with no preview is a link; a preview that says NO GLYPH twenty times is a broken product
 * in somebody's timeline.
 */
export function ogFontsCover(text: string): boolean {
  return !/[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u.test(text)
}

export function ogImageUrl(
  settings: SiteSettings,
  base: string,
  opts: { title: string; featuredImage?: string; desc?: string; date?: string },
): string | undefined {
  const { ogImage, ogFallbackImage } = settings.seo
  const bg = opts.featuredImage || ogFallbackImage || ''
  // Every line the card would SET has to be drawable, not just the title: a Latin headline
  // over a Japanese excerpt is the same broken picture with one readable row.
  if (ogImage && ogFontsCover(`${opts.title} ${opts.desc ?? ''}`)) {
    // A post card shows title + excerpt + date; when neither is given (e.g. a page)
    // it falls back to the site name as the small bottom line.
    const p = new URLSearchParams({ title: opts.title })
    if (opts.desc) p.set('desc', opts.desc)
    if (opts.date) p.set('date', opts.date)
    if (!opts.desc && !opts.date) p.set('site', settings.title)
    if (bg) p.set('bg', new URL(bg, base).toString())
    ogFontParam(settings, base, p)
    return `${base}/og?${p.toString()}`
  }
  // Dynamic OG off → the image itself is the og:image; it must be absolute.
  return bg ? new URL(bg, base).toString() : undefined
}

// Hostname only (no protocol/path) for the OG card's domain line, e.g.
// "blog.example.com".
export function siteDomain(base: string): string {
  try {
    return new URL(base).host
  } catch {
    return base.replace(/^https?:\/\//, '').replace(/\/+$/, '')
  }
}

// Dynamic OG card for the LIST surfaces (home, category, tag) where the two text
// lines are supplied explicitly: `title` = big top line, `site` = small bottom
// line. Same card as posts/pages — honors the dynamic-OG toggle and uses the
// owner's fallback image as the background when set (else the gradient). When
// dynamic OG is off, returns the fallback image itself, or undefined if none.
//   home:        { title: domain,    site: description }
//   category/tag:{ title: name,      site: domain }
export function ogCardUrl(
  settings: SiteSettings,
  base: string,
  opts: { title: string; site: string },
): string | undefined {
  const { ogImage, ogFallbackImage } = settings.seo
  if (ogImage && ogFontsCover(`${opts.title} ${opts.site}`)) {
    const p = new URLSearchParams({ title: opts.title, site: opts.site })
    if (ogFallbackImage) p.set('bg', new URL(ogFallbackImage, base).toString())
    ogFontParam(settings, base, p)
    return `${base}/og?${p.toString()}`
  }
  return ogFallbackImage ? new URL(ogFallbackImage, base).toString() : undefined
}
