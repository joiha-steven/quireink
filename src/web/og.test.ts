// GET /og, and the Open Graph tags that point at it.
//
// The card is a real PNG produced by satori and sharp, so these tests assert on decoded
// pixels rather than on a byte count: an endpoint that returns 200 and a corrupt image is
// the failure mode that reaches Twitter before it reaches anyone here.

import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import sharp from 'sharp'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { savePost } from '@/content/posts'
import { getSettings, saveSettings } from '@/content/settings'
import { clearCache } from '@/server/cache'
import { createApp } from '@/web/app'
import { renderOgCard, OG_SIZE } from '@/render/og-card'
import { ogFontsCover } from '@/render/og'

const DIR = './.tmp/test-og'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
const get = async (path: string): Promise<Response> => app.request(path)
const SITE = 'https://blog.example.com'
const PAST = '2020-01-01T00:00:00.000Z'

beforeEach(() => {
  clearCache()
  for (const t of ['posts', 'pages', 'post_terms', 'post_revisions', 'settings']) {
    db().run(`delete from ${t}`)
  }
})

/**
 * Average RGB of a horizontal strip of a PNG.
 *
 * Two traps here, both of which quietly produce a number that means nothing. `stats()`
 * reads the INPUT image and ignores the pipeline, so the crop must be written to a buffer
 * first — without that, every strip returns the same value. And the fourth channel is
 * alpha, a flat 255, which drags every average toward white.
 */
async function strip(png: Uint8Array, topFrac: number, heightFrac: number): Promise<[number, number, number]> {
  // FRACTIONS of the image, not pixels. These were pixel offsets against a 1200x630 card,
  // so raising the rasterisation density to 2x turned every one of them into a crop of the
  // top-left quarter -- six tests failed at once, all of them reporting a colour from the
  // wrong part of the picture rather than saying the size had changed.
  const meta = await sharp(Buffer.from(png)).metadata()
  const w = meta.width ?? 0
  const h = meta.height ?? 0
  const crop = await sharp(Buffer.from(png))
    .extract({ left: 0, top: Math.round(h * topFrac), width: w, height: Math.max(1, Math.round(h * heightFrac)) })
    .toBuffer()
  const { channels } = await sharp(crop).stats()
  return [channels[0]!.mean, channels[1]!.mean, channels[2]!.mean]
}

const brightness = (rgb: [number, number, number]) => (rgb[0] + rgb[1] + rgb[2]) / 3
const bytes = async (res: Response) => new Uint8Array(await res.arrayBuffer())

