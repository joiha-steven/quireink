// What the service worker keeps as a page's offline copy (`sw-keep.ts`): a reader's page, and
// never a theme preview, an error or an answer the server marked private.
import { describe, expect, it } from 'bun:test'
import { keepsOffline } from './sw-keep'

const page = (status: number, cacheControl?: string): Response =>
  new Response('<html></html>', { status, headers: cacheControl === undefined ? {} : { 'cache-control': cacheControl } })

describe('the offline copy of a page', () => {
  it('keeps a reader\'s page', () => {
    expect(keepsOffline(page(200, 'public, s-maxage=60, stale-while-revalidate=600'))).toBe(true)
    expect(keepsOffline(page(200))).toBe(true)
  })

  it('never keeps a theme preview, or anything else marked private', () => {
    expect(keepsOffline(page(200, 'private, no-store'))).toBe(false)
    expect(keepsOffline(page(200, 'private'))).toBe(false)
    expect(keepsOffline(page(200, 'Private, No-Store'))).toBe(false)
  })

  it("keeps a reader's page sent while the page cache is switched off", () => {
    expect(keepsOffline(page(200, 'public, no-store'))).toBe(true)
  })

  it('never keeps an error', () => {
    expect(keepsOffline(page(404, 'private, no-store'))).toBe(false)
    expect(keepsOffline(page(500))).toBe(false)
  })
})
