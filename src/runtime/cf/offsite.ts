// Cloudflare: the bucket the off-site copy writes to (ADR 0035), over S3's own HTTP API signed with
// SigV4 by `aws4fetch`, because a Worker has no `Bun.S3Client`. What to write, when, and what to
// prune is `server/backup-offsite.ts`; this is only the transport, and it speaks to the same
// buckets the Bun side does — R2 (`region: auto`, an account endpoint), AWS, or anything S3-shaped.
//
// PATH-STYLE (`<endpoint>/<bucket>/<key>`), which R2 and every S3 clone take, rather than a bucket
// subdomain some of them do not serve. Nothing here throws while the client is BUILT, only when it
// is used: `replicateSnapshot` builds it outside its `try`, and a throw there would fail the backup
// it is only meant to copy.
import { AwsClient } from 'aws4fetch'
import type { OffsiteClient, OffsitePort } from '@/runtime/ports'

/** Each segment percent-encoded, the slashes kept: a key is a path, not one opaque name. */
const encodeKey = (key: string): string => key.split('/').map(encodeURIComponent).join('/')

const xmlText = (s: string): string =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')

/**
 * Past this an archive goes up as an S3 multipart upload, one part of this size in memory at a time;
 * at or under it, one PUT. 16 MiB: above S3's 5 MiB floor for a part, a sliver of the 128 MB, and
 * few enough requests that a 5 GB archive is 320 parts (S3 allows 10,000).
 */
export const PART = 16 * 1024 * 1024

/** Exactly `size` bytes from `reader`, carrying over what a chunk had past them, or fewer at the end. */
async function take(reader: ReadableStreamDefaultReader<Uint8Array>, carry: { rest: Uint8Array | null }, size: number): Promise<Uint8Array> {
  const out = new Uint8Array(size)
  let at = 0
  while (at < size) {
    let chunk = carry.rest
    carry.rest = null
    if (!chunk) {
      const next = await reader.read()
      if (next.done) break
      chunk = next.value
    }
    const n = Math.min(chunk.length, size - at)
    out.set(chunk.subarray(0, n), at)
    at += n
    if (n < chunk.length) carry.rest = chunk.subarray(n)
  }
  return at === size ? out : out.subarray(0, at)
}

/** The response, or an error naming the step, the status and S3's own code — never the body whole. */
async function ok(res: Response, what: string): Promise<Response> {
  if (res.ok) return res
  const body = (await res.text().catch(() => '')).slice(0, 300)
  const code = /<Code>([^<]*)<\/Code>/.exec(body)?.[1]
  throw new Error(`${what}: ${res.status}${code ? ` ${code}` : ''}`)
}

export const s3Client: OffsitePort['s3Client'] = (config): OffsiteClient => {
  const region = config.region || 'auto'
  const aws = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: 's3',
    region,
    // The off-site copy tries again on the next schedule; a long retry loop inside one alarm is
    // not worth the time it holds the Durable Object for.
    retries: 2,
  })
  const endpoint = config.endpoint || `https://s3.${region === 'auto' ? 'us-east-1' : region}.amazonaws.com`
  const base = `${endpoint.replace(/\/+$/, '')}/${encodeURIComponent(config.bucket)}`

  /**
   * CreateMultipartUpload, UploadPart for each `PART` of the stream, CompleteMultipartUpload; on any
   * failure AbortMultipartUpload, so the bucket keeps no half an archive (and no parts it bills
   * for). Each part is held whole while it is sent because SigV4 signs its hash and a retry has to
   * send it again — 16 MiB at a time, never the archive.
   */
  async function multipart(url: string, key: string, data: { size: number; stream: () => ReadableStream<Uint8Array> }): Promise<number> {
    const created = await (await ok(await aws.fetch(`${url}?uploads`, { method: 'POST' }), `start ${key}`)).text()
    const uploadId = xmlText(/<UploadId>([^<]*)<\/UploadId>/.exec(created)?.[1] ?? '')
    if (!uploadId) throw new Error(`start ${key}: no UploadId in the answer`)
    const reader = data.stream().getReader()
    const carry = { rest: null as Uint8Array | null }
    const etags: string[] = []
    let size = 0
    try {
      for (;;) {
        const part = await take(reader, carry, PART)
        if (part.length === 0 && etags.length > 0) break
        const q = new URLSearchParams({ partNumber: String(etags.length + 1), uploadId })
        const res = await ok(await aws.fetch(`${url}?${q}`, { method: 'PUT', body: part }), `put ${key} part ${etags.length + 1}`)
        const etag = res.headers.get('etag')
        if (!etag) throw new Error(`put ${key} part ${etags.length + 1}: no ETag in the answer`)
        etags.push(etag)
        size += part.length
        if (part.length < PART) break
      }
      const xml = `<CompleteMultipartUpload>${etags.map((e, i) =>
        `<Part><PartNumber>${i + 1}</PartNumber><ETag>${e.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</ETag></Part>`).join('')}</CompleteMultipartUpload>`
      const done = await ok(await aws.fetch(`${url}?${new URLSearchParams({ uploadId })}`, { method: 'POST', body: xml }), `finish ${key}`)
      // S3 can answer 200 to the completion and put the failure in the body.
      const answer = await done.text()
      if (/<Error>/.test(answer)) throw new Error(`finish ${key}: ${/<Code>([^<]*)<\/Code>/.exec(answer)?.[1] ?? 'refused'}`)
      return size
    } catch (error) {
      await reader.cancel().catch(() => undefined)
      await aws.fetch(`${url}?${new URLSearchParams({ uploadId })}`, { method: 'DELETE' }).catch(() => undefined)
      throw error
    }
  }

  return {
    async write(key, data) {
      const url = `${base}/${encodeKey(key)}`
      if (typeof data !== 'string' && data.size > PART) return multipart(url, key, data)
      const body = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(await new Response(data.stream()).arrayBuffer())
      await ok(await aws.fetch(url, { method: 'PUT', body }), `put ${key}`)
      return body.byteLength
    },
    async list(opts) {
      const contents: { key: string }[] = []
      let token: string | null = null
      do {
        const q = new URLSearchParams({ 'list-type': '2' })
        if (opts?.prefix) q.set('prefix', opts.prefix)
        if (token) q.set('continuation-token', token)
        const xml = await (await ok(await aws.fetch(`${base}?${q}`), 'list')).text()
        for (const m of xml.matchAll(/<Key>([^<]*)<\/Key>/g)) contents.push({ key: xmlText(m[1]!) })
        token = /<IsTruncated>true<\/IsTruncated>/.test(xml)
          ? xmlText(/<NextContinuationToken>([^<]*)<\/NextContinuationToken>/.exec(xml)?.[1] ?? '') || null
          : null
      } while (token)
      return { contents }
    },
    async delete(key) {
      const res = await aws.fetch(`${base}/${encodeKey(key)}`, { method: 'DELETE' })
      // S3 answers 204 even for a key that was never there; R2 likewise. A 404 is the same answer.
      if (res.status !== 404) await ok(res, `delete ${key}`)
    },
  }
}

void ({ s3Client } satisfies OffsitePort)
