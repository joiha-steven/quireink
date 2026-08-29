// GET /uploads/* — serve binaries from the local store.
//
// A near-verbatim port of `app/uploads/[...path]/route.ts`. The file is STREAMED, never
// buffered whole: a 200 MB video must not become 200 MB of resident memory per reader.
//
// Single byte-range requests are honoured (RFC 9110). This is not a nicety: video seeking
// needs 206 responses, and iOS Safari will not play a video at all without them.
//
// Public and read-only. It reads only files the store itself created, and `resolveSafe`
// inside the driver blocks any `..` traversal.

import type { Context } from 'hono'
import { statSize, stream } from '@/media/blob-local'
import { mimeOf } from '@/media/mime'
import { parseRange } from '@/media/http-range'

// Names are content-stable: unique on upload, and a regenerated variant is identical. So
// caching one forever is safe, and it is the whole reason media never needs a cache bust.
const CACHE = 'public, max-age=31536000, immutable'

/**
 * An SVG is a DOCUMENT, and it is the one type in the store that can carry script.
 *
 * `nosniff` does not help here and it is worth being precise about why: nosniff stops a
 * browser DECIDING a file is HTML, and this file genuinely is `image/svg+xml`. Navigated to
 * directly — a tab opened from the media library, a link somebody was sent — the browser
 * renders it as a document and runs any `<script>` inside it, on THIS SITE'S ORIGIN. From
 * there a same-origin `fetch` carries the session cookie and satisfies the CSRF check in
 * `auth/csrf.ts`, because `Sec-Fetch-Site` really does say `same-origin`.
 *
 * Only the owner can upload, so this is not a stranger's attack — it is the booby-trapped
 * icon set the owner downloaded and used as a logo.
 *
 * `sandbox` with no `allow-` token puts the response in a unique opaque origin: no script,
 * no forms, nothing that can reach back. The shapes still draw, which is the entire job of
 * the file. `style-src 'unsafe-inline'` keeps an SVG's own `<style>` block working.
 *
 * A RESPONSE CSP is ignored for a subresource, so `<img src="logo.svg">` on a page is
 * untouched — the logo, the favicon and every SVG in a post render exactly as before. This
 * only binds the case where the SVG is the document.
 *
 * Not a global CSP, and `web/security-headers.ts` says why that stays a deployment
 * decision: a browser enforces the INTERSECTION of every policy it receives, so a second
 * one from the app would silently narrow a proxy's tuned policy. This is one route that can
 * never legitimately execute anything, which makes it the exception rather than the wedge.
 */
const SANDBOXED = new Set(['image/svg+xml'])
const SANDBOX_CSP = "default-src 'none'; style-src 'unsafe-inline'; sandbox"

/**
 * Only these FAMILIES may render when navigated to directly; everything else downloads.
 *
 * The attachment route accepts any content-type on purpose (`media/files.ts` says why), and
 * today the unknown ones are safe by an accident of geography: `.html` is not in
 * `media/mime.ts`, so it falls to octet-stream and `nosniff` stops the browser guessing.
 * That is one map entry away from being false — someone adds `html: 'text/html'` to MIME
 * for a legitimate reason and every stored attachment page becomes same-origin HTML with
 * the session cookie in scope. The rule must live HERE, where the response is built, not in
 * a table in another file that does not know it is load-bearing.
 *
 * Families rather than a list of today's types, so a new image or audio extension keeps
 * working — and a new DOCUMENT type (html, xml, anything) fails safe as a download until
 * someone adds its family deliberately.
 */
const INLINE = (type: string): boolean =>
  type.startsWith('image/') || type.startsWith('font/') || type.startsWith('video/') ||
  type.startsWith('audio/') || type === 'application/pdf'

/** Response headers for a stored file, plus the sandbox when the type can execute. */
function headersFor(type: string, extra: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = { 'Content-Type': type, 'Cache-Control': CACHE, ...extra }
  if (SANDBOXED.has(type)) out['Content-Security-Policy'] = SANDBOX_CSP
  // `Content-Disposition` binds only navigation — an <img>, <video> or CSS font fetch
  // ignores it — so forcing the download costs embedded uses nothing.
  if (!INLINE(type)) out['Content-Disposition'] = 'attachment'
  return out
}

export async function handleUpload(c: Context): Promise<Response> {
  const pathname = c.req.path.replace(/^\/uploads\//, '')

  let size: number
  try {
    size = await statSize(pathname)
  } catch {
    return c.text('Not found', 404)
  }

  const type = mimeOf(pathname)
  const range = parseRange(c.req.header('range') ?? null, size)
  if (range === 'invalid') {
    return new Response(null, {
      status: 416,
      headers: { 'Content-Range': `bytes */${size}`, 'Accept-Ranges': 'bytes' },
    })
  }

  try {
    if (range) {
      return new Response(stream(pathname, range), {
        status: 206,
        headers: headersFor(type, {
          'Content-Length': String(range.end - range.start + 1),
          'Content-Range': `bytes ${range.start}-${range.end}/${size}`,
          'Accept-Ranges': 'bytes',
        }),
      })
    }
    return new Response(stream(pathname), {
      headers: headersFor(type, { 'Content-Length': String(size), 'Accept-Ranges': 'bytes' }),
    })
  } catch {
    return c.text('Not found', 404)
  }
}
