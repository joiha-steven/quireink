// The listing card's order: kicker, headline, standfirst, then the facts.
//
// It was "Category · Date · N min read" ABOVE the headline. Beside a side thumbnail on a phone
// that row had about 200px, wrapped, and began its second line with a bare "·". The category
// is now a kicker of its own above the headline, and the date and reading time close the card.

import { describe, expect, it, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { DEFAULT_SETTINGS } from '@/content/settings'
import { renderListing } from '@/web/listing'
import { PUBLIC_CSS } from '@/web/public.css'
import { collapseBlob } from '@/media/blob'
import type { Post, SiteSettings } from '@/types'

const DIR = './.tmp/test-list-card'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const post = (over: Partial<Post> = {}): Post => ({
  slug: 'a-post', title: 'A post', date: '2026-01-01T00:00:00.000Z', status: 'published',
  categories: ['Notes'], tags: [], excerpt: 'The words under the headline.', featuredImage: '',
  coverImage: '', readingMinutes: 3,
  ...over,
} as Post)

const list = (items: Post[], settings: SiteSettings = DEFAULT_SETTINGS, ready?: Map<string, number>) =>
  renderListing({ paged: { items, page: 1, totalPages: 1 }, basePath: '', empty: 'none', ready }, settings)

const on = (features: Partial<SiteSettings['features']>): SiteSettings =>
  ({ ...DEFAULT_SETTINGS, features: { ...DEFAULT_SETTINGS.features, categoryLabel: true, readingTime: true, ...features } })

describe('the listing card', () => {
  it('puts the kicker before the headline and the facts after the standfirst', () => {
    const html = list([post()], on({}))
    const kicker = html.indexOf('class="card-kick')
    const title = html.search(/<h[12]/)
    const excerpt = html.indexOf('class="reading-font card-exc')
    const meta = html.indexOf('class="card-meta')
    expect(kicker).toBeGreaterThan(-1)
    expect(kicker).toBeLessThan(title)
    expect(title).toBeLessThan(excerpt)
    expect(excerpt).toBeLessThan(meta)
    // The category link is the kicker's and is NOT in the facts line any more.
    const facts = html.slice(meta, html.indexOf('</p>', meta))
    expect(facts).not.toContain('/category/')
    expect(facts).toContain('<time')
    expect(facts).toContain('class="num">3</span>')
  })

  it('leaves the kicker out when the category label is off or the post has none', () => {
    expect(list([post()], on({ categoryLabel: false }))).not.toContain('card-kick')
    expect(list([post({ categories: [] })], on({}))).not.toContain('card-kick')
  })

  it('keeps the title link as the card\'s main link, and the date in a time element', () => {
    const html = list([post()], on({}))
    expect(html).toMatch(/<h[12] class="reading-font fs-h[12] font-semibold"><a class="link-accent" href="\/a-post">A post<\/a><\/h[12]>/)
    expect(html).toContain('<time class="meta-part" datetime="2026-01-01T00:00:00.000Z">')
  })

  /**
   * A separator never begins a line: it sits at the END of the fact before it, inside the same
   * unbreakable run, and the facts are separated by a plain space, the only place a break may fall.
   */
  it('glues the separator to the fact before it, never to the one after', () => {
    const html = list([post()], on({}))
    const facts = html.match(/<p class="card-meta[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? ''
    expect(facts).toMatch(/^<span class="meta-part"><time [^>]*>[^<]*<\/time><span aria-hidden="true"> ·<\/span><\/span> <span class="meta-part">/)
    // With one fact there is no separator at all.
    const lone = list([post({ readingMinutes: 0 })], on({}))
    expect(lone.match(/<p class="card-meta[^>]*>([\s\S]*?)<\/p>/)?.[1]).not.toContain('·')
  })

  it('places a side picture after the headline and a top picture before the kicker', () => {
    const ready = new Map([[collapseBlob('/uploads/media/x.jpg'), 2]])
    const p = post({ featuredImage: '/uploads/media/x.jpg' })
    const side = list([p], { ...on({}), postImage: { hero: 'none', thumb: 'side' } }, ready)
    expect(side.search(/<h[12]/)).toBeLessThan(side.indexOf('card-thumb'))
    expect(side.indexOf('card-thumb')).toBeLessThan(side.indexOf('card-meta'))
    const top = list([p], { ...on({}), postImage: { hero: 'none', thumb: 'top' } }, ready)
    expect(top.indexOf('card-thumb')).toBeLessThan(top.indexOf('card-kick'))
  })

  it('draws a side picture as a grid beside the headline, not beside the facts', () => {
    expect(PUBLIC_CSS).toContain('grid-template-areas:"kick kick" "title thumb" "exc exc" "meta meta"')
    expect(PUBLIC_CSS).toContain('.post-list article[data-thumb=side] > .card-thumb{grid-area:thumb;width:64px')
    // The shapes the owner picked are untouched: a square beside, 3:2 above.
    expect(PUBLIC_CSS).toContain('.post-list article[data-thumb=side] .card-thumb img{aspect-ratio:1/1}')
    expect(PUBLIC_CSS).toContain('.post-list article[data-thumb=top] .card-thumb img{aspect-ratio:3/2}')
  })

  /**
   * A short post (ADR 0064) has no headline. The grid's 'title' area would be empty and the
   * picture would sit alone in a row with the standfirst below it, so the card says it is short
   * and the sheet places the standfirst where the headline would have been.
   */
  it('places the standfirst beside a side picture on a card with no headline', () => {
    const ready = new Map([[collapseBlob('/uploads/media/x.jpg'), 2]])
    const settings = { ...on({}), postImage: { hero: 'none' as const, thumb: 'side' as const } }
    const short = list([post({ title: '', featuredImage: '/uploads/media/x.jpg' })], settings, ready)
    expect(short).toMatch(/<article [^>]*data-thumb="side" data-short/)
    expect(short).not.toMatch(/<h[12]/)
    expect(short.indexOf('card-kick')).toBeLessThan(short.indexOf('card-exc'))
    const titled = list([post({ featuredImage: '/uploads/media/x.jpg' })], settings, ready)
    expect(titled).not.toContain('data-short')
    expect(PUBLIC_CSS).toContain('[data-thumb=side][data-short]{grid-template-areas:"kick kick" "exc thumb" "meta meta"}')
  })
})
