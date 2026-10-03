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

  return {
    async write(key, data) {
      const body = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(await data.arrayBuffer())
      await ok(await aws.fetch(`${base}/${encodeKey(key)}`, { method: 'PUT', body }), `put ${key}`)
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
