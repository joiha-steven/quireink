// The three shape knobs and the author, and the one property that matters more than any of
// the rest: A BLOG THAT UPGRADES INTO THIS VERSION MUST NOT MOVE A PIXEL.
//
// Same seam as `figure-default.test.ts` and the same reasoning — an appearance default that
// changed markup would rewrite pages already sitting in the cache — but the emphasis here is
// on the other side of it. `postImage`, `shape` and `author` all arrived on 2026-08-29 on a
// product with live blogs, and every one of their defaults is a promise that nothing
// happened. A test that only proved the knobs WORK would let a wrong default ship silently,
// because a wrong default still works; it just works on somebody else's blog without asking.

import { describe, expect, it, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { pageStyles } from '@/web/layout'
import { PUBLIC_CSS } from '@/web/public.css'
import { DEFAULT_SETTINGS } from '@/content/settings'
import {
  DEFAULT_POST_IMAGE, DEFAULT_SHAPE, DEFAULT_AUTHOR,
  sanitizePostImage, sanitizeShape, sanitizeAuthor, shapeToCss,
} from '@/content/settings-shape'
import { heroImage, byline, authorBox } from '@/web/article-blocks'
import { renderListing } from '@/web/listing'
import { collapseBlob } from '@/media/blob'
import { blogPostingSchema } from '@/render/schema'
import type { Post, SiteSettings } from '@/types'
import type { ShapeSettings, AuthorSettings } from '@/types-settings'

const DIR = './.tmp/test-shape'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const post = (over: Partial<Post> = {}): Post => ({
  slug: 'a-post', title: 'A post', date: '2026-01-01T00:00:00.000Z', status: 'published',
  categories: [], tags: [], excerpt: '', featuredImage: '', coverImage: '',
  ...over,
} as Post)

const withAuthor = (author: Partial<AuthorSettings>): SiteSettings =>
  ({ ...DEFAULT_SETTINGS, author: { ...DEFAULT_AUTHOR, ...author } })

describe('the defaults are a promise that nothing changed', () => {
  it('ships every new knob at the value that reproduces today', () => {
    expect(DEFAULT_POST_IMAGE).toEqual({ hero: 'none', thumb: 'none' })
    expect(DEFAULT_SHAPE).toEqual({ density: 'normal', radius: 'soft', headingWeight: 'normal' })
    expect(DEFAULT_AUTHOR).toEqual({ name: '', bio: '', avatarUrl: '', url: '' })
  })

  // The three numbers a stylesheet actually carried before any of this existed. If a future
  // change to `normal` is deliberate it edits this line and says why; if it is an accident,
  // this is where it stops.
  it('emits the literal values the sheets used to hardcode', () => {
    const css = shapeToCss(DEFAULT_SHAPE)
    expect(css).toContain('--density:1')       // --sp was `calc(1rem * scale)` with no factor
    expect(css).toContain('--radius:.5rem')    // the literal in public/prose/subscribe/book
    expect(css).toContain('--fw-title:700')    // the post h1
    expect(css).toContain('--fw-heading:600')  // .font-semibold, related, read-next
  })

  it('renders nothing at all from the three new blocks on a default install', () => {
    expect(heroImage(post({ featuredImage: '/uploads/media/x.jpg' }), DEFAULT_SETTINGS, new Map())).toBe('')
    expect(byline(DEFAULT_SETTINGS, 'by')).toBe('')
    expect(authorBox(DEFAULT_SETTINGS)).toBe('')
  })

  it('leaves the JSON-LD authorless while no name is set', () => {
    const json = blogPostingSchema(post(), DEFAULT_SETTINGS, 'https://example.com', {})
    expect(json).not.toBeNull()
    expect(JSON.parse(json!).author).toBeUndefined()
  })
})

describe('the shape knobs, once somebody turns them', () => {
  const css = (s: Partial<ShapeSettings>) => shapeToCss({ ...DEFAULT_SHAPE, ...s })

  it('moves density, radius and BOTH heading weights together', () => {
    expect(css({ density: 'compact' })).toContain('--density:0.82')
    expect(css({ density: 'relaxed' })).toContain('--density:1.22')
    expect(css({ radius: 'square' })).toContain('--radius:0px')
    expect(css({ radius: 'round' })).toContain('--radius:1rem')
    // Two weights, not one: a post title and a card title were never the same number, and
    // a knob that collapsed them would be a redesign wearing a setting.
    expect(css({ headingWeight: 'light' })).toContain('--fw-title:400')
    expect(css({ headingWeight: 'light' })).toContain('--fw-heading:400')
    expect(css({ headingWeight: 'bold' })).toContain('--fw-title:800')
    expect(css({ headingWeight: 'bold' })).toContain('--fw-heading:700')
  })

  /**
   * The trap `settings-css.ts` documents at length: a `var()` inside a custom property is
   * substituted where the property is DECLARED. `--density` therefore has to be multiplied
   * into `--sp` in the same declaration that builds `--sp`, and reading it anywhere else
   * would bake in whatever `:root` happened to hold — which is exactly how book mode spent a
   * release rendering at the article's size.
   */
  it('multiplies density into --sp where --sp is declared, not somewhere else', () => {
    const styles = pageStyles({ ...DEFAULT_SETTINGS, shape: { ...DEFAULT_SHAPE, density: 'relaxed' } })
    expect(styles).toContain('--sp:calc(1rem * var(--type-scale, 1) * var(--density, 1))')
    expect(styles).toContain('--density:1.22')
    // ...and the shape block comes FIRST, so the variable exists by the time --sp reads it.
    expect(styles.indexOf('--density:1.22')).toBeLessThan(styles.indexOf('--sp:calc'))
  })

  it('refuses a value it does not know, keeping the one already stored', () => {
    const stored: ShapeSettings = { density: 'compact', radius: 'round', headingWeight: 'bold' }
    expect(sanitizeShape({ density: 'enormous', radius: 7, headingWeight: null }, stored)).toEqual(stored)
    expect(sanitizePostImage({ hero: 'banner', thumb: {} }, DEFAULT_POST_IMAGE)).toEqual(DEFAULT_POST_IMAGE)
  })
})

describe('the author, once there is one', () => {
  it('prints a byline only when there is a name, and links it only when there is a url', () => {
    expect(byline(withAuthor({ name: 'Hùng' }), 'by')).toContain('by Hùng')
    expect(byline(withAuthor({ name: 'Hùng' }), 'by')).not.toContain('<a')
    const linked = byline(withAuthor({ name: 'Hùng', url: 'https://example.com/about' }), 'by')
    expect(linked).toContain('href="https://example.com/about"')
    expect(linked).toContain('rel="author"')
  })

  // A box holding a name the meta line already printed is furniture, not information.
  it('needs a bio as well as a name before the box appears', () => {
    expect(authorBox(withAuthor({ name: 'Hùng' }))).toBe('')
    expect(authorBox(withAuthor({ bio: 'Writes here.' }))).toBe('')
    const box = authorBox(withAuthor({ name: 'Hùng', bio: 'Writes here.' }))
    expect(box).toContain('author-box')
    expect(box).toContain('Writes here.')
    // No portrait given, and the box still renders rather than showing a broken image.
    expect(box).not.toContain('<img')
  })

  it('reserves space for the portrait so it cannot shift the page', () => {
    const box = authorBox(withAuthor({ name: 'H', bio: 'b', avatarUrl: '/uploads/media/me.jpg' }))
    expect(box).toContain('width="48"')
    expect(box).toContain('height="48"')
  })

  it('escapes a name and a bio rather than trusting the owner typed HTML', () => {
    const box = authorBox(withAuthor({ name: '<script>x</script>', bio: 'a & b' }))
    expect(box).not.toContain('<script>')
    expect(box).toContain('a &amp; b')
  })

  it('puts a Person in the structured data, with the url only when given', () => {
    const bare = JSON.parse(blogPostingSchema(post(), withAuthor({ name: 'Hùng' }), 'https://e.com', {})!)
    expect(bare.author).toEqual({ '@type': 'Person', name: 'Hùng' })
    const linked = JSON.parse(blogPostingSchema(
      post(), withAuthor({ name: 'Hùng', url: 'https://e.com/me' }), 'https://e.com', {})!)
    expect(linked.author.url).toBe('https://e.com/me')
  })

  /**
   * NOT `sanitizeUrl` from `settings-sanitize.ts`, which returns `u.origin` — right for the
   * site's own base address and wrong for every author link anybody actually has.
   */
  it('keeps the path on an author link, and drops a javascript: one', () => {
    expect(sanitizeAuthor({ url: 'https://example.com/about/me' }, DEFAULT_AUTHOR).url)
      .toBe('https://example.com/about/me')
    expect(sanitizeAuthor({ url: 'javascript:alert(1)' }, DEFAULT_AUTHOR).url).toBe('')
    expect(sanitizeAuthor({ name: '  Hùng\n  Trần ' }, DEFAULT_AUTHOR).name).toBe('Hùng Trần')
    expect(sanitizeAuthor({ bio: 'x'.repeat(900) }, DEFAULT_AUTHOR).bio.length).toBe(400)
  })
})

describe("a post's own picture, once it is allowed out", () => {
  const withImage = post({ featuredImage: '/uploads/media/x.jpg' })
  const on = (hero: 'inline'): SiteSettings =>
    ({ ...DEFAULT_SETTINGS, postImage: { ...DEFAULT_POST_IMAGE, hero } })

  it('draws the hero, and marks its shape as an attribute rather than a class', () => {
    const html = heroImage(withImage, on('inline'), new Map())
    expect(html).toContain('post-hero')
    // The shape is a SETTING: a class would bake the current answer into markup that sits
    // in the page cache, and the setting could move underneath it.
    expect(html).toContain('data-hero="inline"')
  })

  /**
   * There is no wider option, and the reason is a measurement rather than a taste: a hero
   * that broke out of the column started at x=264 with the table of contents occupying
   * 126-376, so it printed over it. The band between the rails is 8px either side and does
   * not grow with the viewport. Pinned here so a future "just make it full-bleed" has to
   * read the number first.
   */
  it('offers exactly two shapes, because a third one covered the contents list', () => {
    expect(sanitizePostImage({ hero: 'wide' }, DEFAULT_POST_IMAGE).hero).toBe('none')
  })

  /**
   * A hero is the top of the page, which makes it the LCP element on any post that has one.
   * `postImage` turns `priority` into `fetchpriority="high"` instead of `loading="lazy"` —
   * lazy takes it out of the preload scanner's reach and costs a round trip on the one image
   * the page is judged by.
   */
  it('asks for the hero eagerly, because it is the LCP element', () => {
    const html = heroImage(withImage, on('inline'), new Map())
    expect(html).toContain('fetchpriority="high"')
    expect(html).not.toContain('loading="lazy"')
  })

  /**
   * Without these the browser reserves nothing and the page jumps as each file lands —
   * measured on a list of three thumbnails, every box `height: 0` until its image arrived.
   */
  it('carries the intrinsic size, so the space is reserved before the file lands', () => {
    const html = heroImage(withImage, on('inline'), new Map(), { width: 977, height: 1400 })
    expect(html).toContain('width="977"')
    expect(html).toContain('height="1400"')
  })


  it('stays silent on a post with no picture, however the setting is set', () => {
    expect(heroImage(post(), on('inline'), new Map())).toBe('')
  })
})

describe('the list thumbnail', () => {
  const items = [post({ slug: 'p1', featuredImage: '/uploads/media/x.jpg' })]
  const list = (settings: SiteSettings, ready?: Map<string, number>) => renderListing({
    paged: { items, page: 1, totalPages: 1 }, basePath: '', empty: 'none', ready,
  }, settings)

  it('is absent on a default install even when the post has a picture', () => {
    const html = list(DEFAULT_SETTINGS, new Map())
    expect(html).not.toContain('card-thumb')
    expect(html).not.toContain('<img')
  })

  it('appears once the owner asks, carrying the shape as an attribute', () => {
    const settings: SiteSettings = {
      ...DEFAULT_SETTINGS, postImage: { hero: 'none', thumb: 'side' },
    }
    const html = list(settings, new Map())
    expect(html).toContain('card-thumb')
    expect(html).toContain('data-thumb="side"')
  })

  /**
   * The measured box, not the column. `side` draws a 96px square; promising the reading
   * column here would download an image several times the size of the hole it goes into,
   * which is the whole reason the two shapes declare different `sizes`.
   */
  it('promises the size of the hole the picture goes in', () => {
    const settings: SiteSettings = {
      ...DEFAULT_SETTINGS, postImage: { hero: 'none', thumb: 'side' },
    }
    // Keyed store-relative (Invariant 3), and the VALUE is the variant-set version: a
    // `<picture>` naming a width that is not on disk has no fallback, so only a version-2
    // original may be offered the 512 file. That number is the whole reason this is a Map
    // and not a Set — a 96px square asking for a 1024px file was the bug.
    const ready = new Map([[collapseBlob('/uploads/media/x.jpg'), 2]])
    const html = list(settings, ready)
    expect(html).toContain('sizes="96px"')
    expect(html).toContain('-512.avif 512w')
  })

  /**
   * A list with thumbnails off must not pay for them. `listing-page.ts` only reads the media
   * table when the setting asks for pictures, and `renderListing` is handed nothing —
   * so a card cannot render one even if a post has an image.
   */
  it('renders no picture when the caller passed no ready set', () => {
    const settings: SiteSettings = {
      ...DEFAULT_SETTINGS, postImage: { hero: 'none', thumb: 'top' },
    }
    expect(list(settings, undefined)).not.toContain('card-thumb')
  })
})

describe('the shapes a picture is allowed to take', () => {
  /**
   * The list's tidiness is not a setting, and the numbers are why: three real files at
   * ratios 0.70, 2.10 and 0.72 rendered as a tall block, a thin strip and a tall block
   * down one edge. A gallery chooses its own shape because a gallery IS the photographs;
   * a list thumbnail is chrome.
   */
  it('crops every list thumbnail to a fixed shape, per position', () => {
    expect(PUBLIC_CSS).toContain('.post-list article[data-thumb=side] .card-thumb img{aspect-ratio:1/1}')
    expect(PUBLIC_CSS).toContain('.post-list article[data-thumb=top] .card-thumb img{aspect-ratio:3/2}')
    expect(PUBLIC_CSS).toContain('.card-thumb img{display:block;width:100%;height:auto;object-fit:cover;')
  })

  /**
   * The cap holds at EVERY ratio including as-shot, which is the case that needs it: a
   * 977x1400 scan is 963px tall in a 672px column — a whole screen of picture before the
   * first sentence.
   */
  it('caps a hero at 70vh under a wide column, and crops rather than squashes', () => {
    const rule = PUBLIC_CSS.slice(PUBLIC_CSS.indexOf('.post-hero img{'))
    expect(rule.slice(0, rule.indexOf('}'))).toContain('max-height:70vh')
    expect(rule.slice(0, rule.indexOf('}'))).toContain('object-fit:cover')
  })

  /**
   * THREE choices in a list, TWO in an article, and no shape question anywhere. A ratio
   * picker existed for an hour on 2026-08-29 and came out again: one blog's covers should
   * look like one blog's covers, and choosing that is the design's job rather than a
   * question asked of the owner three times over.
   */
  it('fixes the cover at 3:2 instead of asking, and offers no ratio setting at all', () => {
    expect(PUBLIC_CSS).toContain('aspect-ratio:3/2;max-height:70vh')
    expect(PUBLIC_CSS).not.toContain('data-ratio')
    expect('ratio' in DEFAULT_POST_IMAGE).toBe(false)
  })
})

/**
 * The ORDER on the page, which is the half no unit test of `heroImage` can see.
 *
 * The cover goes ABOVE the headline. That is what a magazine does and what the owner
 * asked for on 2026-08-29 after looking at the first version, which put it under the
 * standfirst: a cover printed below the words is a cover that has already been scrolled
 * past. Pinned here because it is one line in a template and nothing else would notice
 * it moving.
 */
describe('where the cover sits on a real page', () => {
  it('renders the picture before the headline, not after it', async () => {
    const { savePost } = await import('@/content/posts')
    const { renderArticle } = await import('@/web/article')
    const { saveSettings } = await import('@/content/settings')
    await saveSettings({ postImage: { hero: 'inline', thumb: 'none' } })
    await savePost({
      title: 'Covered', content: 'Body.', status: 'published',
      date: new Date(Date.now() - 60_000).toISOString(),
      featuredImage: '/uploads/media/x.jpg',
    })
    const html = await renderArticle('covered')
    expect(html).not.toBeNull()
    expect(html!.indexOf('post-hero')).toBeGreaterThan(-1)
    expect(html!.indexOf('post-hero')).toBeLessThan(html!.indexOf('<h1'))
  })
})
