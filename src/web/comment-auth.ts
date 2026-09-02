// Sign-in for READERS who want to comment. Three routes and a status probe, all public,
// because a reader is exactly the person who cannot already be signed in.
//
//   GET  /comment-auth/google           leave for Google
//   GET  /comment-auth/google/callback  come back, become a commenter
//   POST /comment-auth/signout          stop being one
//   GET  /api/comments/me               who the island should say you are
//
// ADR 0013. This is not the owner's sign-in and shares nothing with it: the owner has a
// password, a TOTP code and a row in `sessions`; a commenter has a signed cookie that
// fills in two form fields.

import { Hono } from 'hono'
import { UNSAFE_PATH_CHARS } from '@/web/auth-http'
import { getCookie } from 'hono/cookie'
import { getSettings, resolveSiteUrl } from '@/content/settings'
import { getIntegrationKeys } from '@/store/integration-keys'
import {
  authorizeUrl, callbackUrl, exchangeCode, CALLBACK_PATH,
} from '@/comments/google-oauth'
import {
  COMMENTER_COOKIE, clearedCommenterCookie, commenterCookie, issueCommenter, readCommenter,
} from '@/comments/commenter'
import { clientIp, rateLimited } from '@/server/rate-limit'
import { json } from '@/web/api'

/**
 * The short-lived cookie that makes the round trip meaningful.
 *
 * It holds a random nonce and the path to return to. The nonce also travels as the `state`
 * parameter, so the callback can require the two to match: without that, anyone can send a
 * victim a callback URL carrying their OWN authorization code and have the victim's browser
 * quietly adopt the attacker's identity. The return path rides along in the cookie rather
 * than in `state` so a hand-edited `state` cannot steer the final redirect.
 */
const STATE_COOKIE = '__Host-quire_comment_oauth'
const STATE_MAX_AGE_S = 600

/** Failure is told to the reader by the island, through the fragment. See `bounce`. */
const ERROR_FRAGMENT = '#comment-auth-error'

/** Six sign-in starts a minute from one address. A person needs one. */
const PER_MINUTE = 6

/**
 * A path on this site, or `/`.
 *
 * `//evil.example` is the case worth naming: it starts with a slash, so a "must be
 * relative" check written the obvious way passes it, and the browser reads it as
 * protocol-relative and leaves the site. A backslash is the same trick for the engines
 * that normalise it to a slash, and a tab or newline is the same trick again: the parser
 * strips them before it looks, so `/<TAB>/evil.example` reads as `//evil.example`.
 * `UNSAFE_PATH_CHARS` in `web/auth-http.ts` tells the whole story.
 */
function safeReturnPath(raw: string | undefined): string {
  if (!raw || !raw.startsWith('/')) return '/'
  if (raw.startsWith('//') || UNSAFE_PATH_CHARS.test(raw)) return '/'
  return raw
}

const stateCookie = (value: string): string =>
  `${STATE_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${STATE_MAX_AGE_S}`

const clearedStateCookie = (): string =>
  `${STATE_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`

/** A 302 back to where the reader came from, dropping the one-shot state cookie. */
function bounce(to: string, extra?: string): Response {
  const headers = new Headers({ location: to, 'cache-control': 'no-store' })
  headers.append('set-cookie', clearedStateCookie())
  if (extra) headers.append('set-cookie', extra)
  return new Response(null, { status: 302, headers })
}

export function commentAuthRoutes(): Hono {
  const app = new Hono()

  // ----- leave for Google -----------------------------------------------------

  app.get('/comment-auth/google', async (c) => {
    const settings = await getSettings()
    const keys = await getIntegrationKeys()
    const back = safeReturnPath(c.req.query('return'))

    // Both the toggle and the keys. A reader who reaches this URL after the owner turns
    // the feature off gets their post back, not a stack trace.
    if (!settings.comments.enabled || !settings.comments.googleAuth
      || !keys.googleClientId || !keys.googleClientSecret) {
      return bounce(`${back}${ERROR_FRAGMENT}`)
    }
    if (rateLimited(`comment-auth:${clientIp(c)}`, PER_MINUTE)) {
      return bounce(`${back}${ERROR_FRAGMENT}`)
    }

    const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64url')
    const target = authorizeUrl(
      keys.googleClientId,
      callbackUrl(resolveSiteUrl(settings)),
      nonce,
    )
    return new Response(null, {
      status: 302,
      headers: {
        location: target,
        'cache-control': 'no-store',
        'set-cookie': stateCookie(`${nonce}.${Buffer.from(back).toString('base64url')}`),
      },
    })
  })

  // ----- come back ------------------------------------------------------------

  app.get(CALLBACK_PATH, async (c) => {
    const cookie = getCookie(c, STATE_COOKIE) ?? ''
    const [nonce, encodedPath] = cookie.split('.')
    const back = safeReturnPath(
      encodedPath ? Buffer.from(encodedPath, 'base64url').toString('utf8') : '/',
    )

    // Every refusal from here lands the reader back on their post with the manual form
    // still in front of them. There is nothing they could do with a specific reason.
    const code = c.req.query('code')
    if (!code || !nonce || c.req.query('state') !== nonce) return bounce(`${back}${ERROR_FRAGMENT}`)

    const settings = await getSettings()
    const keys = await getIntegrationKeys()
    if (!settings.comments.enabled || !settings.comments.googleAuth
      || !keys.googleClientId || !keys.googleClientSecret) {
      return bounce(`${back}${ERROR_FRAGMENT}`)
    }

    try {
      const who = await exchangeCode(
        code, keys.googleClientId, keys.googleClientSecret, callbackUrl(resolveSiteUrl(settings)),
      )
      // Back to the THREAD, not the top of the post. The reader left from the comment form
      // and returning them a screen above the fold would make them find it again.
      return bounce(`${back}#comments`, commenterCookie(issueCommenter({ ...who, provider: 'google' })))
    } catch (error) {
      // Logged, because a misconfigured client id fails here every time and the owner has
      // no other way to find out. The reader is told nothing beyond "that did not work".
      console.error(`[ERROR] comment-auth.callback: ${(error as Error).message}`)
      return bounce(`${back}${ERROR_FRAGMENT}`)
    }
  })

  // ----- stop being a commenter ----------------------------------------------

  // Clears unconditionally, so there is nothing to get wrong when it is called without a
  // cookie. A forged cross-site call signs a reader out, which is not worth defending.
  app.post('/comment-auth/signout', () => new Response(null, {
    status: 204,
    headers: { 'cache-control': 'no-store', 'set-cookie': clearedCommenterCookie() },
  }))

  // ----- who am I -------------------------------------------------------------
  //
  // `no-store`, and it matters: this is the one public response on the site whose body
  // differs per reader. Cached at the edge for a second it would greet strangers by
  // somebody else's name.

  app.get('/api/comments/me', (c) => {
    const who = readCommenter(getCookie(c, COMMENTER_COOKIE))
    // The NAME only. The island prints it; the address is used by the server when the
    // comment is posted and has no business being readable from a page.
    return json({ commenter: who ? { name: who.name } : null }, 200, { 'cache-control': 'no-store' })
  })

  return app
}
