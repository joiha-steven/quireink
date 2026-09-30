// Small things an empty or new blog showed wrongly (FIXLIST 8.6).
import { describe, expect, it } from 'bun:test'
import { DEFAULT_SETTINGS } from '@/content/settings'
import { renderLlms } from '@/web/feeds'
import { renderListing } from '@/web/listing'

describe('llms.txt on an empty blog', () => {
  it('has no heading over nothing', () => {
    const out = renderLlms([], [], { ...DEFAULT_SETTINGS, title: 'T', description: 'D' }, 'https://b')
    expect(out).toBe('# T\n\nD\n')
  })
})

describe('a listing with something under its heading', () => {
  it('puts it after the heading and before the empty line', () => {
    const html = renderListing({
      headingHtml: 'Search', afterHead: '<form data-box></form>',
      paged: { items: [], page: 1, totalPages: 1 }, basePath: '/search', empty: 'Nothing',
    }, DEFAULT_SETTINGS)
    expect(html.indexOf('<h1>')).toBeLessThan(html.indexOf('data-box'))
    expect(html.indexOf('data-box')).toBeLessThan(html.indexOf('Nothing'))
  })
})
