// An SVG in the store is a document that can carry script, and it is served from the site's
// own origin.
//
// Found 2026-08-22 by fetching one and reading the headers: `image/svg+xml`, `nosniff`, and
// nothing else. nosniff is the wrong tool and it is worth saying why — it stops a browser
// DECIDING a file is HTML, and an SVG genuinely is an SVG. Navigated to directly the browser
// runs its `<script>` on this origin, where a same-origin fetch carries the session cookie
// and passes the `Sec-Fetch-Site` check in `auth/csrf.ts`.
//
// Only the owner can upload, so the shape of this is not a stranger's attack: it is the
// booby-trapped icon set somebody downloaded and used as a logo.

import { describe, it, expect, afterAll } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { createApp } from '@/web/app'
import { freshDatabase, dropDatabase } from '@/test/db'

const DIR = './.tmp/test-uploads-route'
const STORE = `${DIR}/uploads`
freshDatabase(DIR)

const before = process.env.STORAGE_LOCAL_DIR
process.env.STORAGE_LOCAL_DIR = STORE
mkdirSync(`${STORE}/media`, { recursive: true })
mkdirSync(`${STORE}/files`, { recursive: true })
writeFileSync(`${STORE}/media/mark.svg`,
  '<svg xmlns="http://www.w3.org/2000/svg"><style>text{fill:red}</style><script>1</script></svg>')
writeFileSync(`${STORE}/media/photo.webp`, Buffer.from([0x52, 0x49, 0x46, 0x46]))
// An attachment with a type outside the renderable families. `.html` is deliberately not in
// `media/mime.ts`, so it serves as octet-stream — the test is that it DOWNLOADS either way.
writeFileSync(`${STORE}/files/page.html`, '<script>1</script>')
writeFileSync(`${STORE}/files/notes.zip`, 'PK')

const app = createApp()
const get = (path: string) => app.fetch(new Request(`http://localhost${path}`))

afterAll(() => {
  process.env.STORAGE_LOCAL_DIR = before
  dropDatabase(DIR)
  try { rmSync(DIR, { recursive: true, force: true }) } catch { /* ignore */ }
})

describe('GET /uploads/*', () => {
  it('sandboxes an SVG, so a script inside one cannot reach this origin', async () => {
    const res = await get('/uploads/media/mark.svg')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/svg+xml')
    const csp = res.headers.get('content-security-policy') ?? ''
    // `sandbox` with no `allow-` token is the load-bearing part: a unique opaque origin, so
    // even if the script ran it could not reach back. Do not add `allow-scripts` here.
    expect(csp).toContain('sandbox')
    expect(csp).not.toContain('allow-scripts')
    expect(csp).toContain("default-src 'none'")
    // An SVG's own <style> block still has to work — it is a drawing, not a document.
    expect(csp).toContain("style-src 'unsafe-inline'")
  })

  it('leaves an ordinary image alone', async () => {
    // The policy is for the one type that can execute. Putting it on everything would be a
    // second global CSP by the back door, which `web/security-headers.ts` argues against.
    const res = await get('/uploads/media/photo.webp')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/webp')
    expect(res.headers.get('content-security-policy')).toBeNull()
  })

  it('keeps the sandbox on a range response too', async () => {
    // Video seeking uses 206, and a partial response is still a response somebody can
    // navigate to. The two branches used to build their headers separately, which is
    // exactly how one of them ends up without the policy.
    const res = await app.fetch(new Request('http://localhost/uploads/media/mark.svg', {
      headers: { range: 'bytes=0-10' },
    }))
    expect(res.status).toBe(206)
    expect(res.headers.get('content-security-policy') ?? '').toContain('sandbox')
  })

  it('forces a download for any type outside the renderable families', async () => {
    // The attachment route accepts every content-type on purpose, and today the dangerous
    // ones are safe only because `media/mime.ts` does not know them — one map entry
    // (`html: 'text/html'`) away from stored same-origin HTML. The disposition header is
    // the rule that does not depend on that map: not an image, font, video, audio or PDF →
    // the browser saves it instead of rendering it. Embedded uses (<img>, fonts from CSS)
    // ignore Content-Disposition, so this costs them nothing.
    for (const path of ['/uploads/files/page.html', '/uploads/files/notes.zip']) {
      const res = await get(path)
      expect(res.status).toBe(200)
      expect(res.headers.get('content-disposition')).toBe('attachment')
    }
    // ...and the renderable families stay renderable.
    expect((await get('/uploads/media/photo.webp')).headers.get('content-disposition')).toBeNull()
    expect((await get('/uploads/media/mark.svg')).headers.get('content-disposition')).toBeNull()
  })

  it('answers 404 for a path that tries to leave the store', async () => {
    for (const path of ['/uploads/../../etc/passwd', '/uploads/media/../../../etc/passwd']) {
      const res = await get(path)
      expect(res.status).not.toBe(200)
    }
  })
})
