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
import { renderOgCard } from '@/render/og-card'

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
async function strip(png: Uint8Array, top: number, height: number): Promise<[number, number, number]> {
  const crop = await sharp(Buffer.from(png)).extract({ left: 0, top, width: 1200, height }).toBuffer()
  const { channels } = await sharp(crop).stats()
  return [channels[0]!.mean, channels[1]!.mean, channels[2]!.mean]
}

const brightness = (rgb: [number, number, number]) => (rgb[0] + rgb[1] + rgb[2]) / 3
const bytes = async (res: Response) => new Uint8Array(await res.arrayBuffer())

describe('GET /og', () => {
  it('renders a real 1200x630 PNG', async () => {
    const res = await get('/og?title=Hello%20world&site=blog.example.com')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
    expect(res.headers.get('cache-control')).toContain('immutable')

    const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata()
    expect(meta.format).toBe('png')
    expect(meta.width).toBe(1200)
    expect(meta.height).toBe(630)
  })

  it('draws the title: the card is not a blank rectangle', async () => {
    // The SAME strip on a card with a title and on one without, rather than two strips of
    // one card: the base gradient runs light-to-dark diagonally, so comparing two bands of
    // a single card measures the gradient, not the type. White words on a dark card can
    // only make their own band brighter.
    const titled = await bytes(await get('/og?title=Hello%20world'))
    const blank = await bytes(await get('/og'))
    const band = (png: Uint8Array) => strip(png, 440, 120).then(brightness)
    expect(await band(titled)).toBeGreaterThan((await band(blank)) + 8)
  })

  it('survives a title in Vietnamese, which is why three font subsets are loaded', async () => {
    const res = await get(`/og?title=${encodeURIComponent('Đường đi khó, không khó vì ngăn sông')}`)
    expect(res.status).toBe(200)
    expect((await sharp(Buffer.from(await res.arrayBuffer())).metadata()).width).toBe(1200)
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
    // The untouched gradient is neutral grey, so red and blue sit within a few points of
    // each other. A fetched background would almost certainly break that.
    const [r, , b] = await strip(await bytes(res), 0, 120)
    expect(Math.abs(r - b)).toBeLessThan(15)
    expect(brightness([r, 0, 0])).toBeLessThan(30)
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

  it('darkens the bottom of the card so white text stays readable', async () => {
    // THE regression this describe block exists for. satori ignores `inset: 0`, so the
    // first version of the overlay collapsed to zero height and the card came back as
    // white type on a bright orange photograph: a perfectly valid 1200x630 PNG that nobody
    // could read. Every structural assertion still passed. Looking at the picture is what
    // found it, and this is what defends the fix.
    const png = await renderOgCard({
      title: 'With a cover image', date: 'January 1, 2026', bg: await brightBackground(),
    })
    const top = brightness(await strip(png, 0, 120))
    const bottom = brightness(await strip(png, 500, 130))

    // The wash runs 0.25 to 0.88, so the bottom must be far darker than the top. Relative
    // rather than an absolute threshold: the point is the gradient, not one exact colour.
    expect(bottom).toBeLessThan(top * 0.7)
  })

  it('still shows the image: the card is not just the wash', async () => {
    const png = await renderOgCard({ title: 'With a cover image', bg: await brightBackground() })
    const [r, , b] = await strip(png, 0, 120)
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
    expect(html).toContain('desc=The+excerpt')
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
