// The account, which had no screen and no routes at all.
//
// `docs/spec/06-auth.md` has described "Settings → Security: change password, re-enrol 2FA,
// regenerate recovery codes, active session list with revoke" since the spec was written.
// None of it existed. Not a stale label — no route answered any of it, and the admin never
// asked. Meanwhile `listSessions`, `revokeAllSessions` and `remainingCodes` sat in
// `src/auth/`, written and tested, called by nothing: the third time this week a capability
// turned out to be finished and doorless (issue #60, then the per-piece analytics).
//
// What that cost, concretely: an owner whose laptop was stolen had no way to end its session,
// and an owner down to their last recovery code had no way to make more.
//
// THE PASSWORD IS THE KEY TO ALL OF IT. Every route here that changes something asks for the
// current password first — not as ceremony, but because a stolen session is exactly the
// threat these controls exist to answer, and a control that lets a stolen session rotate the
// 2FA secret hands the account over instead of taking it back.
import type { Context } from 'hono'
import { checkPassword, verifyPassword } from '@/auth/password'
import { getUser, passwordHashFor, setPassword, setTotpLastStep, setTotpSecret, totpStateFor } from '@/auth/users'
import { regenerateCodes, remainingCodes } from '@/auth/recovery'
import { listSessions, revokeAllSessions, revokeSession } from '@/auth/sessions'
import { generateSecret, otpauthUri, verifyCode } from '@/auth/totp'
import { logActivity } from '@/server/activity'
import { rateLimited } from '@/server/rate-limit'
import { clientIp } from '@/server/rate-limit'
import { fail, json } from '@/web/api'
import { owner, ownerRouter, param } from '@/web/guard'

const body = async <T>(c: Context): Promise<Partial<T>> =>
  (await c.req.json().catch(() => ({}))) as Partial<T>

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

/**
 * The current password, checked.
 *
 * Rate limited per IP even though the caller is already signed in: the point of asking is
 * that the session might not be the owner's, and an attacker holding a stolen cookie would
 * otherwise have unlimited guesses at the password from inside the admin.
 */
async function confirms(c: Context): Promise<{ id: number; sessionId: string } | Response> {
  const { user, session } = owner(c)
  const ip = clientIp(c)
  if (rateLimited(`security:${ip}`, 10, 5 * 60_000)) return fail(c, 'too_many_attempts', 429)
  const given = str((await body<{ current: unknown }>(c)).current)
  const stored = passwordHashFor(user.username)
  if (!stored || !(await verifyPassword(stored.hash, given))) return fail(c, 'wrong_password', 403)
  return { id: user.id, sessionId: session.id }
}

const isResponse = (v: unknown): v is Response => v instanceof Response

export function securityRoutes() {
  const router = ownerRouter()

  /**
   * What the screen shows. No secret leaves here — a session row carries a coarse device
   * bucket and a salted IP hash, never an address, and the TOTP secret is reported only as
   * on or off.
   */
  router.get('/api/security', async (c) => {
    const { user, session } = owner(c)
    return json({
      currentSessionId: session.id,
      recoveryLeft: remainingCodes(user.id),
      totpEnabled: totpStateFor(user.id)?.secret != null,
      sessions: listSessions(user.id).map((s) => ({
        id: s.id,
        device: s.userAgent,
        createdAt: s.createdAt,
        lastSeenAt: s.lastSeenAt,
        current: s.id === session.id,
      })),
    })
  })

  /**
   * A new password, and every OTHER device signed out.
   *
   * The revoke is the point, not a courtesy: someone changes their password BECAUSE they
   * think somebody else has it, and leaving the other sessions alive would answer the wrong
   * half of that. The current session survives, so the person doing it is not thrown out of
   * the page they are standing on — which is what `revokeAllSessions`' own comment has said
   * since it was written, unused.
   */
  router.post('/api/security/password', async (c) => {
    const ok = await confirms(c)
    if (isResponse(ok)) return ok
    const next = str((await body<{ next: unknown }>(c)).next)
    const user = getUser(ok.id)
    const problem = checkPassword(next, [user?.username ?? '', user?.email ?? ''])
    if (problem) return fail(c, problem, 400)
    await setPassword(ok.id, next)
    const ended = revokeAllSessions(ok.id, ok.sessionId)
    void logActivity('security.password', `signed out ${ended} other session(s)`)
    return json({ signedOut: ended })
  })

  /**
   * A fresh set of recovery codes, shown ONCE.
   *
   * `regenerateCodes` replaces the old set, so the answer is the only copy that will ever
   * exist. The screen says so before the button is pressed.
   */
  router.post('/api/security/recovery', async (c) => {
    const ok = await confirms(c)
    if (isResponse(ok)) return ok
    const codes = await regenerateCodes(ok.id)
    void logActivity('security.recovery', `${codes.length} new code(s)`)
    return json({ codes })
  })

  /**
   * Step one of re-enrolling 2FA: a secret to scan. NOTHING IS STORED YET.
   *
   * Storing it here would break the account for anyone who starts the flow and walks away —
   * the old authenticator would stop working and the new one would never have been scanned.
   * The secret lives in the browser until a code proves it arrived.
   */
  router.post('/api/security/totp/start', async (c) => {
    const ok = await confirms(c)
    if (isResponse(ok)) return ok
    const user = getUser(ok.id)
    const secret = generateSecret()
    return json({ secret, uri: otpauthUri(secret, user?.username ?? 'owner') })
  })

  /** Step two: a code from the new authenticator, and only then does the secret replace the old. */
  router.post('/api/security/totp/confirm', async (c) => {
    const ok = await confirms(c)
    if (isResponse(ok)) return ok
    const input = await body<{ secret: unknown; code: unknown }>(c)
    const secret = str(input.secret)
    const code = str(input.code)
    // No `minStep`: this secret is brand new, so nothing has been spent against it yet. The
    // step that proved it IS then recorded, or the very code just typed would still be live
    // for the rest of its window — the replay `verifyCode` documents and the login path
    // already defends against.
    const proof = verifyCode(secret, code)
    if (!secret || !proof.ok) return fail(c, 'bad_code', 400)
    setTotpSecret(ok.id, secret)
    setTotpLastStep(ok.id, proof.step)
    void logActivity('security.totp', 're-enrolled')
    return json({ ok: true })
  })

  /**
   * End one session. No password: this only ever REMOVES access, so the worst a misfired
   * call can do is sign somebody out — and signing yourself out is what the button next to
   * your own row says it does.
   */
  router.delete('/api/security/sessions/:id', async (c) => {
    const { user } = owner(c)
    const id = param(c, 'id')
    if (!revokeSession(user.id, id)) return fail(c, 'not_found', 404)
    void logActivity('security.session', 'revoked one')
    return json({ ok: true })
  })

  /** Sign out everywhere else. Same reasoning: it only takes access away. */
  router.post('/api/security/sessions/revoke-others', async (c) => {
    const { user, session } = owner(c)
    const ended = revokeAllSessions(user.id, session.id)
    void logActivity('security.session', `revoked ${ended} other session(s)`)
    return json({ signedOut: ended })
  })

  return router
}
