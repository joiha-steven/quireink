// GET /themes/<hash>/<path> — the files of a theme installed from a zip (ADR 0072, T2).
//
// Public, because a reader's browser fetches the sheet, its fonts and its pictures. It answers only
// a hash the `themes` table names and only a path that package listed (`installedThemeFile`), so
// the rest of the blob store is not reachable through it, and every byte it serves passed the
// install-time checker.
//
// The URL carries the hash of the package, so the bytes behind it never change: a year and
// `immutable`, as `/assets` sends. A version rolled back or removed keeps answering, for the pages
// a cache still holds.
//
// `theme.css` goes out inside `@layer theme` (`web/css-layers.ts`): over the base sheet, under the
// owner's settings and custom CSS. The wrapper is put on here, so the stored bytes are the ones the
// checker read. A `url()` in it is relative and resolves against this same directory.

import type { Context } from 'hono'
import { readBlob } from '@/media/blob'
import { statSize, stream } from '@/runtime/impl/blob'
import { installedThemeFile, themeBlobPath } from '@/content/installed-themes'
import { inLayer } from '@/web/css-layers'

const IMMUTABLE = 'public, max-age=31536000, immutable'
/** The same sandbox `/uploads` puts on an SVG (`web/uploads.ts` says why). */
const SVG_SANDBOX = "default-src 'none'; style-src 'unsafe-inline'; sandbox"

/** `/themes/<hash>/<path>` split, or null when it is not that shape. */
function target(path: string): { hash: string; file: string } | null {
  const m = /^\/themes\/([^/]+)\/(.+)$/.exec(path)
  return m ? { hash: m[1]!, file: m[2]! } : null
}

export async function handleThemeFile(c: Context): Promise<Response> {
  const want = target(c.req.path)
  const found = want ? installedThemeFile(want.hash, want.file) : null
  if (!want || !found) return c.text('Not found', 404)
  const pathname = themeBlobPath(want.hash, found.path)
  const headers: Record<string, string> = {
    'Content-Type': found.type,
    'Cache-Control': IMMUTABLE,
    'X-Content-Type-Options': 'nosniff',
  }
  if (found.type === 'image/svg+xml') headers['Content-Security-Policy'] = SVG_SANDBOX

  try {
    if (found.path === 'theme.css') {
      const css = new TextDecoder().decode(await readBlob(pathname))
      return new Response(inLayer('theme', css), { headers })
    }
    const size = await statSize(pathname)
    return new Response(stream(pathname), { headers: { ...headers, 'Content-Length': String(size) } })
  } catch (error) {
    // The row names it and the store does not have it: a store restored without its theme files,
    // or a disk that lost one. Said in the log, answered as missing.
    console.error(`[ERROR] theme file ${pathname}: ${(error as Error).message}`)
    return c.text('Not found', 404)
  }
}
