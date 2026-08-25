// The sign-in endpoints.
//
// Each takes either a form post or JSON and answers in kind, the same deviation the
// newsletter routes make and for the same reason: the forms are server-rendered, so a
// reader without JavaScript can submit them, and answering a form post with a page of JSON
// would be a defect created here rather than one carried over.
//
// These are the only write routes that cannot be owner-gated — they are how one becomes an
// owner — so each is listed in `scripts/checks/routes-guarded.ts` with its reason.

import type { Context } from 'hono'
import type { SiteSettings } from '@/types'
import { getCookie } from 'hono/cookie'
import { getSettings, siteUrlIsUnset } from '@/content/settings'
import { adminT } from '@/i18n/admin-i18n'
import { clientIp } from '@/server/rate-limit'
import { logAuthEvent } from '@/server/activity'
import {
  clearedCookie, COOKIE_NAME, resolveSession, revokeSession, sessionCookie,
} from '@/auth/sessions'
import { generateSecret, otpauthUri, verifyCode } from '@/auth/totp'
import { setTotpLastStep, setTotpSecret } from '@/auth/users'
import { regenerateCodes } from '@/auth/recovery'
import { completeEnrolment, pendingUser, submitPassword, submitSecondFactor } from '@/auth/login'
import { qrSvg } from '@/render/qr'
import { fail, json } from '@/web/api'
import {
  enrolScreen, fillTemplate, passwordScreen, recoveryCodesScreen, twoFactorScreen,
} from '@/web/login-page'

const html = (body: string, status = 200): Response =>
  new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8' } })

/** Read named fields from a form post or a JSON body, without caring which it was. */
async function readFields(c: Context, names: string[]): Promise<{
  values: Record<string, string>
  wantsHtml: boolean
}> {
  const type = c.req.header('content-type') ?? ''
  const source: Record<string, unknown> = type.includes('form')
    ? ((await c.req.parseBody().catch(() => ({}))) as Record<string, unknown>)
    : ((await c.req.json().catch(() => ({}))) as Record<string, unknown>)
  const values: Record<string, string> = {}
  for (const name of names) {
    const value = source[name]
    values[name] = typeof value === 'string' ? value : ''
  }
  return { values, wantsHtml: type.includes('form') }
}

/**
 * Where to go after signing in.
 *
 * Only a same-site ABSOLUTE PATH is honoured. A full URL here is the open-redirect that
 * turns a trustworthy sign-in page into a link an attacker can send: sign in on the real
 * site, get bounced somewhere else. `//evil.example` is rejected too — the browser reads a
 * protocol-relative URL as another origin, and it starts with a slash. `/\evil.example` is
 * the same trick against a check that only knows about slashes: browsers normalise the
 * backslash and leave the site just as readily. `safeReturnPath` in `web/comment-auth.ts`
 * guards the identical pair, for the identical reason.
 */
function safeNext(raw: string | undefined): string {
  if (raw === undefined || raw === '') return '/admin'
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return '/admin'
  return raw
}

// ----- the pages ---------------------------------------------------------------

export async function handleLoginPage(c: Context): Promise<Response> {
  // Already signed in: nothing to do here. A sign-in form shown to someone who is signed
  // in reads as though their session broke.
  if (resolveSession(getCookie(c, COOKIE_NAME)) !== null) {
    return c.redirect(safeNext(c.req.query('next')), 302)
  }
  return html(passwordScreen(await getSettings(), { next: c.req.query('next') }))
}

export async function handleTwoFactorPage(c: Context): Promise<Response> {
  const ticket = c.req.query('ticket') ?? ''
  const settings = await getSettings()
  // An expired or invented ticket goes back to the start rather than showing a code box
  // that could never work.
  if (pendingUser(ticket) === null) {
    return html(passwordScreen(settings, { error: adminT(settings.language).authRestart }), 400)
  }
  return html(twoFactorScreen(settings, {
    ticket,
    recovery: c.req.query('recovery') === '1',
    next: c.req.query('next'),
  }))
}

