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
 * A SHORT `Permissions-Policy`, and the shortness is the design.
 *
 * A browser combines every policy it receives by taking the most restrictive, exactly as it
 * does with CSP — which is why CSP is not in this file at all (see the block at the top). The difference, and
 * the reason this one IS, is that every feature named below has no plausible use on a blog
 * at all: nothing in this software asks for a camera, a microphone, a location, a payment
 * sheet, a USB device or a motion sensor, and no proxy in front of it would ever want to
 * allow more of them. Denying those costs an owner nothing they could have wanted.
 *
 * What is NOT named is the point of the list. `fullscreen`, `autoplay`,
 * `picture-in-picture` and `encrypted-media` are left at their defaults because an owner may
 * embed a YouTube, Vimeo or TikTok player — the recommended vhost names all three in
 * `frame-src` — and a parent policy restricts what an iframe may do. `fullscreen=(self)`
 * would take the fullscreen button off an embedded video and nothing would say why.
 * `clipboard-write` is left alone for the same reason in reverse: the copy buttons on code
 * blocks and quotes need it, and its default allowlist already is `self`.
 *
 * `browsing-topics=()` opts out of Chrome's Topics API, which is the same answer this
 * software gives everywhere else: a reader is not an advertising audience.
 */
const PERMISSIONS_POLICY = [
  'accelerometer=()', 'browsing-topics=()', 'camera=()', 'display-capture=()',
  'geolocation=()', 'gyroscope=()', 'magnetometer=()', 'microphone=()', 'midi=()',
  'payment=()', 'usb=()', 'xr-spatial-tracking=()',
].join(', ')

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
  'permissions-policy': PERMISSIONS_POLICY,
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