describe('GET /og', () => {
  it('renders a real card at 2x, in the 1.91:1 ratio every scraper expects', async () => {
    const res = await get('/og?title=Hello%20world&site=blog.example.com')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
    expect(res.headers.get('cache-control')).toContain('immutable')

    // 1200x630 is the DESIGN; the PNG is that rasterised at 2x, because a card is opened
    // on a phone and 72 DPI left the type visibly soft. The ratio is what scrapers key on
    // and it must survive the change, so it is asserted rather than the width alone.
    const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata()
    expect(meta.format).toBe('png')
    expect(meta.width).toBe(OG_SIZE.width * 2)
    expect(meta.height).toBe(OG_SIZE.height * 2)
    expect(meta.width! / meta.height!).toBeCloseTo(OG_SIZE.width / OG_SIZE.height, 5)
  })

  it('draws the title: the card is not a blank rectangle', async () => {
    // The SAME strip on a card with a title and on one without, rather than two strips of
    // one card: comparing two bands of a single card measures the layout, not the type.
    //
    // The comparison INVERTED when the card became paper. Dark words and a yellow stroke on
    // a light card can only make their own band darker, where white words on the old dark
    // gradient could only make it brighter. A test that had kept the old direction would
    // have passed for the wrong reason on a blank card and failed on a good one.
    const titled = await bytes(await get('/og?title=Hello%20world'))
    const blank = await bytes(await get('/og'))
    const band = (png: Uint8Array) => strip(png, 0.35, 0.2).then(brightness)
    expect(await band(titled)).toBeLessThan((await band(blank)) - 8)
  })

  it('survives a title in Vietnamese, which is why three font subsets are loaded', async () => {
    const res = await get(`/og?title=${encodeURIComponent('Đường đi khó, không khó vì ngăn sông')}`)
    expect(res.status).toBe(200)
    expect((await sharp(Buffer.from(await res.arrayBuffer())).metadata()).width).toBe(OG_SIZE.width * 2)
  })

  it('renders an empty title rather than failing', async () => {
    expect((await get('/og')).status).toBe(200)
  })

  it('refuses to fetch a background from another origin', async () => {
    // The SSRF case. `bg` is attacker-controlled and the SERVER fetches it, so anything
    // off-origin is dropped and the card falls back to its gradient. If this ever starts
    // fetching, a public URL on the blog becomes a way to probe the host's network.
    const res = await get('/og?title=X&bg=http://169.254.169.254/latest/meta-data/')
    expect(res.status).toBe(200)
    // With nothing fetched the top of the card is bare paper: neutral (red and blue within
    // a few points) and light. A fetched background would almost certainly break both.
    const [r, , b] = await strip(await bytes(res), 0, 0.2)
    expect(Math.abs(r - b)).toBeLessThan(15)
    expect(brightness([r, r, r])).toBeGreaterThan(200)
  })

  it('refuses an off-origin font for the same reason', async () => {
    const res = await get('/og?title=X&font=https://fonts.example.net/evil.woff')
    expect(res.status).toBe(200)
  })

  it('refuses a loopback background even when the Host header claims to be this site', async () => {
    // The hole under the same-origin test. With SITE_URL unset the origin is taken from the
    // request, which the CALLER builds: `Host: 127.0.0.1:port` makes a loopback URL pass as
    // same-origin and the server fetches it. `safeFetch` is what stops it, so the assertion
    // is on the listener below — it must never be asked for anything.
    const before = process.env.SITE_URL
    delete process.env.SITE_URL
    let hits = 0
    const probe = Bun.serve({
      port: 0,
      fetch: () => {
        hits++
        return new Response('secret', { headers: { 'content-type': 'image/jpeg' } })
      },
    })
    try {
      const host = `127.0.0.1:${probe.port}`
      const res = await app.request(`http://${host}/og?title=X&bg=http://${host}/bg.jpg`, {
        headers: { host },
      })
      expect(res.status).toBe(200)
      expect(hits).toBe(0)
    } finally {
      probe.stop(true)
      if (before !== undefined) process.env.SITE_URL = before
    }
  })
})

describe('the card over a background image', () => {
  /** A flat bright-orange JPEG, as the data URI the route would have inlined. */
  async function brightBackground(): Promise<string> {
    const jpeg = await sharp({
      create: { width: 400, height: 210, channels: 3, background: { r: 230, g: 120, b: 40 } },
    }).jpeg().toBuffer()
    return `data:image/jpeg;base64,${jpeg.toString('base64')}`
  }

  it('keeps the photograph out of the words: a band on top, paper underneath', async () => {
    // What replaced the wash, and the same failure it was defending against.
    //
    // The old card laid white type over the whole photograph and relied on a dark gradient
    // to stay legible; satori ignores `inset: 0`, that overlay once collapsed to zero
    // height, and the result was white words on bright orange -- a perfectly valid PNG that
    // nobody could read. The picture is now a BAND across the top and the words sit on
    // paper below it, so there is no scrim to collapse. The assertion is that the two are
    // actually separate: the photograph's band is the photograph, and where the words are
    // is paper.
    const png = await renderOgCard({
      title: 'With a cover image', date: 'January 1, 2026', bg: await brightBackground(),
    })
    const band = await strip(png, 0.05, 0.2)
    const words = await strip(png, 0.55, 0.2)

    expect(band[0] - band[2]).toBeGreaterThan(60)      // the band is the orange photograph
    expect(Math.abs(words[0] - words[2])).toBeLessThan(20) // where the words are is neutral
    expect(brightness(words)).toBeGreaterThan(brightness(band))
  })

  it('still shows the image: the card is not just the wash', async () => {
    const png = await renderOgCard({ title: 'With a cover image', bg: await brightBackground() })
    const [r, , b] = await strip(png, 0.05, 0.2)
    // Orange: red far ahead of blue. The fallback gradient is neutral grey, where the two
    // are within a few points, so this fails if the background were silently dropped —
    // which is exactly what happens if the image is passed as a URL instead of a data URI.
    expect(r - b).toBeGreaterThan(60)
  })
})

