// The sign-in endpoints: the two pages, the password, the code, and signing out.
//
// First-run enrolment is next door in `enrol-routes.ts` — same flow, but everything there is
// reached with a pending ticket and ends by issuing the very first session.
//
// Each takes either a form post or JSON and answers in kind, the same deviation the
// newsletter routes make and for the same reason: the forms are server-rendered, so a
// reader without JavaScript can submit them, and answering a form post with a page of JSON
// would be a defect created here rather than one carried over.
//
// These are the only write routes that cannot be owner-gated — they are how one becomes an
// owner — so each is listed in `scripts/checks/routes-guarded.ts` with its reason.

import type { Context } from 'hono'
import { getCookie } from 'hono/cookie'
import { getSettings } from '@/content/settings'
import { adminT } from '@/i18n/admin-i18n'
import { clientIp } from '@/server/rate-limit'
import { logAuthEvent } from '@/server/activity'
import {
  clearedCookie, COOKIE_NAME, resolveSession, revokeSession,
} from '@/auth/sessions'
import { generateSecret, otpauthUri } from '@/auth/totp'
import { pendingUser, submitPassword, submitSecondFactor } from '@/auth/login'
import { qrSvg } from '@/render/qr'
import { fail, json } from '@/web/api'
import { html, readFields, safeNext, signedIn } from '@/web/auth-http'
import { enrolmentSkippable, rememberEnrolmentSecret } from '@/web/enrol-routes'
import {
  enrolScreen, fillTemplate, passwordScreen, twoFactorScreen,
} from '@/web/login-page'

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
    rememberEnrolmentSecret(result.ticket, secret)
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

  if (result.status === 'ok') return signedIn(result, safeNext(values.next), wantsHtml)

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
