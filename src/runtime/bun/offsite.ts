// Bun: the bucket the off-site copy writes to (ADR 0035), through Bun's own S3 client. What to
// write, when, and what to prune is `server/backup-offsite.ts`; this is only the transport.
// Cloudflare's side is `cf/offsite.ts`, a signed fetch.
import type { OffsiteClient, OffsitePort } from '@/runtime/ports'

/** The multipart part size for a streamed write, the smallest S3 takes but the last. */
const PART = 5 * 1024 * 1024

export const s3Client: OffsitePort['s3Client'] = (config): OffsiteClient => {
  const client = new Bun.S3Client({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    bucket: config.bucket,
    region: config.region,
    ...(config.endpoint ? { endpoint: config.endpoint } : {}),
  })
  return {
    async write(key, data) {
      // A kept archive on Bun is the file itself (`bun/archive.ts`), and a string is a marker: the
      // client sends both natively, a large file as a multipart upload read from disk.
      if (typeof data === 'string' || data instanceof Blob) return client.write(key, data)
      // Anything else is a stream with a size, written through the client's multipart sink so no
      // more than a part or two is ever in memory.
      const sink = client.file(key).writer({ partSize: PART, queueSize: 2 })
      let size = 0
      for await (const chunk of data.stream()) {
        size += chunk.length
        await sink.write(chunk)
      }
      await sink.end()
      return size
    },
    list: (opts) => client.list(opts),
    delete: (key) => client.delete(key),
  }
}

void ({ s3Client } satisfies OffsitePort)
