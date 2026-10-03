// The Worker acting on itself (`self.ts`) and the move's first questions, against a fake Cloudflare,
// a fake bucket and a fake object — each case the shape of a bug a review found on 2026-10-03.
import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import { runUninstall, runUpdate, type Bucket } from './self'
import { moveStatus, resetMove, startMove } from './move'
import { estimateMonthly } from '@/web/admin/cloudflare-update'

let tokenOk = true
let scriptExists = true
const calls: { method: string; path: string }[] = []
const api = Bun.serve({
  port: 0,
  fetch(req) {
    const p = new URL(req.url).pathname
    calls.push({ method: req.method, path: p })
    const ok = (result: unknown) => Response.json({ success: true, result })
    const no = (status: number, message: string) => Response.json({ success: false, errors: [{ code: 1, message }] }, { status })
    if (p.endsWith('/tokens/verify')) return tokenOk ? ok({ status: 'active' }) : no(401, 'Invalid API Token')
    if (!tokenOk) return no(403, 'Authentication error')
    if (p.endsWith('/subscriptions')) return ok([{ rate_plan: { id: 'workers_paid' } }])
    if (p.endsWith('/settings')) return scriptExists ? ok({}) : no(404, 'not found')
    if (p.endsWith('/workers/subdomain')) return ok({ subdomain: 'acct' })
    if (p.includes('/r2/buckets/')) return ok({})
    if (req.method === 'DELETE') return ok({})
    return no(404, `unexpected ${req.method} ${p}`)
  },
})
afterAll(() => api.stop(true))
const apiBase = `http://127.0.0.1:${api.port}`

function bucket(): Bucket & { deleted: string[] } {
  let keys = ['media/a.jpg', 'private/backups/quire-1.tar.gz']
  const deleted: string[] = []
  return {
    deleted,
    list: async () => ({ objects: keys.map((key) => ({ key })) }),
    delete: async (ks) => { deleted.push(...ks); keys = keys.filter((k) => !ks.includes(k)) },
  }
}

const env = { QUIREINK_SCRIPT: 'quireink-x', QUIREINK_BUCKET: 'quireink-x' }
const owner = (body = '{"data":{"current":"1.0.0","latest":null}}') => async () => new Response(body, { status: 200 })
const post = (url: string, body: unknown) => new Request(url, { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) })

beforeEach(() => { tokenOk = true; scriptExists = true; calls.length = 0; resetMove() })

describe('leaving Cloudflare', () => {
  it('deletes nothing when the token cannot reach the Worker and the bucket', async () => {
    tokenOk = false
    const b = bucket()
    const res = await runUninstall(post('https://blog.test/api/cloudflare/uninstall', { current: 'pw', confirm: 'blog.test', token: 'typo', accountId: 'a' }), env, b, owner(), { apiBase })
    expect(res.status).toBe(403)
    expect(((await res.json()) as { error: string }).error).toStartWith('token_cannot')
    expect(b.deleted).toEqual([])
  })

  it('returns the object\'s refusal as it came, and deletes nothing', async () => {
    const b = bucket()
    const res = await runUninstall(post('https://blog.test/x', { token: 't', accountId: 'a' }), env, b, async () => new Response('{"error":"wrong_password"}', { status: 403 }), { apiBase })
    expect(res.status).toBe(403)
    expect(b.deleted).toEqual([])
  })

  it('empties the bucket, then deletes the bucket, then the Worker — never sending the token to the object', async () => {
    const b = bucket()
    let toObject = ''
    const res = await runUninstall(post('https://blog.test/x', { current: 'pw', confirm: 'blog.test', token: 't', accountId: 'a' }), env, b, async (_p, body) => { toObject = body; return new Response('{}') }, { apiBase })
    expect(res.status).toBe(200)
    expect(b.deleted.sort()).toEqual(['media/a.jpg', 'private/backups/quire-1.tar.gz'])
    const deletes = calls.filter((c) => c.method === 'DELETE').map((c) => c.path)
    expect(deletes[0]).toEndWith('/r2/buckets/quireink-x')
    expect(deletes[1]).toEndWith('/workers/scripts/quireink-x')
    expect(JSON.parse(toObject)).toEqual({ current: 'pw', confirm: 'blog.test' })
  })

  it('answers a body that is not JSON with a 400, not a crash', async () => {
    const res = await runUninstall(post('https://blog.test/x', '{not json'), env, bucket(), owner(), { apiBase })
    expect(res.status).toBe(400)
  })
})

describe('the one-click update', () => {
  it('asks GitHub for the newest release when the daily check has no answer, and says when there is nothing newer', async () => {
    const github = (async (url: string) => (String(url).includes('api.github.com') ? Response.json({ tag_name: 'v1.0.0' }) : new Response('', { status: 404 }))) as typeof fetch
    const res = await runUpdate(post('https://blog.test/api/cloudflare/update', {}), env, owner(), { apiBase, fetchImpl: github })
    expect(res.status).toBe(409)
    expect(((await res.json()) as { error: string }).error).toBe('already_newest')
  })
})

describe('moving onto a Worker that already exists', () => {
  it('stops before uploading anything when that Worker already holds a blog', async () => {
    const claimed = (async (url: string) => (String(url).endsWith('/setup') ? new Response('', { status: 404 }) : new Response('', { status: 404 }))) as typeof fetch
    startMove({
      accountId: 'a', token: 't', siteUrl: 'https://blog.test', selfUpdate: false, confirmedPaid: true,
      archive: async () => new Blob(['x']), newestPath: async () => null, apiBase, fetchImpl: claimed,
    })
    for (let i = 0; i < 50 && moveStatus()?.running; i++) await Bun.sleep(20)
    const s = moveStatus()!
    expect(s.error).toContain('already holds a blog')
    expect(s.steps.check).toBe('fail')
    expect(calls.some((c) => c.method === 'PUT')).toBe(false)
  })
})

describe('what a month on Workers Paid costs', () => {
  it('counts every request as a Durable Object request too, and backups in R2', () => {
    expect(estimateMonthly(100_000, 1e9, 1e8).usd).toBe(5)
    expect(estimateMonthly(1_000_000, 1e9, 1e8).usd).toBe(5.15) // 2M object requests, 1M included
    expect(estimateMonthly(5_000_000, 1e9, 1e8).usd).toBe(6.35) // 10M requests: Worker at the line, objects 9M over
    expect(estimateMonthly(100_000, 20e9, 1e8).usd).toBe(5.15) // 10 GB of R2 past what is included
  })
})
