// The two public passkey endpoints, and the one fact both ceremonies hang on: the RP ID.
//
// Like the other sign-in routes these cannot be owner-gated, because they are how one becomes the
// owner; each is listed in `scripts/checks/routes-guarded.ts` with its reason. JSON only: a
// passkey needs `navigator.credentials`, so there is no form post to answer and no page without
// JavaScript to render. The password form beside the button is that page, and it is unchanged.
//
// The admin half (adding and removing passkeys) is owner-gated and lives in
// `web/admin/security-passkeys.ts`.

import type { Context, Hono } from 'hono'
import type { SiteSettings } from '@/types'
import { getSettings } from '@/content/settings'
import { adminT } from '@/i18n/admin-i18n'
import { clientIp } from '@/server/rate-limit'
import { beginPasskeySignIn, finishPasskeySignIn } from '@/auth/passkey-login'
import { sessionCookie } from '@/auth/sessions'
import { safeNext } from '@/web/auth-http'
import { fail, json } from '@/web/api'

/**
 * The RP ID: the name a passkey is bound to, for good (WebAuthn §5.1.4).
 *
 * The blog's own host, from its address (`SITE_URL`, or the address in Settings) — the same host
 * readers see, so a passkey made in the admin works on the sign-in page whichever path led there.
 * With NO address set, the host the request arrived on, which is the one place the code already
 * falls back to it (`auth/csrf.ts`): a blog tried on a laptop at `localhost` gets passkeys for
 * `localhost`.
 *
 * ⚠️ AN ADDRESS THAT IS AN IP ALSO FALLS BACK. Browsers refuse an IP as an RP ID outright, so a
 * blog whose address is `http://192.168.1.50` has no RP ID it could ever use; reached by a name
 * instead (`localhost`, a hosts-file entry), the name works. Nothing is weakened: the browser
 * still binds the passkey to the origin it is on, and the server checks the same name back.
 *
 * ⚠️ AND WHY A DOMAIN MOVE ENDS THEM. A passkey made for `old.example` is bound to `old.example`
 * by the authenticator itself; no setting here can carry it to `new.example`, and the browser will
 * not offer it there. The password, the code and the recovery codes work on any address, which is
 * why a passkey is never the only way in. `docs/account.md` says this to the owner, and so does the
 * security card.
 */
export function rpIdFor(c: Context, settings: SiteSettings): string {
  const configured = settings.siteUrl || process.env.SITE_URL || ''
  if (configured) {
    try {
      const host = new URL(configured).hostname
      if (host && !isIpHost(host)) return host
    } catch { /* not a URL: fall through to the request */ }
  }
  // The Host header, as `auth/csrf.ts` reads it; the request's own URL when there is none (a
  // request made in-process has no Host header, and its URL says where it was sent).
  try {
    return new URL(`http://${c.req.header('host') ?? new URL(c.req.url).host}`).hostname
  } catch {
    return 'localhost'
  }
}

/** An IPv4 address or a bracketed IPv6 one, which no browser accepts as an RP ID. */
export const isIpHost = (host: string): boolean => /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith('[')

/** base64url to bytes, refusing anything else rather than skipping it as `Buffer` would. */
export function fromB64url(value: unknown, max = 16_384): Uint8Array | null {
  if (typeof value !== 'string' || value.length > max || !/^[A-Za-z0-9_-]*$/.test(value)) return null
  return new Uint8Array(Buffer.from(value, 'base64url'))
}

/** `POST /api/auth/passkey/options`: a challenge for the sign-in page. */
export async function handlePasskeyOptions(c: Context): Promise<Response> {
  const settings = await getSettings()
  const result = beginPasskeySignIn({ ip: clientIp(c), rpId: rpIdFor(c, settings) })
  if (result.status === 'rate-limited') {
    return c.json({ error: 'too_many_attempts' }, 429, { 'retry-after': String(result.retryAfter) })
  }
  return json(result.options)
}

/** `POST /api/auth/passkey`: the assertion, and a session when it holds. */
export async function handlePasskeySignIn(c: Context): Promise<Response> {
  const settings = await getSettings()
  const s = adminT(settings.language)
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
  const clientDataJSON = fromB64url(body.clientDataJSON)
  const authenticatorData = fromB64url(body.authenticatorData)
  const signature = fromB64url(body.signature)
  const handle = body.userHandle === null || body.userHandle === undefined ? new Uint8Array(0) : fromB64url(body.userHandle, 256)
  const id = typeof body.id === 'string' && /^[A-Za-z0-9_-]{16,1400}$/.test(body.id) ? body.id : null
  if (!clientDataJSON || !authenticatorData || !signature || !handle || !id) return fail(c, s.authPasskeyFailed, 400)

  const result = await finishPasskeySignIn({
    id, clientDataJSON, authenticatorData, signature, userHandle: handle,
    ip: clientIp(c), rpId: rpIdFor(c, settings), userAgent: c.req.header('user-agent'),
  })
  if (result.status === 'ok') {
    // The cookie the password path sets, by the same function. The island reads `location` and
    // goes there, so `next` is held to the same rule as on the form (`safeNext`).
    const location = safeNext(typeof body.next === 'string' ? body.next : undefined)
    return new Response(JSON.stringify({ status: 'ok', location }), {
      headers: { 'set-cookie': sessionCookie(result.token, result.expiresAt), 'content-type': 'application/json; charset=utf-8' },
    })
  }
  if (result.status === 'rate-limited') {
    return c.json({ error: s.authLockedOut.replace('{minutes}', String(Math.ceil(result.retryAfter / 60))) }, 429,
      { 'retry-after': String(result.retryAfter) })
  }
  return fail(c, result.status === 'restart' ? s.authPasskeyExpired : s.authPasskeyFailed, 401)
}

/** Mounted beside the password sign-in in `app.ts`. */
export function registerPasskeyRoutes(app: Hono): void {
  app.post('/api/auth/passkey/options', handlePasskeyOptions)
  app.post('/api/auth/passkey', handlePasskeySignIn)
}
