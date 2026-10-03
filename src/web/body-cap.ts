// How much a request may carry, in two layers (2026-09-30).
//
// Nothing capped a body below Bun's own 128 MB. A 40 MB JSON password to `/api/auth/login` was
// read in full and argon2-verified before the 401, and `/api/comments` and `/api/track` read the
// same 40 MB before refusing it: memory and CPU spent for anyone, before any sign-in.
//
// 1. The process ceiling, `maxRequestBodySize` in `index.ts`: the largest body any route here
//    legitimately takes, plus room for the multipart wrapping. It follows `MAX_UPLOAD_MB`, so an
//    operator who raises that above 128 MB is no longer refused by a number nobody chose.
// 2. A small cap on every route a stranger can write to, checked before the handler reads a
//    byte. Those routes take a sign-in form, a comment, a beacon: kilobytes, never megabytes.
import type { MiddlewareHandler } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { MAX_BODY_BYTES as PEN_BODY_BYTES } from '@/server/reader-marks'
import { fail } from '@/web/api'

const MB = 1024 * 1024

/** WXR is text. Anything larger than this is not an export, it is a mistake or an attack. */
export const MAX_IMPORT_BYTES = 100 * MB
/**
 * What one import may weigh on THIS runtime: 100 MB on Bun; 30 MB on Cloudflare, where the form body
 * and a text copy of the export sit in a 128 MB isolate together (`docs/runtimes.md`, uploadLimits).
 */
export const maxImportBytes = (): number => (process.env.QUIREINK_PACKAGE === 'cloudflare' ? 30 * MB : MAX_IMPORT_BYTES)

/**
 * The most a request may carry at all: the larger of an upload and an import, plus framing.
 * `MAX_UPLOAD_MB=0` is documented as "no limit", so it gets none here either.
 */
export const requestCeiling = (maxUploadBytes: number): number =>
  maxUploadBytes === 0 ? Number.MAX_SAFE_INTEGER : Math.max(maxUploadBytes, MAX_IMPORT_BYTES) + MB

/** What a public write route takes. A 1,000-character comment is 4 KB of JSON at worst. */
export const PUBLIC_BODY_BYTES = 64 * 1024

const capped = (maxSize: number): MiddlewareHandler =>
  bodyLimit({ maxSize, onError: (c) => fail(c, 'too large', 413) })

/**
 * The routes `scripts/checks/routes-guarded.ts` lists as public, less the three authorised by a
 * bearer token (`/api/mcp`, `/micropub`, `/api/cron`), whose bodies are the owner's to size.
 */
const SMALL = [
  '/api/track', '/api/comments', '/comment-auth/signout', '/api/subscribe', '/api/newsletter/*',
  '/api/auth/*', '/api/setup/*', '/api/mcp/register', '/api/mcp/token', '/api/mcp/authorize',
  '/webmention', '/ap/inbox',
]

/** Register before any route, so the cap is met before a handler reads the body. */
export function capPublicBodies(app: { use: (path: string, h: MiddlewareHandler) => unknown }): void {
  const small = capped(PUBLIC_BODY_BYTES)
  for (const path of SMALL) app.use(path, small)
  // A page of a reader's marks is allowed 128 KB once stored; the route reads up to twice that
  // before its own check, so the cap sits there rather than below it.
  const pen = capped(PEN_BODY_BYTES * 2)
  app.use('/api/pen', pen)
  app.use('/api/pen/*', pen)
}
