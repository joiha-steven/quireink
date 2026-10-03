// Cloudflare: uploads in an R2 bucket (`BLOBS`), under the same pathnames Bun keeps on disk, so a
// backup moves between the two without renaming anything. The size ceiling and the path rules are
// the same as `bun/blob.ts`: a pathname may not climb out of the store, and nothing over
// `MAX_UPLOAD_MB` is written whatever called.
import { readEnv } from '@/env'
import type { BlobPort } from '@/runtime/ports'
import { bound } from './bindings'

/** Store-relative, no `..`, no leading slash, no empty segment: what `resolveSafe` guarantees on Bun. */
function keyOf(pathname: string): string {
  const parts = pathname.split('/')
  if (!pathname || pathname.startsWith('/') || parts.some((p) => p === '' || p === '.' || p === '..')) {
    throw new Error(`Invalid blob path: ${pathname}`)
  }
  return pathname
}

export const ensureBlobStore: BlobPort['ensureBlobStore'] = () => {}

export const put: BlobPort['put'] = async (pathname, body, opts) => {
  const key = keyOf(pathname)
  const ceiling = readEnv().maxUploadBytes
  if (ceiling > 0 && body.byteLength > ceiling) {
    throw new Error(`Blob too large: ${body.byteLength} bytes for ${pathname} exceeds MAX_UPLOAD_MB (${ceiling} bytes)`)
  }
  const bucket = bound().env.BLOBS
  // `exclusive` is the import's rule that a name is never overwritten. One object, one thread: a
  // head and then a put cannot be interleaved by another request of the same blog.
  if (opts?.exclusive && (await bucket.head(key))) throw new Error(`EEXIST: ${pathname} already exists`)
  await bucket.put(key, body)
  return `/uploads/${pathname}`
}

export const read: BlobPort['read'] = async (pathname) => {
  const object = await bound().env.BLOBS.get(keyOf(pathname))
  if (!object) throw new Error(`ENOENT: ${pathname}`)
  return Buffer.from(await object.arrayBuffer())
}

export const statSize: BlobPort['statSize'] = async (pathname) => {
  const head = await bound().env.BLOBS.head(keyOf(pathname))
  if (!head) throw new Error(`ENOENT: ${pathname}`)
  return head.size
}

export const stream: BlobPort['stream'] = (pathname, range) => {
  const key = keyOf(pathname)
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
  void (async () => {
    const object = await bound().env.BLOBS.get(key, range ? { range: { offset: range.start, length: range.end - range.start + 1 } } : {})
    if (!object) return writable.abort(new Error(`ENOENT: ${pathname}`))
    await object.body.pipeTo(writable)
  })().catch((error: unknown) => writable.abort(error))
  return readable
}

export const del: BlobPort['del'] = async (pathname) => {
  await bound().env.BLOBS.delete(keyOf(pathname))
}

export const list: BlobPort['list'] = async (under = '') => {
  const out: { pathname: string; size: number }[] = []
  const prefix = under ? `${under.replace(/\/+$/, '')}/` : ''
  let cursor: string | undefined
  do {
    const page = await bound().env.BLOBS.list({ prefix, cursor })
    for (const o of page.objects) if (!o.key.startsWith('private/')) out.push({ pathname: o.key, size: o.size })
    cursor = page.truncated ? page.cursor : undefined
  } while (cursor)
  return out
}

/** A bucket that answers a list is a bucket that takes writes; R2 has no read-only mount. */
export const storageWritable: BlobPort['storageWritable'] = async () => {
  try {
    await bound().env.BLOBS.list({ limit: 1 })
    return true
  } catch {
    return false
  }
}
