// The owner-path rule in `cache-headers.ts`, checked on a bare app so no page or database is in
// the way: the rule is a regular expression, and a path it does not name goes out public.
import { describe, expect, it } from 'bun:test'

describe('the owner paths', () => {
  it('keeps the first-run questions out of a shared cache, with no prerender hint', async () => {
    // The four `/setup/*` steps are owner pages. They went out `public, s-maxage=60` with the
    // speculation header, because the owner-path rule named admin, login and api only.
    const { Hono } = await import('hono')
    const { cacheHeaders } = await import('@/web/cache-headers')
    const mini = new Hono()
    mini.use('*', cacheHeaders())
    mini.get('/setup/site', (c) => c.html('<p>step four</p>'))
    const res = await mini.request('/setup/site')
    expect(res.headers.get('cache-control')).toBe('private, no-store')
    expect(res.headers.get('speculation-rules')).toBeNull()
  })
})
