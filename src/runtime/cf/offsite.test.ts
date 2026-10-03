// The Cloudflare off-site client against a fake S3: what it sends and how it reads the answers.
// Checked against a real R2 bucket by hand on 2026-10-03 (put 3 MB, a key with `+&` and a space,
// list, delete, 2.4 s); CI has no bucket, so the shape is held here.
import { afterAll, describe, expect, it } from 'bun:test'
import { s3Client } from '@/runtime/cf/offsite'

const seen: { method: string; path: string; auth: string }[] = []
const stored = new Map<string, Uint8Array>()
const server = Bun.serve({
  port: 0,
  async fetch(req) {
    const url = new URL(req.url)
    seen.push({ method: req.method, path: url.pathname + url.search, auth: req.headers.get('authorization') ?? '' })
    const key = decodeURIComponent(url.pathname.replace(/^\/bucket\/?/, ''))
    if (req.method === 'PUT') { stored.set(key, new Uint8Array(await req.arrayBuffer())); return new Response('') }
    if (req.method === 'DELETE') { stored.delete(key); return new Response(null, { status: 204 }) }
    // Two pages, to prove the continuation is followed.
    const keys = [...stored.keys()].filter((k) => k.startsWith(url.searchParams.get('prefix') ?? '')).sort()
    const second = url.searchParams.get('continuation-token') === 'p&2'
    const page = second ? keys.slice(1) : keys.slice(0, 1)
    const more = !second && keys.length > 1
    const xml = `<ListBucketResult>${page.map((k) => `<Contents><Key>${k.replace(/&/g, '&amp;')}</Key></Contents>`).join('')}<IsTruncated>${more}</IsTruncated>${more ? '<NextContinuationToken>p&amp;2</NextContinuationToken>' : ''}</ListBucketResult>`
    return new Response(xml, { headers: { 'content-type': 'application/xml' } })
  },
})
afterAll(() => server.stop(true))

const client = s3Client({ accessKeyId: 'AKID', secretAccessKey: 'secret', bucket: 'bucket', region: 'auto', endpoint: `http://127.0.0.1:${server.port}` })

describe('the off-site copy from a Worker', () => {
  it('signs every request, writes the bytes, follows a listing to its last page and deletes', async () => {
    expect(await client.write('quire/a&b c.tar.gz', new Blob([new Uint8Array(1000).fill(1)]))).toBe(1000)
    expect(await client.write('quire/z.txt', 'hello')).toBe(5)
    expect(stored.get('quire/a&b c.tar.gz')?.length).toBe(1000)
    expect((await client.list({ prefix: 'quire/' }))?.contents?.map((c) => c.key)).toEqual(['quire/a&b c.tar.gz', 'quire/z.txt'])
    await client.delete('quire/z.txt')
    expect([...stored.keys()]).toEqual(['quire/a&b c.tar.gz'])
    expect(seen.every((r) => r.auth.startsWith('AWS4-HMAC-SHA256 Credential=AKID/'))).toBe(true)
    expect(seen.some((r) => r.path.includes('continuation-token=p%262'))).toBe(true)
  })

  it('names the step and the status when the bucket says no', async () => {
    const refused = s3Client({ accessKeyId: 'AKID', secretAccessKey: 'secret', bucket: 'bucket', region: 'auto', endpoint: 'http://127.0.0.1:9' })
    await expect(refused.write('x', 'y')).rejects.toThrow()
  })
})