// ----- step one: the password --------------------------------------------------

export async function handleLogin(c: Context): Promise<Response> {
  const { values, wantsHtml } = await readFields(c, ['username', 'password', 'next'])
  const settings = await getSettings()
  const s = adminT(settings.language)

  const result = await submitPassword({
    username: values.username,
    password: values.password,
    ip: clientIp(c),
  })

  if (result.status === 'rate-limited') {
    const message = fillTemplate(s.authLockedOut, { minutes: Math.ceil(result.retryAfter / 60) })
    if (!wantsHtml) return c.json({ error: message }, 429, { 'retry-after': String(result.retryAfter) })
    return new Response(passwordScreen(settings, { error: message, username: values.username }), {
      status: 429,
      headers: { 'content-type': 'text/html; charset=utf-8', 'retry-after': String(result.retryAfter) },
    })
  }

  if (result.status === 'rejected') {
    // 401 for the form path too. The status describes the request; a 200 here tells every
    // log and every monitor that a failed sign-in succeeded.
    if (!wantsHtml) return fail(c, s.authBadCredentials, 401)
    return html(passwordScreen(settings, {
      error: s.authBadCredentials,
      username: values.username,
      next: values.next || undefined,
    }), 401)
  }

  if (result.status === 'need-enrolment') {
    const secret = generateSecret()
    // Held on the ticket rather than written to the user row: an interrupted enrolment
    // must not leave a secret behind that nobody has scanned, because the next sign-in
    // would then demand a code from an app that was never set up.
    pendingSecrets.set(result.ticket, secret)
    if (!wantsHtml) return json({ status: 'need-enrolment', ticket: result.ticket, secret })
    return html(enrolScreen(settings, {
      ticket: result.ticket,
      secret,
      qr: qrSvg(otpauthUri(secret, values.username.trim())),
      skippable: enrolmentSkippable(settings),
    }))
  }

  if (!wantsHtml) return json({ status: 'need-2fa', ticket: result.ticket })
  return html(twoFactorScreen(settings, { ticket: result.ticket, next: values.next || undefined }))
}

// ----- step two: the code ------------------------------------------------------

export async function handleTwoFactor(c: Context): Promise<Response> {
  const { values, wantsHtml } = await readFields(c, ['ticket', 'code', 'next'])
  const settings = await getSettings()
  const s = adminT(settings.language)
  const recovery = !/^\s*\d{6}\s*$/.test(values.code)

  const result = await submitSecondFactor({
    ticket: values.ticket,
    code: values.code,
    ip: clientIp(c),
    userAgent: c.req.header('user-agent'),
  })

  if (result.status === 'ok') {
    const cookie = sessionCookie(result.token, result.expiresAt)
    const headers = new Headers({ 'set-cookie': cookie })
    if (!wantsHtml) return new Response(JSON.stringify({ status: 'ok' }), {
      headers: { ...Object.fromEntries(headers), 'content-type': 'application/json; charset=utf-8' },
    })
    headers.set('location', safeNext(values.next))
    return new Response(null, { status: 303, headers })
  }

  if (result.status === 'rate-limited') {
    const message = fillTemplate(s.authLockedOut, { minutes: Math.ceil(result.retryAfter / 60) })
    if (!wantsHtml) return c.json({ error: message }, 429)
    return html(twoFactorScreen(settings, { ticket: values.ticket, error: message, recovery }), 429)
  }

  if (result.status === 'restart') {
    if (!wantsHtml) return fail(c, s.authRestart, 401)
    return html(passwordScreen(settings, { error: s.authRestart }), 401)
  }

  const message = fillTemplate(s.authBadCode, { n: result.attemptsLeft })
  if (!wantsHtml) return fail(c, message, 401)
  return html(twoFactorScreen(settings, {
    ticket: values.ticket, error: message, recovery, next: values.next || undefined,
  }), 401)
}

// ----- first-run enrolment -----------------------------------------------------

