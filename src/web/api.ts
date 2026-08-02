// Shared shapes for the JSON endpoints, and the one place a request gets logged.
//
// The frozen tree called `logRequest(req, status, start)` at the end of every handler,
// including inside each early return. That is a rule enforced by remembering it, and the
// failure mode is a route that silently logs nothing. Here it is middleware: a request is
// timed and logged because it went through the router, not because its handler remembered
// to. Same idea as Invariant 4 gating writes by router-group membership.

import type { Context, MiddlewareHandler } from 'hono'
import { logActivityError } from '@/server/activity'
import { errorPage, notFoundPage } from '@/web/listing-page'

/**
 * A successful JSON body.
 *
 * `extra` exists for the one response whose body differs per reader (`/api/comments/me`),
 * which has to say `no-store` or a shared cache will greet strangers by someone else's
 * name. Building that response by hand instead would put a second copy of the envelope
 * below in the codebase, and the point of the envelope is that there is only one.
 */
export function json(data: unknown, status = 200, extra?: Record<string, string>): Response {
  // The ENVELOPE is load-bearing, and it went missing in the port. Every admin component
  // reads `json.success` and `json.data` — that is the frozen tree's contract and 68
  // components were written against it. Returning the bare payload type-checked, passed
  // its tests, and made the media library show "no images" over 66 of them, because
  // `j.data` was undefined and the component fell back to an empty list. A shape mismatch
  // between a server and a client that never speak the same types is exactly the failure
  // an integration test catches and a unit test cannot.
  return new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...extra },
  })
}

/** A failure, in the one shape every client can rely on. */
export function fail(c: Context, message: string, status = 400): Response {
  return c.json({ success: false, error: message }, status as 400)
}

/**
 * The one place an unhandled error becomes a response.
 *
 * The frozen tree wrapped every handler in its own try/catch, which meant sixty-one copies
 * of the same four lines and a 500 that was silent wherever one was forgotten. Here a
 * handler is free to throw: this catches it, writes it to the error log, and returns the
 * same typed shape every other failure uses.
 *
 * The message is NOT passed through. An exception string can carry a file path, a SQL
 * fragment or a token, and none of that belongs in a response to whoever triggered it.
 *
 * What it ANSWERS WITH depends on who asked. This returned JSON to everybody, and everybody
 * includes a reader on an article: a thrown handler put `{"error":"Internal error"}` in the
 * browser window, unstyled, with no viewport meta and no way back to the site. The 404 has
 * been a real page in the site shell for exactly this reason. An API client still gets the
 * typed envelope it parses — the split is by path, the same line the router already draws.
 */
const isApi = (path: string): boolean => path.startsWith('/api/') || path === '/api'

export function errorHandler(): (err: Error, c: Context) => Response | Promise<Response> {
  return (err, c) => {
    const where = `${c.req.method} ${c.req.path}`
    console.error(`[ERROR] ${where}: ${err.message}\n${err.stack ?? ''}`)
    void logActivityError(where, err.message)
    if (isApi(c.req.path)) return c.json({ error: 'Internal error' }, 500)
    return errorPage()
  }
}

/**
 * A URL no route claims, answered by the same rule: a page for a reader, an envelope for a
 * client.
 *
 * It lives beside `errorHandler` rather than in `app.ts` so the split by path is stated
 * ONCE. The two are the same decision about the same question, and putting them in
 * different files is how they came to disagree in the first place.
 */
export function notFoundHandler(): (c: Context) => Response | Promise<Response> {
  return (c) => (isApi(c.req.path) ? c.json({ error: 'Not found' }, 404) : notFoundPage())
}

/**
 * Time and log every request.
 *
 * Slow requests are the ones worth seeing, so the line carries the duration. 4xx and 5xx
 * are logged at error level: on a single-tenant blog the log IS the monitoring.
 */
export function requestLogger(): MiddlewareHandler {
  return async (c, next) => {
    const start = performance.now()
    await next()
    const ms = Math.round(performance.now() - start)
    const line = `${c.req.method} ${c.req.path} ${c.res.status} ${ms}ms`
    if (c.res.status >= 400) console.error(`[ERROR] ${line}`)
    else console.log(line)
  }
}
