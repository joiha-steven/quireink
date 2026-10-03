// The owner's passkeys, from the security card: add one, see the list, remove one (ADR 0071).
//
// Beside `security.ts` and on the same terms: EVERY CHANGE ASKS FOR THE PASSWORD FIRST (`confirms`),
// adding as much as removing. Adding is the dangerous half, which is easy to get backwards: a stolen
// session that could add a passkey would hand its thief a way back in that survives the owner
// changing the password, ending every session and rotating the code. Removing asks too, because
// a stolen session that could strip the owner's passkeys is a nuisance at the least, and one rule
// for the whole card is a rule nobody has to remember the exceptions to.
//
// The registration is two requests, like re-enrolling the authenticator: the options (with a
// challenge bound to THIS session), then the browser's answer. Nothing is stored until the answer
// has been verified, so a ceremony abandoned half way leaves no row behind.

import type { Context } from 'hono'
import { parseUa } from '@/analytics/ua'
import { getSettings } from '@/content/settings'
import { getUser } from '@/auth/users'
import { ALGORITHMS } from '@/auth/cose'
import {
  addPasskey, CHALLENGE_MS, cleanName, credentialHints, mintChallenge, removePasskey, takeChallenge, userHandle,
} from '@/auth/passkeys'
import { parseClientData, verifyRegistration } from '@/auth/webauthn'
import { logAuthEvent } from '@/server/activity'
import { fail, json } from '@/web/api'
import { owner, ownerRouter, QUIET } from '@/web/guard'
import { confirms, isResponse } from '@/web/admin/security'
import { fromB64url, isIpHost, rpIdFor } from '@/web/passkey-routes'

const b64url = (b: Uint8Array): string => Buffer.from(b).toString('base64url')

/** The body, read once. `confirms` reads it too; Hono caches the parsed JSON, so this is free. */
const body = async (c: Context): Promise<Record<string, unknown>> =>
  ((await c.req.json().catch(() => ({}))) as Record<string, unknown>)

export function passkeyAdminRoutes() {
  const router = ownerRouter()

  /**
   * Step one: what `navigator.credentials.create()` needs, binary fields as base64url.
   *
   * `residentKey: 'required'` makes it DISCOVERABLE, which is what lets the sign-in page offer it
   * without being told a username first. `excludeCredentials` names the passkeys already on file,
   * so a device that holds one says so instead of quietly replacing it: an authenticator keeps one
   * passkey per blog and account, and replacing it here would leave a row that can never sign in.
   */
  router.post('/api/security/passkeys/start', async (c) => {
    const ok = await confirms(c)
    if (isResponse(ok)) return ok
    const settings = await getSettings()
    const rpId = rpIdFor(c, settings)
    if (isIpHost(rpId)) return fail(c, 'passkey_needs_name', 400)
    const user = getUser(ok.id)
    if (user === null) return fail(c, 'not_found', 404)
    const challenge = mintChallenge('register', { rpId, userId: ok.id, sessionId: ok.sessionId })
    return json({
      challenge,
      rp: { id: rpId, name: settings.title || 'Quire Ink' },
      user: { id: b64url(userHandle(user)), name: user.username, displayName: user.username },
      pubKeyCredParams: ALGORITHMS.map((alg) => ({ type: 'public-key', alg })),
      timeout: CHALLENGE_MS,
      attestation: 'none',
      authenticatorSelection: { residentKey: 'required', requireResidentKey: true, userVerification: 'required' },
      excludeCredentials: credentialHints(ok.id).map((h) => ({ type: 'public-key', id: h.id, transports: h.transports })),
    })
  }, QUIET)

  /**
   * Step two: the browser's answer, verified and stored.
   *
   * The challenge must have been issued to THIS session, for this account, under this RP ID. A
   * challenge minted in one tab and answered from another session is somebody else's ceremony.
   */
  router.post('/api/security/passkeys/finish', async (c) => {
    const ok = await confirms(c)
    if (isResponse(ok)) return ok
    const input = await body(c)
    const clientDataJSON = fromB64url(input.clientDataJSON)
    const attestationObject = fromB64url(input.attestationObject, 65_536)
    if (!clientDataJSON || !attestationObject) return fail(c, 'bad_passkey', 400)
    let challenge: string
    try { challenge = parseClientData(clientDataJSON).challenge } catch { return fail(c, 'bad_passkey', 400) }
    const rpId = rpIdFor(c, await getSettings())
    const issued = takeChallenge(challenge, 'register')
    if (issued === null || issued.userId !== ok.id || issued.sessionId !== ok.sessionId || issued.rpId !== rpId) {
      return fail(c, 'passkey_expired', 400)
    }
    const result = await verifyRegistration({ clientDataJSON, attestationObject, challenge, rpId })
    if (!result.ok) {
      console.warn(`[WARN] security.passkey: a new passkey was refused (${result.reason})`)
      return fail(c, 'bad_passkey', 400)
    }
    // Named by the owner, or after the device it was made on ("Safari on iOS"), which is the same
    // coarse label the device list uses and is what somebody would type anyway.
    const typed = typeof input.name === 'string' ? input.name : ''
    const ua = c.req.header('user-agent')
    const name = cleanName(typed.trim() || (ua ? `${parseUa(ua).browser} on ${parseUa(ua).os}` : ''))
    const transports = Array.isArray(input.transports) ? input.transports.filter((t): t is string => typeof t === 'string') : []
    const stored = addPasskey({
      userId: ok.id, id: result.credential.id, publicKey: result.credential.publicKey,
      signCount: result.credential.signCount, transports, name,
    })
    if (stored === 'exists') return fail(c, 'passkey_exists', 409)
    if (stored === 'full') return fail(c, 'passkey_full', 400)
    // ALWAYS logged, like a sign-in: a passkey is a new way in, and if one appears that the owner
    // did not add, the session that added it is the one to end.
    logAuthEvent('security.passkey.add', name)
    return json({ id: result.credential.id })
  }, QUIET)

  /** Remove one. The password + code door is untouched, whether this was the last passkey or not. */
  router.post('/api/security/passkeys/remove', async (c) => {
    const ok = await confirms(c)
    if (isResponse(ok)) return ok
    const id = (await body(c)).id
    const name = typeof id === 'string' ? removePasskey(owner(c).user.id, id) : null
    if (name === null) return fail(c, 'not_found', 404)
    logAuthEvent('security.passkey.remove', name)
    return json({ ok: true })
  }, QUIET)

  return router
}
