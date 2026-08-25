// The sign-in screens.
//
// Real server-rendered forms with a method and an action, so the whole flow works with
// JavaScript switched off — same stance as the newsletter form and the search page. The
// one island (`login.js`) adds the password visibility toggle and the caps-lock warning,
// which are conveniences, not the mechanism.
//
// "Looks trustworthy" is the brief (06-auth.md), and the details are the point: correct
// `autocomplete` attributes so a password manager fills it, and an error that never says
// which half was wrong.
//
// The masthead is the QUIRE mark, not the blog's logo — the owner's call after seeing the
// page, and the reasoning is in `web/brand.ts`. The site is still named, in the sentence
// under the heading and in the way back at the bottom, which is where it belongs: this
// page is the software, and the blog is what it lets you in to.
//
// It does NOT load the public stylesheet. That sheet is written for articles, and one of
// its rules (`main{flex:1}`) reached the card and stretched it to the height of the
// viewport. See `login.css.ts`.

import type { SiteSettings } from '@/types'
import { adminT } from '@/i18n/admin-i18n'
import { renderDocument, pageStyles } from '@/web/layout'
import { LOGIN_CSS } from '@/web/login.css'
import { quireLockup } from '@/web/brand'
import { scriptTag } from '@/web/assets'
import { escapeAttr, escapeHtml } from '@/utils'

/** `{n}` style interpolation, the same shape the admin strings already use. */
const fill = (template: string, values: Record<string, string | number>): string =>
  template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? String(values[key]) : whole)

/**
 * Exported for `setup-page.ts`, which is the same door with two more rooms behind it. The
 * first-run screens have to look like the sign-in screens because they ARE the sign-in
 * screens' neighbours — a wizard in a second visual language would read as a different site.
 */
export function loginShell(settings: SiteSettings, title: string, body: string): string {
  const s = adminT(settings.language)
  const back = `<a class="login-back" href="/">${escapeHtml(fill(s.authBackTo, { site: settings.title }))}</a>`
  return renderDocument(
    settings,
    // `noindex`: a sign-in page in search results is a phishing target and useless to a
    // reader. The public pages want the opposite, which is why this is set here and not
    // in the shared layout.
    { title: `${title} · ${settings.title}`, robots: 'noindex' },
    // An empty base sheet: `pageStyles` still supplies the palette, so the door matches the
    // house, and LOGIN_CSS supplies everything else.
    `${pageStyles(settings)}\n${LOGIN_CSS}`,
    `<div class="login-wrap">${quireLockup()}<main class="login-card">${body}</main>${back}</div>`,
    { scripts: scriptTag('login') },
  )
}

/** Lucide's eye / eye-off, drawn in the same idiom as the mark. */
const EYE = '<svg class="eye-on" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
  + ' stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
  + '<path d="M2.1 12S5.7 5.5 12 5.5 21.9 12 21.9 12 18.3 18.5 12 18.5 2.1 12 2.1 12Z"/>'
  + '<circle cx="12" cy="12" r="3"/></svg>'
  + '<svg class="eye-off" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
  + ' stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
  + '<path d="M10.7 6.2A9.9 9.9 0 0 1 12 6.1c6.3 0 9.9 6.5 9.9 6.5a17.7 17.7 0 0 1-3 3.9"/>'
  + '<path d="M6.6 7.6A17.6 17.6 0 0 0 2.1 12.6S5.7 19.1 12 19.1a9.6 9.6 0 0 0 4.1-.9"/>'
  + '<path d="M10 10.6a2.9 2.9 0 0 0 4.1 4.1"/><path d="M3 3l18 18"/></svg>'

/** An inline error, next to the field it belongs to rather than floating at the top. */
const errorBox = (message: string | undefined): string =>
  message === undefined ? '' : `<p class="login-error" role="alert">${escapeHtml(message)}</p>`

export function passwordScreen(
  settings: SiteSettings,
  opts: { error?: string; username?: string; next?: string } = {},
): string {
  const s = adminT(settings.language)
  const next = opts.next === undefined ? '' : `<input type="hidden" name="next" value="${escapeAttr(opts.next)}">`
  return loginShell(settings, s.authSignIn, `
<h1>${escapeHtml(s.authSignIn)}</h1>
<p class="login-lede">${escapeHtml(fill(s.authSignInLede, { site: settings.title }))}</p>
${errorBox(opts.error)}
<form method="post" action="/api/auth/login" class="login-form">
${next}
<label for="username">${escapeHtml(s.authUsername)}</label>
<input id="username" name="username" type="text" autocomplete="username" autocapitalize="none"
       spellcheck="false" required autofocus value="${escapeAttr(opts.username ?? '')}">

<label for="password">${escapeHtml(s.authPassword)}</label>
<div class="login-reveal">
  <input id="password" name="password" type="password" autocomplete="current-password" required>
  <button type="button" data-reveal
          data-show="${escapeAttr(s.authShowPassword)}"
          data-hide="${escapeAttr(s.authHidePassword)}"
          aria-label="${escapeAttr(s.authShowPassword)}">${EYE}</button>
</div>
<p class="login-caps" data-caps hidden>${escapeHtml(s.authCapsLock)}</p>

<button type="submit" class="login-submit">${escapeHtml(s.authContinue)}</button>
</form>`)
}

