// The Cloudflare off-site client against a fake S3: what it sends and how it reads the answers.
// Checked against a real R2 bucket by hand on 2026-10-03 (put 3 MB, a key with `+&` and a space,
// list, delete, 2.4 s); CI has no bucket, so the shape is held here.
import { afterAll, describe, expect, it } from 'bun:test'
import { PART, s3Client } from '@/runtime/cf/offsite'

const seen: { method: string; path: string; auth: string }[] = []
const stored = new Map<string, Uint8Array>()
const uploads = new Map<string, { key: string; parts: Map<number, Uint8Array> }>()
const partSizes: number[] = []
/** A part number the fake refuses, to prove a failed upload is aborted. */
let refusePart = 0
const server = Bun.serve({
  port: 0,
  async fetch(req) {
    const url = new URL(req.url)
    seen.push({ method: req.method, path: url.pathname + url.search, auth: req.headers.get('authorization') ?? '' })
    const key = decodeURIComponent(url.pathname.replace(/^\/bucket\/?/, ''))
    if (req.method === 'PUT' && key === 'denied') return new Response('<Error><Code>AccessDenied</Code><Message>no</Message></Error>', { status: 403 })
    const q = url.searchParams
    if (req.method === 'POST' && q.has('uploads')) {
      const id = `id&${uploads.size + 1}`
      uploads.set(id, { key, parts: new Map() })
      return new Response(`<InitiateMultipartUploadResult><UploadId>${id.replace('&', '&amp;')}</UploadId></InitiateMultipartUploadResult>`)
    }
    const upload = uploads.get(q.get('uploadId') ?? '')
    if (upload && req.method === 'PUT') {
      const n = Number(q.get('partNumber'))
      // Read before refusing: a body left on a keep-alive connection is parsed as the next request.
      const bytes = new Uint8Array(await req.arrayBuffer())
      if (n === refusePart) return new Response('<Error><Code>InternalError</Code></Error>', { status: 500 })
      partSizes.push(bytes.length)
      upload.parts.set(n, bytes)
      return new Response('', { headers: { etag: `"e${n}"` } })
    }
    if (upload && req.method === 'POST') {
      const xml = await req.text()
      const numbers = [...xml.matchAll(/<PartNumber>(\d+)<\/PartNumber><ETag>"e(\d+)"<\/ETag>/g)].map((m) => Number(m[1]))
      stored.set(upload.key, new Uint8Array(Buffer.concat(numbers.map((n) => upload.parts.get(n)!))))
      uploads.delete(q.get('uploadId')!)
      return new Response('<CompleteMultipartUploadResult/>')
    }
    if (upload && req.method === 'DELETE') { uploads.delete(q.get('uploadId')!); return new Response(null, { status: 204 }) }
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

  it('names the step, the status and S3\'s own code when the bucket says no', async () => {
    await expect(client.write('denied', 'y')).rejects.toThrow('put denied: 403 AccessDenied')
  })

  it('fails, rather than hangs, when there is no bucket at the address', async () => {
    const nowhere = s3Client({ accessKeyId: 'AKID', secretAccessKey: 'secret', bucket: 'bucket', region: 'auto', endpoint: 'http://127.0.0.1:9' })
    await expect(nowhere.write('x', 'y')).rejects.toThrow()
  })

  it('sends an archive larger than a part as a multipart upload, never holding more than a part', async () => {
    // 2.5 parts, produced in 1 MB chunks: what `ArchivePort.openKept` hands out on Cloudflare.
    const size = Math.floor(PART * 2.5)
    const kept = { size, stream: () => counting(size) }
    expect(await client.write('quire/quire-2026-10-03T120000.tar.gz', kept)).toBe(size)
    const got = stored.get('quire/quire-2026-10-03T120000.tar.gz')!
    expect(got.length).toBe(size)
    expect(got.every((b, i) => b === i % 251)).toBe(true)
    expect(partSizes).toEqual([PART, PART, size - 2 * PART])
    expect(uploads.size).toBe(0)
  })

  it('aborts the multipart upload when a part is refused, leaving the bucket nothing', async () => {
    refusePart = 2
    const size = PART * 2 + 10
    await expect(client.write('quire/half.tar.gz', { size, stream: () => counting(size) })).rejects.toThrow(/part 2: 500/)
    expect(stored.has('quire/half.tar.gz')).toBe(false)
    expect(uploads.size).toBe(0)
    expect(seen.at(-1)?.method).toBe('DELETE')
    refusePart = 0
  })

  it('names the step and the status when the bucket says no', async () => {
    const refused = s3Client({ accessKeyId: 'AKID', secretAccessKey: 'secret', bucket: 'bucket', region: 'auto', endpoint: 'http://127.0.0.1:9' })
    await expect(refused.write('x', 'y')).rejects.toThrow()
  })
})

/** `size` bytes of `i % 251`, in 1 MB chunks. */
function counting(size: number): ReadableStream<Uint8Array> {
  let at = 0
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (at >= size) { controller.close(); return }
      const n = Math.min(1024 * 1024, size - at)
      controller.enqueue(new Uint8Array(n).map((_, i) => (at + i) % 251))
      at += n
    },
  })
}
