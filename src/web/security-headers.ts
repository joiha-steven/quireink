// The response headers that cost nothing, apply to every response, and are wrong to omit.
//
// They were not sent at all. `docs/self-host.md` and the vhosts in `scripts/ops/` set them
// in nginx, so the live site has always had them — but that made them a property of ONE
// deployment's proxy rather than of the software, and a self-hoster who runs the binary
// behind anything else (a tunnel, a PaaS, Caddy with a default config, nothing at all)
// served the whole site without them and nothing said so.
//
// Deliberately NOT here: Content-Security-Policy. A useful policy depends on what the
// owner embeds — the frame-src list in the recommended vhost names YouTube, Vimeo, TikTok
// and Turnstile — and a browser enforces the INTERSECTION of every CSP header it receives,
// so a second, narrower policy from the app would silently break the proxy's tuned one.
// CSP stays a deployment decision, documented in `docs/self-host.md`.

import type { MiddlewareHandler } from 'hono'

/**
 * `nosniff` is the one that matters most here, because `/uploads/*` serves owner-uploaded
 * bytes from the site's own origin with a content type derived from the file extension. It
 * stops a browser from deciding for itself that something is HTML and running it.
 *
 * `DENY` because nothing on this site is meant to be framed, and clickjacking a
 * cookie-authenticated admin is the attack it forecloses. `Referrer-Policy` keeps the path
 * a reader came from out of requests to other origins — an unpublished `/preview/…` URL
 * carries its own token in the query string.
 */
const HEADERS: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
}

export function securityHeaders(): MiddlewareHandler {
  return async (c, next) => {
    await next()
    // Never overwrite. A handler that has already said something more specific — and a
    // future one that wants to allow framing on a single route — keeps its answer.
    for (const [name, value] of Object.entries(HEADERS)) {
      if (!c.res.headers.has(name)) c.res.headers.set(name, value)
    }
  }
}