export function twoFactorScreen(
  settings: SiteSettings,
  opts: { ticket: string; error?: string; recovery?: boolean; next?: string },
): string {
  const s = adminT(settings.language)
  const next = opts.next === undefined ? '' : `<input type="hidden" name="next" value="${escapeAttr(opts.next)}">`
  const recovery = opts.recovery === true

  // The two modes differ only in the input and its labels, so they share one form rather
  // than being two near-identical copies that drift.
  const field = recovery
    ? `<label for="code">${escapeHtml(s.authRecoveryCode)}</label>
<input id="code" name="code" type="text" inputmode="text" autocomplete="off" autocapitalize="characters"
       spellcheck="false" required autofocus placeholder="xxxxx-xxxxx">`
    // `one-time-code` is what lets iOS and Android offer the code straight from the
    // notification, and `inputmode=numeric` brings up the digit pad. A paste of the whole
    // six digits works because there is one input, not six.
    : `<label for="code">${escapeHtml(s.authCode)}</label>
<input id="code" name="code" type="text" inputmode="numeric" autocomplete="one-time-code"
       pattern="[0-9]*" maxlength="7" required autofocus>`

  const toggle = recovery
    ? `<a href="/login/2fa?ticket=${encodeURIComponent(opts.ticket)}">${escapeHtml(s.authUseAuthenticator)}</a>`
    : `<a href="/login/2fa?ticket=${encodeURIComponent(opts.ticket)}&amp;recovery=1">${escapeHtml(s.authUseRecovery)}</a>`

  return loginShell(settings, s.authTwoFactor, `
<h1>${escapeHtml(recovery ? s.authRecoveryCode : s.authTwoFactor)}</h1>
<p class="login-hint">${escapeHtml(recovery ? s.authRecoveryHint : s.authTwoFactorHint)}</p>
${errorBox(opts.error)}
<form method="post" action="/api/auth/2fa" class="login-form">
<input type="hidden" name="ticket" value="${escapeAttr(opts.ticket)}">
${next}
${field}
<button type="submit" class="login-submit">${escapeHtml(s.authContinue)}</button>
</form>
<p class="login-alt">${toggle}</p>`)
}

/**
 * First-run enrolment, step 1 of 2: the secret.
 *
 * `secret` is shown as text for manual entry. Every authenticator app accepts a typed key,
 * which is why this screen is complete without the QR code beside it.
 */
export function enrolScreen(
  settings: SiteSettings,
  opts: { ticket: string; secret: string; qr?: string; error?: string; skippable?: boolean },
): string {
  const s = adminT(settings.language)
  // Grouped in fours: a 32-character key read off a screen and typed into a phone is
  // otherwise a place to lose your position.
  const grouped = (opts.secret.match(/.{1,4}/g) ?? []).join(' ')
  const qr = opts.qr === undefined ? '' : `<div class="login-qr">${opts.qr}</div>`

  return loginShell(settings, s.authSetUp, `
<h1>${escapeHtml(s.authSetUp)}</h1>
<p class="login-step">${escapeHtml(fill(s.authStepOf, { n: 1, total: 2 }))}</p>
<h2>${escapeHtml(s.authScanTitle)}</h2>
<p class="login-hint">${escapeHtml(s.authScanHint)}</p>
${qr}
<p class="login-hint">${escapeHtml(s.authManualEntry)}</p>
<p class="login-secret"><code>${escapeHtml(grouped)}</code></p>
${errorBox(opts.error)}
<form method="post" action="/api/auth/enrol" class="login-form">
<input type="hidden" name="ticket" value="${escapeAttr(opts.ticket)}">
<label for="code">${escapeHtml(s.authCode)}</label>
<input id="code" name="code" type="text" inputmode="numeric" autocomplete="one-time-code"
       pattern="[0-9]*" maxlength="7" required autofocus>
<button type="submit" class="login-submit">${escapeHtml(s.authConfirmCode)}</button>
</form>
${opts.skippable === true ? `<form method="post" action="/api/auth/enrol/skip" class="login-alt">
<input type="hidden" name="ticket" value="${escapeAttr(opts.ticket)}">
<button type="submit" class="login-linkish">${escapeHtml(s.authSkipNow)}</button>
<p class="login-hint">${escapeHtml(s.authSkipWhy)}</p>
</form>` : ''}`)
}

