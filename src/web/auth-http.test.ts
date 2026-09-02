import { describe, expect, it } from 'bun:test'
import { safeNext } from '@/web/auth-http'

// The post-sign-in destination is the one place a stranger's URL is honoured on the login
// page, which makes it the open-redirect surface. Each case here was a way off the site.
describe('safeNext', () => {
  it('keeps a same-site path', () => {
    expect(safeNext('/admin/content')).toBe('/admin/content')
    expect(safeNext('/a-post?x=1#c')).toBe('/a-post?x=1#c')
  })

  it('falls back to /admin for nothing, a full URL, or a protocol-relative one', () => {
    expect(safeNext(undefined)).toBe('/admin')
    expect(safeNext('')).toBe('/admin')
    expect(safeNext('https://evil.example')).toBe('/admin')
    expect(safeNext('//evil.example')).toBe('/admin')
    expect(safeNext('/\\evil.example')).toBe('/admin')
  })

  // The URL parser strips ASCII tab and newline before it reads a URL, so these two arrive
  // in the browser as `//evil.example`. Reproduced against a running server on 2026-09-02.
  it('refuses a path with a control character or whitespace anywhere in it', () => {
    for (const bad of ['/\t/evil.example', '/\n/evil.example', '/\r/evil.example', '/ /evil.example', '/a\\evil.example', '/x\u0000y']) {
      expect(safeNext(bad)).toBe('/admin')
    }
  })
})
