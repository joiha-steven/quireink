// How large one upload may be, and how large the whole store may grow.
//
// WHY THIS FILE EXISTS: neither number existed anywhere in the software. The only byte limit
// in the tree was `MAX_IMPORT_BYTES` on the WordPress import, and what actually refused an
// oversized image was `client_max_body_size` in nginx — 64M in the recommended vhost, 1m on
// the demo, and whatever a self-hoster's proxy happens to be. That is the same shape of bug
// `web/security-headers.ts` was written to fix, and its own words fit unedited: it made the
// limit "a property of ONE deployment's proxy rather than of the software", so anyone running
// the binary behind a tunnel, a PaaS or nothing at all had no limit and nothing said so.
// Audit 2026-08-11 §2.
//
// TWO LAYERS, and the split is deliberate:
//
//   1. `blob-local.put()` refuses anything over the ENVIRONMENT's ceiling. It is the single
//      point every stored byte passes through — media, attachments, icons, fonts, the
//      derived variants, and the MCP tool that rehosts an image from a URL — so a route that
//      forgets to ask still cannot write past it. It reads no settings and therefore cannot
//      cycle back through `content/settings.ts`, which imports the storage facade itself.
//   2. The routes ask THIS module, which is the environment's ceiling narrowed by the
//      owner's setting, and answer 413. That is what makes the refusal a sentence the admin
//      can show instead of a 500, and — because `File.size` is known before the body is
//      read — it is also what keeps a 900 MB upload from becoming 900 MB of resident memory
//      on the way to being rejected.
//
// THE CEILING ONLY EVER NARROWS. `MAX_UPLOAD_MB` and `STORAGE_QUOTA_GB` are the operator's;
// the admin fields can lower them and can never raise them. An operator hosting a blog for
// somebody else needs a number the blog cannot argue with, and an operator hosting their own
// sets it once and never thinks about it again.

import { readEnv } from '@/env'
import { getSettings } from '@/content/settings'
import { storageStats } from '@/media/storage-stats'

const MB = 1024 * 1024
const GB = 1024 * MB

/** Both caps in bytes, already narrowed by the owner's settings. `0` = no cap. */
export type UploadLimits = {
  maxFileBytes: number
  storeQuotaBytes: number
}

/** Why an upload was refused, with both numbers, so the message can name them. */
export type LimitRefusal = {
  reason: 'file_too_large' | 'quota_exceeded'
  /** The cap that was hit, in bytes. */
  limit: number
  /** What was asked for: the offending file's size, or the store total after the write. */
  actual: number
}

/**
 * A cap that only narrows. `0` on either side means "no cap from me", so the other one wins;
 * with both set the smaller does.
 */
function narrow(ceiling: number, preference: number): number {
  if (ceiling <= 0) return Math.max(0, preference)
  if (preference <= 0) return ceiling
  return Math.min(ceiling, preference)
}

/** The effective caps: the deployment's ceiling, narrowed by what the owner asked for. */
export async function uploadLimits(): Promise<UploadLimits> {
  const env = readEnv()
  const settings = await getSettings()
  return {
    maxFileBytes: narrow(env.maxUploadBytes, Math.round(settings.maxUploadMb * MB)),
    storeQuotaBytes: narrow(env.storeQuotaBytes, Math.round(settings.storageQuotaGb * GB)),
  }
}

/**
 * Refuse a batch before any of it is read, or return `null` to go ahead.
 *
 * Sizes come from `File.size`, which the multipart parser fills in without touching the
 * body. The quota is checked against the batch as a WHOLE — twenty files that each fit but
 * together do not is the case a per-file loop gets wrong.
 *
 * The store total comes from `storageStats()`, which walks the store and caches until
 * something is written, so this costs one walk per upload request at worst and usually
 * nothing. Deliberately the real disk total rather than the sum of the `media` and `files`
 * rows: those carry the ORIGINAL's size, and the derived variants are most of what a photo
 * blog actually occupies.
 */
export async function checkUpload(sizes: number[]): Promise<LimitRefusal | null> {
  const { maxFileBytes, storeQuotaBytes } = await uploadLimits()

  if (maxFileBytes > 0) {
    const tooBig = sizes.find((size) => size > maxFileBytes)
    if (tooBig !== undefined) {
      return { reason: 'file_too_large', limit: maxFileBytes, actual: tooBig }
    }
  }

  if (storeQuotaBytes > 0) {
    const incoming = sizes.reduce((sum, size) => sum + size, 0)
    const after = (await storageStats()).totalBytes + incoming
    if (after > storeQuotaBytes) {
      return { reason: 'quota_exceeded', limit: storeQuotaBytes, actual: after }
    }
  }

  return null
}

/**
 * Read a fetched response body, giving up once it passes the cap.
 *
 * For `add_media_from_url`, the MCP tool that rehosts an image from a URL — the one byte path
 * a reverse proxy cannot see, because it is an OUTBOUND fetch. It called `res.arrayBuffer()`,
 * so any holder of an MCP token could name a URL and have the server pull the whole thing
 * into memory; `client_max_body_size` has no opinion about that and neither did anything else.
 *
 * Streamed rather than buffered-then-measured, and `content-length` is only a shortcut: a
 * server that omits it or lies about it is exactly the case a header check misses, and the
 * point is to stop READING, not to report afterwards. `sizeHint` is the declared length when
 * there was one, so the caller can run the quota check before spending the bytes.
 */
export async function readCapped(
  res: Response,
  maxBytes: number,
): Promise<{ body: ArrayBuffer } | { tooLarge: true; limit: number }> {
  const declared = Number(res.headers.get('content-length') ?? '')
  if (maxBytes > 0 && Number.isFinite(declared) && declared > maxBytes) {
    return { tooLarge: true, limit: maxBytes }
  }
  if (maxBytes <= 0 || res.body === null) return { body: await res.arrayBuffer() }

  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel()
        return { tooLarge: true, limit: maxBytes }
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const body = new Uint8Array(total)
  let at = 0
  for (const chunk of chunks) {
    body.set(chunk, at)
    at += chunk.byteLength
  }
  return { body: body.buffer }
}