/**
 * First-run enrolment, step 2 of 2: the recovery codes.
 *
 * This is the only time they exist in plaintext. The confirmation is explicit, and the
 * download is a data URI so it needs no extra route and no server round trip.
 */
export function recoveryCodesScreen(
  settings: SiteSettings,
  opts: { codes: string[]; download: string },
): string {
  const s = adminT(settings.language)
  const list = opts.codes.map((code) => `<li><code>${escapeHtml(code)}</code></li>`).join('')
  return loginShell(settings, s.authCodesTitle, `
<h1>${escapeHtml(s.authCodesTitle)}</h1>
<p class="login-step">${escapeHtml(fill(s.authStepOf, { n: 2, total: 2 }))}</p>
<p class="login-hint">${escapeHtml(s.authCodesHint)}</p>
<ol class="login-codes">${list}</ol>
<p class="login-alt">
  <a href="${escapeAttr(opts.download)}" download="quire-recovery-codes.txt">${escapeHtml(s.authCodesDownload)}</a>
</p>
<form method="post" action="/api/auth/enrol/done" class="login-form">
<label class="login-check">
  <input type="checkbox" name="saved" value="1" required>
  <span>${escapeHtml(s.authCodesSaved)}</span>
</label>
<button type="submit" class="login-submit">${escapeHtml(s.authDone)}</button>
</form>`)
}

/**
 * What a browser gets at `/setup` on an install nobody has claimed, WITHOUT the link.
 *
 * It has to say two things and leak nothing: that the install is unclaimed, and where the
 * link is. Naming the log is the whole point — before this page a fresh install answered a
 * sign-in form to credentials that could not exist, which is indistinguishable from having
 * forgotten your own password on a blog you never made.
 */
export function unclaimedScreen(settings: SiteSettings, opts: { error?: string } = {}): string {
  const s = adminT(settings.language)
  return loginShell(settings, s.setupUnclaimedTitle, `
<h1>${escapeHtml(s.setupUnclaimedTitle)}</h1>
<p class="login-lede">${escapeHtml(s.setupUnclaimedLede)}</p>
${errorBox(opts.error)}
<p class="login-hint">${escapeHtml(s.setupWhereToLook)}</p>`)
}

/**
 * The claim form: the step that used to be a terminal.
 *
 * `autocomplete="new-password"` and not `current-password`, so a password manager offers to
 * GENERATE one rather than searching for a saved password that cannot exist yet. The token
 * rides in a hidden field rather than staying in the query string, so submitting the form
 * does not put it in the next page's referrer.
 */
export function claimScreen(
  settings: SiteSettings,
  opts: { token: string; error?: string; username?: string; email?: string },
): string {
  const s = adminT(settings.language)
  return loginShell(settings, s.setupTitle, `
<h1>${escapeHtml(s.setupTitle)}</h1>
<p class="login-lede">${escapeHtml(s.setupLede)}</p>
${errorBox(opts.error)}
<form method="post" action="/api/setup/claim" class="login-form">
<input type="hidden" name="token" value="${escapeAttr(opts.token)}">
<label for="username">${escapeHtml(s.authUsername)}</label>
<input id="username" name="username" type="text" autocomplete="username" autocapitalize="none"
       spellcheck="false" required autofocus value="${escapeAttr(opts.username ?? '')}">

<label for="email">${escapeHtml(s.setupEmail)}</label>
<input id="email" name="email" type="email" autocomplete="email" autocapitalize="none"
       spellcheck="false" required value="${escapeAttr(opts.email ?? '')}">
<p class="login-hint">${escapeHtml(s.setupEmailHint)}</p>

<label for="password">${escapeHtml(s.authPassword)}</label>
<div class="login-reveal">
  <input id="password" name="password" type="password" autocomplete="new-password" required>
  <button type="button" data-reveal
          data-show="${escapeAttr(s.authShowPassword)}"
          data-hide="${escapeAttr(s.authHidePassword)}"
          aria-label="${escapeAttr(s.authShowPassword)}">${EYE}</button>
</div>
<p class="login-caps" data-caps hidden>${escapeHtml(s.authCapsLock)}</p>

<button type="submit" class="login-submit">${escapeHtml(s.setupCreate)}</button>
</form>`)
}

export { fill as fillTemplate }