describe('open graph tags', () => {
  it('points a post at its own card, as an article', async () => {
    await saveSettings({ title: 'My Blog', siteUrl: SITE })
    await savePost({ title: 'A Post', content: 'body', status: 'published', date: PAST, excerpt: 'The excerpt' })
    const html = await get('/a-post').then((r) => r.text())

    expect(html).toContain('<meta property="og:type" content="article">')
    expect(html).toContain(`<meta property="og:url" content="${SITE}/a-post">`)
    expect(html).toContain('<meta property="og:site_name" content="My Blog">')
    expect(html).toContain(`<meta property="og:image" content="${SITE}/og?`)
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">')
    // The card carries the post's own lines, not the site's.
    expect(html).toContain('title=A+Post')
    // ...and its description comes from the BODY, not from the 200-character excerpt that
    // feeds the deck and the search snippet. The card has six lines to fill and those are
    // different jobs; a share preview that stopped mid-thought after two lines was the
    // reason it looked thin. See OG_DESC_MAX in web/article.ts.
    expect(html).toContain('desc=body')
  })

  it('lets an authored meta description win over the body', async () => {
    // The half of that rule which protects the author: words somebody chose are never
    // replaced by the opening of the article.
    await saveSettings({ title: 'My Blog', siteUrl: SITE })
    await savePost({
      title: 'A Post', content: 'the body text', status: 'published', date: PAST,
      metaDescription: 'Chosen words',
    })
    const html = await get('/a-post').then((r) => r.text())
    expect(html).toContain('desc=Chosen+words')
    expect(html).not.toContain('desc=the+body+text')
  })

  it('gives a term page its name over the domain', async () => {
    await saveSettings({ title: 'My Blog', siteUrl: SITE })
    await savePost({
      title: 'A Post', content: 'body', status: 'published', date: PAST, categories: ['Engineering'],
    })
    const html = await get('/category/engineering').then((r) => r.text())
    expect(html).toContain('title=Engineering')
    expect(html).toContain('site=blog.example.com')
  })

  it('sends the plain card type when there is no image', async () => {
    // Dynamic OG off and no fallback image: no card, so `summary`. With
    // `summary_large_image` and no image, X draws a stretched favicon instead.
    const { seo } = await getSettings()
    await saveSettings({ title: 'My Blog', siteUrl: SITE, seo: { ...seo, ogImage: false } })
    await savePost({ title: 'Plain', content: 'body', status: 'published', date: PAST })
    const html = await get('/plain').then((r) => r.text())
    expect(html).not.toContain('og:image')
    expect(html).toContain('<meta name="twitter:card" content="summary">')
  })

  it('still emits an ABSOLUTE card URL when the owner has set no site URL', async () => {
    // `resolveSiteUrl` falls back to SITE_URL and then to localhost, so there is always a
    // base. A relative og:image would be ignored by every scraper, so what matters is that
    // the fallback is used rather than the tag being dropped or left relative.
    await saveSettings({ title: 'My Blog', siteUrl: '' })
    await savePost({ title: 'Rootless', content: 'body', status: 'published', date: PAST })
    const html = await get('/rootless').then((r) => r.text())
    expect(html).toContain('<meta property="og:image" content="http://localhost:3000/og?')
  })
})

describe('a script the card cannot draw', () => {
  /**
   * satori has no system fallback. Handed a glyph none of its three Inter subsets carries it
   * draws a black box reading NO GLYPH — and returns a valid PNG of the right size, so every
   * structural assertion in this file passed while a Japanese title rendered as twenty boxes
   * under a highlighter stroke. Found by looking at the picture, which is the only way this
   * class of bug is ever found.
   */
  it('produces no card at all rather than a row of NO GLYPH boxes', async () => {
    await saveSettings({ title: 'My Blog', siteUrl: SITE })
    await savePost({
      title: '文字組みと行間のこと', slug: 'kumihan', content: '日本語の組版について。',
      status: 'published', date: PAST,
    })
    const html = await get('/kumihan').then((r) => r.text())
    expect(html).not.toContain('/og?')
  })

  it('still draws one for Vietnamese and for latin-ext, which it does carry', async () => {
    await saveSettings({ title: 'My Blog', siteUrl: SITE })
    await savePost({
      title: 'Dấu phụ tiếng Việt', slug: 'dau-phu', content: 'zażółć gęślą jaźń',
      status: 'published', date: PAST,
    })
    expect(await get('/dau-phu').then((r) => r.text())).toContain('/og?')
  })

  it('reads every line the card would set, not just the title', () => {
    expect(ogFontsCover('A Latin title')).toBe(true)
    expect(ogFontsCover('A Latin title 한글 자간')).toBe(false)
    expect(ogFontsCover('Dấu phụ — “quoted”, 2026')).toBe(true)
  })
})
