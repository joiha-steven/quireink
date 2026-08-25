import { describe, expect, it } from 'bun:test'
import { blogPostingSchema, websiteSchema } from '@/render/schema'
import { DEFAULT_SETTINGS } from '@/content/settings'
import type { Post, SiteSettings } from '@/types'

const settings = (over: Partial<SiteSettings> = {}): SiteSettings =>
  ({ ...DEFAULT_SETTINGS, title: 'Quire Ink', description: 'Letterforms', ...over })

const post = (over: Partial<Post> = {}): Post => ({
  title: 'The measure is the design',
  slug: 'the-measure-is-the-design',
  date: '2026-07-21T14:01:11.801Z',
  status: 'published',
  categories: ['Typography'],
  tags: ['layout', 'measure'],
  ...over,
})

const parse = (s: string | null) => JSON.parse(s ?? 'null')

describe('websiteSchema', () => {
  it('is a WebSite carrying the site title, url and language', () => {
    const o = parse(websiteSchema(settings(), 'https://example.com'))
    expect(o['@type']).toBe('WebSite')
    expect(o.name).toBe('Quire Ink')
    expect(o.url).toBe('https://example.com/')
    expect(o.inLanguage).toBe('en')
  })

  it('offers the search box only when search is on', () => {
    const on = settings({ features: { ...DEFAULT_SETTINGS.features, search: true } })
    const off = settings({ features: { ...DEFAULT_SETTINGS.features, search: false } })
    // The brace pair is Google's template syntax and has to reach the page intact.
    expect(parse(websiteSchema(on, 'https://example.com')).potentialAction.target.urlTemplate)
      .toBe('https://example.com/search?q={search_term_string}')
    expect(parse(websiteSchema(off, 'https://example.com')).potentialAction).toBeUndefined()
  })
})

describe('blogPostingSchema', () => {
  it('carries the post, its section and its keywords', () => {
    const o = parse(blogPostingSchema(post(), settings(), 'https://example.com', {}))
    expect(o['@type']).toBe('BlogPosting')
    expect(o.headline).toBe('The measure is the design')
    expect(o.url).toBe('https://example.com/the-measure-is-the-design')
    expect(o.mainEntityOfPage['@id']).toBe(o.url)
    expect(o.articleSection).toBe('Typography')
    expect(o.keywords).toBe('layout, measure')
  })

  it('prefers the SEO title override for the headline', () => {
    const o = parse(blogPostingSchema(post({ metaTitle: 'Line length' }), settings(), 'https://e.com', {}))
    expect(o.headline).toBe('Line length')
  })

  it('claims dateModified only when the post was really saved again', () => {
    // Repeating datePublished into dateModified would tell a crawler every post was edited
    // the moment it appeared, which is the thing the article meta line already refuses to say.
    expect(parse(blogPostingSchema(post(), settings(), 'https://e.com', {})).dateModified)
      .toBeUndefined()
    expect(parse(blogPostingSchema(post({ updatedAt: post().date }), settings(), 'https://e.com', {})).dateModified)
      .toBeUndefined()
    expect(parse(blogPostingSchema(post({ updatedAt: '2026-08-20T22:01:11.808Z' }), settings(), 'https://e.com', {})).dateModified)
      .toBe('2026-08-20T22:01:11.808Z')
  })

  it('never names the owner, because the only name on record is half a credential', () => {
    const o = parse(blogPostingSchema(post(), settings(), 'https://e.com', {}))
    expect(o.author).toBeUndefined()
    expect(o.publisher).toEqual({ '@type': 'Organization', name: 'Quire Ink' })
  })
})

describe('both shapes', () => {
  it('emit nothing at all when the site url is unset', () => {
    // Same rule the canonical follows: no schema beats schema full of http://localhost:3000,
    // a string that has reached production in a feed and a sitemap before.
    expect(websiteSchema(settings(), '')).toBeNull()
    expect(blogPostingSchema(post(), settings(), '', {})).toBeNull()
  })

  it('cannot close the script element that carries them', () => {
    const nasty = '</script><script>alert(1)</script>'
    const site = websiteSchema(settings({ title: nasty }), 'https://e.com') ?? ''
    const article = blogPostingSchema(post({ title: nasty }), settings(), 'https://e.com', {}) ?? ''
    for (const out of [site, article]) {
      expect(out).not.toContain('<')
      expect(out).toContain('\\u003c')
      // And it is still JSON: the escape is a JSON string escape, so a parser reads the
      // original characters back rather than a mangled title.
      expect(JSON.stringify(JSON.parse(out))).toContain(nasty)
    }
  })
})