/**
 * Secrets for enrolments in progress, keyed by pending ticket.
 *
 * In memory and short-lived on purpose: writing the secret to `users` before it has been
 * confirmed would leave an account demanding codes from an authenticator that nobody
 * finished setting up, and the only way out of that is the command line.
 */
const pendingSecrets = new Map<string, string>()

/**
 * `setup-routes.ts` needs to put a secret here, because claiming an install walks straight
 * into enrolment without passing through `/api/auth/login` first. Exported rather than
 * moved: this map and the ticket it is keyed by belong to the enrolment flow, and the flow
 * lives here.
 */
export function rememberEnrolmentSecret(ticket: string, secret: string): void {
  pendingSecrets.set(ticket, secret)
}

/**
 * Whether the "set this up later" way out is offered — the middle path on 2FA, and the
 * reasoning is the whole of it.
 *
 * [ADR 0007](../../docs/decisions/0007-self-hosted-password-totp-auth.md) made TOTP
 * mandatory and that stands for any blog with readers. But **before anyone has enrolled,
 * two-factor protects nothing**: whoever reaches the enrolment screen first with the
 * password enrols their own authenticator, so refusing to let the owner in without it
 * closes no door that was open. What it does do is make `docker run` on a laptop, to look
 * at the thing for ten minutes, require a phone.
 *
 * So the gate is the SITE ADDRESS, not the account: no public address means nobody is
 * reading this blog yet. Set one — which is a step of setup itself — and the button is gone
 * at the very next sign-in, which still asks for enrolment because `totp_secret` is null.
 * No new column, no new state, nothing to migrate: the prompt simply comes back.
 */
/**
 * Where a session that has just come through enrolment lands.
 *
 * `/setup/site` only while the site address is unset, which is the same signal the boot
 * warning uses and the one thing that step exists to fix. An established owner who enrolled
 * again — after a TOTP reset, say — has an address by then and goes straight to the admin,
 * so re-enrolling never drags anybody back through setup. An explicit `next` always wins:
 * somebody who followed a link to a particular page asked for that page.
 */
function firstRunNext(settings: SiteSettings, next: string): string {
  if (next !== '') return safeNext(next)
  return siteUrlIsUnset(settings) ? '/setup/site' : '/admin'
}

export function enrolmentSkippable(settings: SiteSettings): boolean {
  return siteUrlIsUnset(settings)
}
/** Recovery codes shown but not yet acknowledged, keyed the same way. */
const pendingCodes = new Map<string, string[]>()

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

  const headers = new Headers({ 'set-cookie': sessionCookie(session.token, session.expiresAt) })
  if (!wantsHtml) return new Response(JSON.stringify({ status: 'ok' }), {
    headers: { ...Object.fromEntries(headers), 'content-type': 'application/json; charset=utf-8' },
  })
  headers.set('location', firstRunNext(settings, values.next))
  return new Response(null, { status: 303, headers })
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

  const headers = new Headers({ 'set-cookie': sessionCookie(session.token, session.expiresAt) })
  if (!wantsHtml) return new Response(JSON.stringify({ status: 'ok' }), {
    headers: { ...Object.fromEntries(headers), 'content-type': 'application/json; charset=utf-8' },
  })
  headers.set('location', firstRunNext(settings, values.next))
  return new Response(null, { status: 303, headers })
}

// ----- signing out -------------------------------------------------------------

export function handleLogout(c: Context): Response {
  const session = resolveSession(getCookie(c, COOKIE_NAME))
  if (session !== null) {
    revokeSession(session.userId, session.id)
    logAuthEvent('auth.logout')
  }
  // The cookie is cleared either way. A request to sign out ends with the browser not
  // holding a session, whatever the server thought it had.
  const headers = new Headers({ 'set-cookie': clearedCookie() })
  headers.set('location', '/login')
  return new Response(null, { status: 303, headers })
}

/** Test seam: the enrolment maps are process-global. */
export function resetEnrolment(): void {
  pendingSecrets.clear()
  pendingCodes.clear()
}
