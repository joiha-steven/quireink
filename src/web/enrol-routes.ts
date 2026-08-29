// First-run enrolment: setting up an authenticator, saving the recovery codes, and the one
// way past it on a blog nobody can reach yet.
//
// Split from `auth-routes.ts`, which had grown past the file cap. The line is the one the
// flow already drew: everything here is reached with a PENDING TICKET and produces the first
// session, while `auth-routes.ts` keeps the two steps an owner who already enrolled takes.
// The two maps below moved with it — they are keyed by that ticket and used nowhere else.
//
// These routes cannot be owner-gated, because they are how one becomes an owner; each is
// listed in `scripts/checks/routes-guarded.ts` with its reason.

import type { Context } from 'hono'
import type { SiteSettings } from '@/types'
import { getSettings, siteUrlIsUnset } from '@/content/settings'
import { adminT } from '@/i18n/admin-i18n'
import { clientIp } from '@/server/rate-limit'
import { logAuthEvent } from '@/server/activity'
import { otpauthUri, verifyCode } from '@/auth/totp'
import { setTotpLastStep, setTotpSecret } from '@/auth/users'
import { regenerateCodes } from '@/auth/recovery'
import { completeEnrolment, pendingUser } from '@/auth/login'
import { qrSvg } from '@/render/qr'
import { fail, json } from '@/web/api'
import { html, readFields, safeNext, signedIn } from '@/web/auth-http'
import {
  enrolScreen, fillTemplate, passwordScreen, recoveryCodesScreen,
} from '@/web/login-page'

/**
 * Secrets for enrolments in progress, keyed by pending ticket.
 *
 * In memory and short-lived on purpose: writing the secret to `users` before it has been
 * confirmed would leave an account demanding codes from an authenticator that nobody
 * finished setting up, and the only way out of that is the command line.
 */
const pendingSecrets = new Map<string, string>()

/** Recovery codes shown but not yet acknowledged, keyed the same way. */
const pendingCodes = new Map<string, string[]>()

/**
 * Drop what belongs to a ticket that is gone.
 *
 * "Short-lived" above was true of the ticket and not of these maps: both were emptied only on
 * the path where enrolment SUCCEEDS. Anyone who opened the enrolment screen and walked away
 * left a plaintext TOTP secret — and, one step later, a set of recovery codes — held for the
 * life of the process, outliving by an unbounded margin the ticket that was the only thing
 * they could ever be used with.
 *
 * `pendingUser` sweeps the ticket store before it answers, so asking it is what makes an
 * expired ticket say so. Called on every write: the maps hold one entry per enrolment in
 * flight, so the scan is over a handful of keys on an action a blog performs once.
 */
function dropExpired(): void {
  for (const ticket of [...pendingSecrets.keys()]) {
    if (pendingUser(ticket) === null) pendingSecrets.delete(ticket)
  }
  for (const ticket of [...pendingCodes.keys()]) {
    if (pendingUser(ticket) === null) pendingCodes.delete(ticket)
  }
}

/**
 * Both ways in put a secret here: `auth-routes.ts` when a password comes back
 * `need-enrolment`, and `setup-routes.ts` because claiming an install walks straight into
 * enrolment without passing through `/api/auth/login` at all.
 */
export function rememberEnrolmentSecret(ticket: string, secret: string): void {
  dropExpired()
  pendingSecrets.set(ticket, secret)
}

/**
 * Whether the "set this up later" way out is offered — the middle path on 2FA (ADR 0030).
 *
 * ADR 0007 made TOTP mandatory and that stands for any blog with readers. But **before anyone
 * has enrolled, two-factor protects nothing**: whoever reaches the enrolment screen first with
 * the password enrols their own authenticator, so refusing to let the owner in without it
 * closes no door that was open. What it does do is make `docker run` on a laptop, to look at
 * the thing for ten minutes, require a phone.
 *
 * So the gate is the SITE ADDRESS, not the account: no public address means nobody is reading
 * this blog yet. Set one — itself a step of setup — and the button is gone at the very next
 * sign-in, which still asks for enrolment because `totp_secret` is null. No new column, no new
 * state, nothing to migrate: the prompt simply comes back.
 */
export function enrolmentSkippable(settings: SiteSettings): boolean {
  return siteUrlIsUnset(settings)
}

/**
 * Where a session that has just come through enrolment lands.
 *
 * `/setup/site` only while the site address is unset, which is the same signal the boot warning
 * uses and the one thing that step exists to fix. An owner who enrolled again after a TOTP
 * reset has an address by then and goes straight to the admin. An explicit `next` always wins.
 */
function firstRunNext(settings: SiteSettings, next: string): string {
  if (next !== '') return safeNext(next)
  return siteUrlIsUnset(settings) ? '/setup/site' : '/admin'
}

