// The one-click update against a fake Cloudflare: what it sends, and that a version which does not
// answer is replaced by the one before. Checked against a real account by hand before a release.
import { afterAll, describe, expect, it } from 'bun:test'
import { updateSelf } from './update'
import { estimateMonthly } from '@/web/admin/cloudflare-update'

const calls: { method: string; path: string; body: string }[] = []
let healthVersion = '9.9.9'
const OLD = 'v-old-0001'
const api = Bun.serve({
  port: 0,
  async fetch(req) {
    const url = new URL(req.url)
    const body = req.method === 'GET' ? '' : await req.text()
    calls.push({ method: req.method, path: url.pathname, body })
    const ok = (result: unknown) => Response.json({ success: true, result })
    const p = url.pathname
    if (p.endsWith('/tokens/verify')) return ok({ status: 'active' })
    if (p.endsWith('/subscriptions')) return ok([{ rate_plan: { id: 'workers_paid' } }])
    if (p.endsWith('/r2/buckets')) return ok({ buckets: [{ name: 'quireink-test' }] })
    if (p.endsWith('/settings')) return ok({})
    if (p.endsWith('/assets-upload-session')) return ok({ jwt: 'done', buckets: [] })
    if (p.endsWith('/deployments') && req.method === 'GET') return ok({ deployments: [{ id: 'd1', versions: [{ version_id: OLD, percentage: 100 }] }] })
    if (p.endsWith('/deployments') && req.method === 'POST') return ok({ id: 'd2' })
    if (p.endsWith('/workers/subdomain')) return ok({ subdomain: 'acct' })
    if (p.includes('/workers/scripts/') && req.method === 'PUT') return ok({ id: 'quireink-test' })
    if (p === '/site/api/health') return Response.json({ status: 'ok', version: healthVersion })
    return Response.json({ success: false, errors: [{ code: 1, message: `unexpected ${req.method} ${p}` }] }, { status: 404 })
  },
})
afterAll(() => api.stop(true))
const base = `http://127.0.0.1:${api.port}`

/** A package of one tiny worker file and any `public/` files, as `fetchPackage` would hand it over. */
async function release(version: string, publicFiles: Record<string, string> = {}): Promise<typeof fetch> {
  const hexOf = async (b: Uint8Array<ArrayBuffer>) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', b))].map((x) => x.toString(16).padStart(2, '0')).join('')
  const contents = [['worker/worker.js', 'export default {}'], ...Object.entries(publicFiles).map(([k, v]) => [`public/${k}`, v])]
    .map(([name, text]) => ({ name: name!, body: new TextEncoder().encode(text!) }))
  const manifest = new TextEncoder().encode(JSON.stringify({
    format: 'quireink-cf/1', version, main: 'worker/worker.js', compatibilityDate: '2026-09-30', compatibilityFlags: [],
    durableObjects: [{ binding: 'BLOG', className: 'Blog' }], bindings: { r2: 'BLOBS', assets: 'ASSETS', images: 'IMAGES' },
    files: await Promise.all(contents.map(async (f) => ({ path: f.name, bytes: f.body.length, sha256: await hexOf(f.body) }))),
  }))
  const { tarStream } = await import('@/server/tar')
  const bytes = new Uint8Array(await new Response(tarStream([
    { name: 'manifest.json', size: manifest.length, body: manifest },
    ...contents.map((f) => ({ name: f.name, size: f.body.length, body: f.body })),
  ])).arrayBuffer())
  const sum = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join('')
  return (async (url: string) => (String(url).endsWith('.sha256') ? new Response(`${sum}  x.tar`) : new Response(bytes))) as typeof fetch
}

const options = async (target: string, publicFiles?: Record<string, string>) => ({
  token: 't', accountId: 'a', scriptName: 'quireink-test', bucket: 'quireink-test', siteUrl: `${base}/site`, target,
  apiBase: base, fetchImpl: await release(target, publicFiles), healthTimeout: 4,
})

describe('the one-click update', () => {
  it('uploads the new version as an update and keeps the address and the variables as they are', async () => {
    calls.length = 0
    healthVersion = '9.9.9'
    const r = await updateSelf(await options('9.9.9'))
    expect(r).toEqual({ from: OLD, to: '9.9.9', rolledBack: false, error: '' })
    const put = calls.find((c) => c.method === 'PUT')!
    expect(put.body).toContain('"keep_bindings":["secret_text","plain_text"]')
    expect(put.body).not.toContain('new_sqlite_classes') // an update never re-declares the class
    expect(calls.some((c) => c.path.endsWith(`/scripts/quireink-test/subdomain`))).toBe(false) // workers.dev left alone
  })

  it('hands `_headers` over as Static Assets rules, never as a file anyone can fetch', async () => {
    // The build writes `public/_headers` (scripts/build-worker.ts, item 7). wrangler leaves it out
    // of the upload and sends its text with the Worker; uploaded as a file it would be served at
    // `/_headers` and obeyed by nobody, and every font and chunk would go out revalidating.
    calls.length = 0
    healthVersion = '9.9.9'
    const rules = '/fonts/*\n  Cache-Control: public, max-age=31536000, immutable\n'
    await updateSelf(await options('9.9.9', { _headers: rules, 'fonts/a.woff2': 'wOF2' }))
    const session = JSON.parse(calls.find((c) => c.path.endsWith('/assets-upload-session'))!.body) as { manifest: Record<string, unknown> }
    expect(Object.keys(session.manifest)).toEqual(['/fonts/a.woff2'])
    expect(calls.find((c) => c.method === 'PUT')!.body).toContain(`"config":{"_headers":${JSON.stringify(rules)}}`)
  })

  it('puts the version before back when the new one does not answer as itself', async () => {
    calls.length = 0
    healthVersion = '1.0.0' // still the old code answering
    const r = await updateSelf(await options('9.9.9'))
    expect(r.rolledBack).toBe(true)
    expect(r.error).toContain('did not answer')
    const back = calls.find((c) => c.method === 'POST' && c.path.endsWith('/deployments'))!
    expect(JSON.parse(back.body)).toEqual({ strategy: 'percentage', versions: [{ version_id: OLD, percentage: 100 }] })
  }, 15_000)
})

describe('what a month on Workers Paid costs', () => {
  it('is $5 inside what is included, and grows only past it', () => {
    expect(estimateMonthly(100_000, 1e9, 1e8).usd).toBe(5)
    expect(estimateMonthly(100_000, 1e9, 1e8).requests).toBe(200_000)
    expect(estimateMonthly(10e6, 1e9, 1e8).usd).toBeGreaterThan(5)
  })
})
