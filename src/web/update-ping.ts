// Where the update check is triggered from: the first public request of the day.
//
// Not a cron, and the difference is the whole point of the number. A timer says "this
// process was running at midnight", which a forgotten container on a shelf also says. A
// reader arriving says "somebody used this blog today", and that is the sentence the
// receiving end is trying to count. A blog nobody reads is not counted, on purpose.
//
// The middleware is on the hot path of every request, so what it does there is one integer
// comparison against the day this process has already decided about (`server/update-check.ts`).
// Past that, the work is started and never awaited: nothing a reader is waiting for depends
// on it, and the response goes out while the call is still open.

import type { MiddlewareHandler } from 'hono'
import { maybeRunUpdateCheck } from '@/server/update-check'

/**
 * Paths that are not a reader.
 *
 * The owner's own admin is the one that matters: an owner who opens their dashboard every
 * morning and has no readers at all would otherwise report their blog as being used, and
 * "blogs alive" would quietly turn into "blogs whose owner still logs in". `/api` covers
 * the beacon and the machine surfaces, which arrive alongside a page rather than instead
 * of one.
 */
const NOT_A_READER = /^\/(admin|api|login|logout|preview|assets|uploads)(\/|$)/

/** A request for a file rather than a document — an icon, a font, a manifest. They come
    with a page, so counting them would count nothing new, and a bookmarked favicon would
    count a reader who is not there. */
const IS_A_FILE = /\.[a-z0-9]{1,8}$/i

/**
 * Was this request a person reading something?
 *
 * Exported because it is the whole judgement in this file and the middleware around it is
 * four lines of plumbing. A rule that decides what "a blog being used" means deserves cases
 * written down rather than a regex nobody re-reads.
 */
export function countsAsReader(method: string, path: string): boolean {
  return method === 'GET' && !NOT_A_READER.test(path) && !IS_A_FILE.test(path)
}

export function updatePing(): MiddlewareHandler {
  return async (c, next) => {
    if (countsAsReader(c.req.method, c.req.path)) maybeRunUpdateCheck()
    await next()
  }
}