export async function handleEnrol(c: Context): Promise<Response> {
  const { values, wantsHtml } = await readFields(c, ['ticket', 'code'])
  const settings = await getSettings()
  const s = adminT(settings.language)

  const userId = pendingUser(values.ticket)
  const secret = pendingSecrets.get(values.ticket)
  if (userId === null || secret === undefined) {
    if (!wantsHtml) return fail(c, s.authRestart, 401)
    return html(passwordScreen(settings, { error: s.authRestart }), 401)
  }

  // Verified against the pending secret, NOT against the stored one, which is still null.
  // This is the step that proves the app was actually set up.
  const verified = verifyCode(secret, values.code)
  if (!verified.ok) {
    const message = fillTemplate(s.authBadCode, { n: 1 })
    if (!wantsHtml) return fail(c, message, 401)
    return html(enrolScreen(settings, {
      ticket: values.ticket, secret, qr: qrSvg(otpauthUri(secret, String(userId))), error: message,
    }), 401)
  }

  setTotpSecret(userId, secret)
  // AFTER setTotpSecret, which resets the replay floor to null because the old floor
  // referred to steps of a different secret. Without this line the code just used to
  // enrol is still unspent, and replaying it signs in — which is precisely the replay the
  // guard exists to stop. Caught by driving the flow, not by reading it.
  setTotpLastStep(userId, verified.step)
  pendingSecrets.delete(values.ticket)
  logAuthEvent('auth.totp.enrolled')

  const codes = await regenerateCodes(userId)
  dropExpired()
  pendingCodes.set(values.ticket, codes)
  logAuthEvent('auth.recovery.regenerated', 'at enrolment')

  if (!wantsHtml) return json({ status: 'codes', codes })
  return html(recoveryCodesScreen(settings, {
    codes,
    // A data URI, so saving the codes needs no extra route and no second request that
    // would have to be authorised all over again.
    download: `data:text/plain;charset=utf-8,${encodeURIComponent(codes.join('\n'))}`,
  }))
}

/** The "I have saved these" step. Only here does the session finally exist. */
export async function handleEnrolDone(c: Context): Promise<Response> {
  const { values, wantsHtml } = await readFields(c, ['ticket', 'next'])
  const settings = await getSettings()
  const s = adminT(settings.language)

  const refuse = (): Response => {
    if (!wantsHtml) return fail(c, s.authRestart, 401)
    return html(passwordScreen(settings, { error: s.authRestart }), 401)
  }

  // Enrolment must have COMPLETED, not merely started. `pendingCodes` is written only
  // after the confirming TOTP code verified, so its presence is the proof.
  //
  // Without this check the pending ticket alone was enough: anyone with the right password
  // could POST straight here and receive a session, skipping two-factor entirely — on a
  // flow whose whole purpose is that two-factor is not optional. Found because a test
  // asserting something else passed through this path by accident.
  if (!pendingCodes.has(values.ticket)) return refuse()

  const session = completeEnrolment(values.ticket, {
    ip: clientIp(c),
    userAgent: c.req.header('user-agent'),
  })
  pendingCodes.delete(values.ticket)
  if (session === null) return refuse()

  return signedIn(session, firstRunNext(settings, values.next), wantsHtml)
}

/**
 * `POST /api/auth/enrol/skip`: in without an authenticator, once, and only on a blog with
 * no public address.
 *
 * The gate is checked HERE and not merely hidden in the template. A button that is not
 * rendered is not a check — the route is reachable by anyone who can read the HTML of a
 * different install, and this one has to refuse on its own.
 *
 * Nothing is written. `totp_secret` stays null, so the very next sign-in returns
 * `need-enrolment` and asks again — which is the design, not a gap: "later" has to keep
 * meaning later, or it quietly means never.
 */
export async function handleEnrolSkip(c: Context): Promise<Response> {
  const { values, wantsHtml } = await readFields(c, ['ticket', 'next'])
  const settings = await getSettings()
  const s = adminT(settings.language)

  const refuse = (): Response => {
    if (!wantsHtml) return fail(c, s.authRestart, 401)
    return html(passwordScreen(settings, { error: s.authRestart }), 401)
  }

  if (!enrolmentSkippable(settings)) return refuse()
  if (pendingUser(values.ticket) === null) return refuse()

  const session = completeEnrolment(values.ticket, {
    ip: clientIp(c),
    userAgent: c.req.header('user-agent'),
  })
  pendingSecrets.delete(values.ticket)
  if (session === null) return refuse()
  logAuthEvent('auth.totp.deferred', 'no public site address')

  return signedIn(session, firstRunNext(settings, values.next), wantsHtml)
}

/** Test seam: the enrolment maps are process-global. */
export function resetEnrolment(): void {
  pendingSecrets.clear()
  pendingCodes.clear()
}
