// Invariant 4, made structural: a write route is protected because of WHERE it is
// mounted, not because its handler remembered to check.
//
// The frozen tree called `requireOwner()` as the first line of each handler, and the
// failure mode was exactly what you would expect — one route that did not. Here the check
// is middleware on a router group, so forgetting it is not a line you can omit; it is a
// route you would have to deliberately mount somewhere else.

import { Hono } from 'hono'
import type { Context, MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import { COOKIE_NAME, resolveSession, type SessionRow } from '@/auth/sessions'
import { checkOrigin, isStateChanging } from '@/auth/csrf'
import { getUser, type PublicUser } from '@/auth/users'
import { clearCache } from '@/server/cache'

/** What the gate puts on the context for handlers behind it. */
export type Owner = { user: PublicUser; session: SessionRow }

// Hono's context variable map. Declared here so `c.get('owner')` is typed everywhere
// rather than cast at each call site.
export type OwnerEnv = { Variables: { owner: Owner } }

/**
 * The current owner, or null. Safe to call anywhere, including on public routes that
 * merely want to know (the preview banner, the admin link in the footer).
 */
/**
 * ANY account holding a session is the owner. There is one account (ADR 0002), so those are
 * the same sentence — and what makes them the same sentence is `auth/users.ts`, which refuses
 * to create a second one, not anything here.
 *
 * That is worth knowing before adding a way to sign up. There is no `id = 1` check below and
 * no role column in the schema, so a second account would be a second owner of the same blog,
 * and nothing on any screen would say so.
 */
export function currentOwner(c: Context): Owner | null {
  const session = resolveSession(getCookie(c, COOKIE_NAME))
  if (session === null) return null
  const user = getUser(session.userId)
  // A session whose user was deleted. Not an error, just not an owner.
  return user === null ? null : { user, session }
}

/**
 * Reject anything not signed in, and any state-changing request that cannot prove where
 * it came from.
 *
 * The CSRF check lives HERE rather than as separate middleware, because the two belong
 * together: a cookie-authenticated write is exactly the request that needs both, and
 * splitting them creates the possibility of mounting one without the other.
 */
export function requireOwner(): MiddlewareHandler<OwnerEnv> {
  return async (c, next) => {
    if (isStateChanging(c.req.method)) {
      const origin = checkOrigin(c)
      if (!origin.ok) {
        // 403, not 401: signing in would not help, and a 401 invites a client to retry
        // with credentials it already sent.
        return c.json({ error: 'Cross-site request rejected' }, 403)
      }
    }

    const owner = currentOwner(c)
    if (owner === null) return c.json({ error: 'Unauthorized' }, 401)

    c.set('owner', owner)
    await next()

    // Invariant 1, made structural the way Invariant 4 already is. Until 2026-08-29 it
    // was the only invariant enforced by DISCIPLINE: ~45 hand-placed `clearCache()` calls
    // across four layers, with an inconsistent convention about whether the data layer or
    // the route flushes — which is precisely the failure ("saved the post, the page never
    // changed") the frozen tree kept shipping. Now every successful state-changing request
    // through this gate flushes on the way out. The hand-placed calls remain where they
    // say something sharper (flush only if something actually published); this line is
    // the one that cannot be forgotten. A flush is one Map.clear() — cheap by design,
    // which is what makes the blunt form affordable (docs/invariants.md, "Why 1 is blunt").
    if (isStateChanging(c.req.method) && c.res.status < 400) clearCache()
  }
}

type Handler = (c: Context) => Response | Promise<Response>

/**
 * The signed-in owner, inside a gated handler.
 *
 * Throws rather than returning null: every route that can reach this is behind
 * `requireOwner()`, so an absent owner is a routing mistake, not a case to handle. It
 * becomes a logged 500, which is what a routing mistake deserves.
 */
export function owner(c: Context): Owner {
  const found = (c as Context<OwnerEnv>).get('owner')
  if (found === undefined) throw new Error('owner() called outside an owner-gated route')
  return found
}

/**
 * A path parameter, as a string.
 *
 * Hono infers `:slug` from the literal path when a handler is typed against it. These
 * handlers are typed against a bare `Context` — the price of the wrapper below — so it
 * cannot, and every `param()` reads as possibly undefined.
 *
 * It throws rather than defaulting to `''`, so a misspelled name becomes a logged 500
 * instead of a lookup for the empty slug that quietly 404s and looks like missing data.
 */
export function param(c: Context, name: string): string {
  const value = c.req.param(name)
  if (value === undefined) throw new Error(`route parameter :${name} is not in this route's path`)
  return value
}

/**
 * A router group behind the gate. Register a route on it and it is protected; there is no
 * way to register one that is not.
 *
 * The gate is attached PER REGISTRATION, not as `use('*')` on the sub-app. That is not a
 * style choice: `app.route('/', sub)` copies the sub-app's middleware into the parent as
 * `/*`, so a `use('*')` gate here applied to every public page on the site. Every route
 * 401'd, which at least failed loudly — the same mistake in the other direction would have
 * been a silent hole.
 *
 * The invariant survives intact, because the gate is still a property of WHERE the route
 * is registered rather than a line inside the handler.
 */
export class OwnerRouter {
  /** Exposed so the caller can `app.route('/', ownerRouter.routes)`. */
  readonly routes = new Hono<OwnerEnv>()
  private readonly gate = requireOwner()

  get(path: string, handler: Handler): void { this.routes.get(path, this.gate, handler) }
  post(path: string, handler: Handler): void { this.routes.post(path, this.gate, handler) }
  put(path: string, handler: Handler): void { this.routes.put(path, this.gate, handler) }
  patch(path: string, handler: Handler): void { this.routes.patch(path, this.gate, handler) }
  delete(path: string, handler: Handler): void { this.routes.delete(path, this.gate, handler) }
}

export function ownerRouter(): OwnerRouter {
  return new OwnerRouter()
}
