// First run: claiming an install that has no owner.
//
// Its own file rather than more of `auth-routes.ts`, because it is a different question.
// Those routes ask "are you the owner"; these ask "is there one yet", and the answer stops
// being interesting forever the moment it is yes.
//
// EVERY route here refuses once an account exists. Not as defence in depth — as the whole
// mechanism. `createUser` already refuses a second account (ADR 0002) so a race cannot
// create two owners, but a claim FORM still visible on a live blog is a phishing page
// wearing the site's own domain, and that is worth closing separately.

import type { Context } from 'hono'
import { getSettings } from '@/content/settings'
import { adminT } from '@/i18n/admin-i18n'
import { noUsersYet, createUser } from '@/auth/users'
import { checkPassword, MIN_LENGTH } from '@/auth/password'
import { submitPassword } from '@/auth/login'
import { generateSecret, otpauthUri } from '@/auth/totp'
import { clientIp } from '@/server/rate-limit'
import { logAuthEvent } from '@/server/activity'
import { setupToken, setupTokenMatches, forgetSetupToken } from '@/server/setup-token'
import { qrSvg } from '@/render/qr'
import { claimScreen, enrolScreen, unclaimedScreen, fillTemplate } from '@/web/login-page'
import { rememberEnrolmentSecret, enrolmentSkippable } from '@/web/auth-routes'
import { fail, json } from '@/web/api'

const html = (body: string, status = 200): Response =>
  new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8' } })

/**
 * `GET /setup`.
 *
 * Three answers, and the middle one is the reason this page exists at all. Before it, a
 * fresh install met a browser with a sign-in form for an account that could not exist —
 * indistinguishable from having forgotten the password to a blog you never made.
 */
export async function handleSetupPage(c: Context): Promise<Response> {
  const settings = await getSettings()
  // Claimed: say so and stop. Not a redirect to `/login`, because someone who followed a
  // stale setup link deserves to know the link is stale rather than to be handed a form.
  if (!noUsersYet()) {
    return html(unclaimedScreen(settings, { error: adminT(settings.language).setupClaimed }), 404)
  }
  const given = c.req.query('token') ?? ''
  if (given === '') return html(unclaimedScreen(settings))
  if (!setupTokenMatches(given)) {
    return html(unclaimedScreen(settings, { error: adminT(settings.language).setupBadLink }), 403)
  }
  return html(claimScreen(settings, { token: given }))
}

/**
 * `POST /api/setup/claim`: the account, and then straight into two-factor.
 *
 * It does not answer "here is your account, now go and sign in". Sending somebody back to a
 * form to retype the password they chose four seconds ago is the kind of seam that makes
 * setup feel like paperwork. Instead it signs in on their behalf with what they just typed,
 * which lands on `need-enrolment` and hands them the QR code — the flow that was already
 * built and already correct.
 */
export async function handleSetupClaim(c: Context): Promise<Response> {
  const type = c.req.header('content-type') ?? ''
  const wantsHtml = type.includes('form')
  const source: Record<string, unknown> = type.includes('form')
    ? ((await c.req.parseBody().catch(() => ({}))) as Record<string, unknown>)
    : ((await c.req.json().catch(() => ({}))) as Record<string, unknown>)
  const field = (name: string): string =>
    typeof source[name] === 'string' ? (source[name] as string).trim() : ''

  const settings = await getSettings()
  const s = adminT(settings.language)
  const token = field('token')
  const username = field('username')
  const email = field('email')
  // NOT trimmed: a password is bytes the owner chose, and silently eating a leading space
  // here means the same password fails at every later sign-in.
  const password = typeof source.password === 'string' ? source.password : ''

  const refuse = (message: string, status: number): Response => {
    if (!wantsHtml) return fail(c, message, status)
    return html(unclaimedScreen(settings, { error: message }), status)
  }

  if (!noUsersYet()) return refuse(s.setupClaimed, 409)
  if (!setupTokenMatches(token)) return refuse(s.setupBadLink, 403)
  if (username === '' || email === '') return refuse(s.setupBadLink, 400)

  // The same rules the CLI applies, so the two doors cannot disagree about what a password
  // is. Reported against the claim form, which still holds what was typed — and reported
  // per RULE, because "that will not do" without saying which leaves a person guessing.
  const problem = checkPassword(password, [username, 'quire', settings.title])
  if (problem !== null) {
    const message = problem === 'too-short'
      ? fillTemplate(s.setupPwShort, { n: MIN_LENGTH })
      : problem === 'too-common' ? s.setupPwCommon : s.setupPwName
    if (!wantsHtml) return fail(c, message, 400)
    return html(claimScreen(settings, { token, username, email, error: message }), 400)
  }

  await createUser({ username, email, password })
  forgetSetupToken()
  logAuthEvent('auth.owner.claimed')

  const result = await submitPassword({ username, password, ip: clientIp(c) })
  // Anything but `need-enrolment` here means the account was made and the sign-in that
  // should have followed did not. Say so plainly rather than pretending: the account is
  // real, and `/login` will take it.
  if (result.status !== 'need-enrolment') {
    if (!wantsHtml) return json({ status: 'created' })
    return c.redirect('/login', 303)
  }

  const secret = generateSecret()
  rememberEnrolmentSecret(result.ticket, secret)
  if (!wantsHtml) return json({ status: 'need-enrolment', ticket: result.ticket, secret })
  return html(enrolScreen(settings, {
    ticket: result.ticket,
    secret,
    qr: qrSvg(otpauthUri(secret, username)),
    skippable: enrolmentSkippable(settings),
  }))
}

/**
 * The line the log carries at boot when nobody owns this install yet.
 *
 * `base` is the address the operator can actually reach, and the caller works it out from
 * the socket rather than from `resolveSiteUrl`. That fallback answers `http://localhost:3000`
 * whatever port the process bound — measured on the first run of this very banner, which
 * printed `:3000` from a server listening on `:3399`. A setup link that does not open is
 * worse than no setup link: it reads as the software being broken on the first thing it
 * ever asks anybody to do.
 */
export function setupBanner(base: string): string {
  return [
    '',
    '  ┌─────────────────────────────────────────────────────────────────────────┐',
    '  │  This blog has no owner yet. Open the link below to claim it.           │',
    '  └─────────────────────────────────────────────────────────────────────────┘',
    '',
    `  ${base}/setup?token=${setupToken()}`,
    '',
    '  The link is good until this service restarts, and once only.',
    '',
  ].join('\n')
}
