import { describe, expect, it } from 'bun:test'
import { landing, safeNext } from '@/web/auth-http'

// The post-sign-in destination is the one place a stranger's URL is honoured on the login
// page, which makes it the open-redirect surface. Each case here was a way off the site.
describe('safeNext', () => {
  // A header cannot carry a byte outside ASCII: `café` in `next` threw after the second factor
  // was spent, a 500 with the code used up and no session delivered.
  it('escapes what a header cannot carry, and nothing already escaped', () => {
    const next = safeNext('/admin/posts?q=café&t=bài%20viết')
    expect(next).toBe('/admin/posts?q=caf%C3%A9&t=b%C3%A0i%20vi%E1%BA%BFt')
    expect(() => new Headers({ location: next })).not.toThrow()
  })

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

// A first run cut short — the tab closed at the recovery codes — signed in again through
// `/login?next=/admin` and landed on the dashboard: the four questions were never asked, and
// `setupDone` stayed false for good, which also keeps "Quire Ink has been updated" from ever
// showing (`overlays.ts`). An owner made from the CLI never saw them either (2026-11-03).
describe('landing', () => {
  it('sends a sign-in to the rest of the setup while it is not done, not to the bare admin', () => {
    expect(landing('/admin', { setupDone: false })).toBe('/setup/site')
    expect(landing(undefined, { setupDone: false })).toBe('/setup/site')
    expect(landing('/admin/', { setupDone: false })).toBe('/setup/site')
  })
  it('keeps a page somebody was sent to sign in for, and the admin once setup is done', () => {
    expect(landing('/admin/editor/a-post', { setupDone: false })).toBe('/admin/editor/a-post')
    expect(landing('/admin', { setupDone: true })).toBe('/admin')
  })
})
