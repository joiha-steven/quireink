// Bun: the bucket the off-site copy writes to (ADR 0035), through Bun's own S3 client. What to
// write, when, and what to prune is `server/backup-offsite.ts`; this is only the transport.
// Cloudflare's side will be an R2 binding or a signed fetch.
import type { OffsitePort } from '@/runtime/ports'

export const s3Client: OffsitePort['s3Client'] = (config) => new Bun.S3Client({
  accessKeyId: config.accessKeyId,
  secretAccessKey: config.secretAccessKey,
  bucket: config.bucket,
  region: config.region,
  ...(config.endpoint ? { endpoint: config.endpoint } : {}),
})

void ({ s3Client } satisfies OffsitePort)
