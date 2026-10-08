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
// The masthead is the QUIRE mark, not the blog's logo — a blog's logo here read as a page
// OF the blog, and the reasoning is in `web/brand.ts`. The site is still named, in the sentence
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
/**
 * THE FIRST RUN IS SEVEN SCREENS, and each one says where it stands among them.
 *
 * The two security screens said "Step 1 of 2" and "Step 2 of 2", and four more followed — the
 * site, the front page, the reader's pen and the look — so a new owner who had just been told
 * they were done was handed a fifth screen (seen 2026-09-23). Account, authenticator, recovery
 * codes, then those four. Enrolment that happens LATER, at a sign-in on a blog already set up,
 * keeps its own two steps: it is not a first run.
 */
export const SETUP_STEPS = 7
export function setupStep(settings: SiteSettings, s: ReturnType<typeof adminT>, n: number, later?: number): string {
  const [at, of] = settings.setupDone ? [later, 2] : [n, SETUP_STEPS]
  return at === undefined ? '' : `<p class="login-step">${escapeHtml(fill(s.authStepOf, { n: at, total: of }))}</p>`
}

export const fill = (template: string, values: Record<string, string | number>): string =>
  template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? String(values[key]) : whole)

/**
 * Exported for `setup-page.ts`, which is the same door with two more rooms behind it. The
 * first-run screens have to look like the sign-in screens because they ARE the sign-in
 * screens' neighbours — a wizard in a second visual language would read as a different site.
 */
export function loginShell(settings: SiteSettings, title: string, body: string, scripts = scriptTag('login')): string {
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
    { scripts },
  )
}

/** Lucide's eye / eye-off, drawn in the same idiom as the mark. */
export const EYE = '<svg class="eye-on" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
  + ' stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
  + '<path d="M2.1 12S5.7 5.5 12 5.5 21.9 12 21.9 12 18.3 18.5 12 18.5 2.1 12 2.1 12Z"/>'
  + '<circle cx="12" cy="12" r="3"/></svg>'
  + '<svg class="eye-off" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
  + ' stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
  + '<path d="M10.7 6.2A9.9 9.9 0 0 1 12 6.1c6.3 0 9.9 6.5 9.9 6.5a17.7 17.7 0 0 1-3 3.9"/>'
  + '<path d="M6.6 7.6A17.6 17.6 0 0 0 2.1 12.6S5.7 19.1 12 19.1a9.6 9.6 0 0 0 4.1-.9"/>'
  + '<path d="M10 10.6a2.9 2.9 0 0 0 4.1 4.1"/><path d="M3 3l18 18"/></svg>'

/** An inline error, next to the field it belongs to rather than floating at the top. */
export const errorBox = (message: string | undefined): string =>
  message === undefined ? '' : `<p class="login-error" role="alert">${escapeHtml(message)}</p>`

/**
 * An error that belongs to ONE field, printed under it and wired to it. The input names it with
 * `aria-describedby` and says `aria-invalid`, so a screen reader reads the reason with the field and
 * the eye finds it where the fix is. The banner above the form stays for errors about the whole form.
 */
const fieldErrorId = (field: string): string => `${field}-error`
export const fieldError = (field: string, message: string | undefined): string =>
  message === undefined ? '' : `<p class="login-error login-error-field" id="${fieldErrorId(field)}" role="alert">${escapeHtml(message)}</p>`
export const invalidAttrs = (field: string, message: string | undefined): string =>
  message === undefined ? '' : ` aria-invalid="true" aria-describedby="${fieldErrorId(field)}"`

/**
 * The one dead end sign-in has, said out loud on the screen where it happens.
 *
 * The session cookie is `__Host-`, which a browser stores only over a secure connection. On
 * a blog reached at `http://192.168.1.50:3000` — a NAS behind no reverse proxy, a LAN
 * address, a plain tunnel — the password and the code are both accepted, the cookie is set,
 * the browser drops it, and the next page asks to sign in again. Nothing anywhere said why.
 *
 * SENT ALWAYS AND REVEALED BY THE BROWSER, rather than decided on the server. The server
 * cannot tell: behind a proxy that terminates TLS this process sees plain HTTP on every
 * request and everything is fine, and a proxy that omits `X-Forwarded-Proto` would make a
 * server-side guess cry wolf on a perfectly good install. `window.isSecureContext` is the
 * browser's own answer to the exact question the cookie will be judged by, and
 * `http://localhost` is a secure context, so a local trial run is not warned at.
 */
function insecureNote(text: string): string {
  return `<p class="login-warn" data-insecure hidden>${escapeHtml(text)}</p>`
}


/** Lucide's key-round, in the idiom of the eye above: what a passkey looks like everywhere. */
const KEY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"'
  + ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
  + '<path d="M2.6 17.4A2 2 0 0 0 2 18.8V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1'
  + 'a1 1 0 0 1 1-1h.2a2 2 0 0 0 1.4-.6l.8-.8a6.5 6.5 0 1 0-4-4z"/>'
  + '<circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/></svg>'

/**
 * The passkey door (ADR 0071), under the password form and never in place of it.
 *
 * SHIPPED HIDDEN, and only on a blog that has a passkey to sign in with. The island shows it when
 * the browser has WebAuthn at all, so a browser without it sees the page exactly as it was; and a
 * blog whose owner never made a passkey is not offered a button that can only fail. The sentences
 * it may need ride on it as attributes, because the island has no dictionary.
 *
 * The username box gains `webauthn` in its autocomplete beside it: that token is what lets a
 * browser with conditional UI offer the passkey in the box's own autofill, before anybody has
 * found the button.
 */
function passkeyDoor(s: ReturnType<typeof adminT>, next: string | undefined): string {
  return `<div class="login-passkey" data-passkey hidden`
    + ` data-failed="${escapeAttr(s.authPasskeyFailed)}" data-expired="${escapeAttr(s.authPasskeyExpired)}"`
    + `${next === undefined ? '' : ` data-next="${escapeAttr(next)}"`}>`
    + `<p class="login-error" role="alert" data-passkey-error hidden></p>`
    + `<button type="button" class="login-passkey-button" data-passkey-go>${KEY}`
    + `<span>${escapeHtml(s.authPasskeySignIn)}</span></button></div>`
}

export function passwordScreen(
  settings: SiteSettings,
  opts: { error?: string; username?: string; next?: string; passkeys?: boolean; errorAtPassword?: boolean } = {},
): string {
  const s = adminT(settings.language)
  const next = opts.next === undefined ? '' : `<input type="hidden" name="next" value="${escapeAttr(opts.next)}">`
  const passkeys = opts.passkeys === true
  // A refused sign-in is about the password box (it is the one field that comes back empty), so the
  // reason sits under it and the caret lands there. The banner is for errors with no field.
  const atPassword = opts.errorAtPassword === true ? opts.error : undefined
  const banner = atPassword === undefined ? opts.error : undefined
  return loginShell(settings, s.authSignIn, `
<h1>${escapeHtml(s.authSignIn)}</h1>
<p class="login-lede">${escapeHtml(fill(s.authSignInLede, { site: settings.title }))}</p>
${insecureNote(s.authNeedsHttps)}
${errorBox(banner)}
<form method="post" action="/api/auth/login" class="login-form">
${next}
<label for="username">${escapeHtml(s.authUsername)}</label>
<input id="username" name="username" type="text" autocomplete="username${passkeys ? ' webauthn' : ''}" autocapitalize="none"
       spellcheck="false" required${atPassword === undefined ? ' autofocus' : ''} value="${escapeAttr(opts.username ?? '')}">

<label for="password">${escapeHtml(s.authPassword)}</label>
<div class="login-reveal">
  <input id="password" name="password" type="password" autocomplete="current-password" required${atPassword === undefined ? '' : ' autofocus'}${invalidAttrs('password', atPassword)}>
  <button type="button" data-reveal
          data-show="${escapeAttr(s.authShowPassword)}"
          data-hide="${escapeAttr(s.authHidePassword)}"
          aria-label="${escapeAttr(s.authShowPassword)}">${EYE}</button>
</div>
${fieldError('password', atPassword)}
<p class="login-caps" data-caps hidden>${escapeHtml(s.authCapsLock)}</p>

<button type="submit" class="login-submit">${escapeHtml(s.authContinue)}</button>
</form>
${passkeys ? passkeyDoor(s, opts.next) : ''}`)
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

  // A FORM, NOT A LINK (FIXLIST 9.7): the link carried the pending ticket in its address, so it
  // sat in the browser's history one step from a session. The body carries it now.
  const toggle = `<form method="post" action="/api/auth/2fa/mode">`
    + `<input type="hidden" name="ticket" value="${escapeAttr(opts.ticket)}">${next}`
    + `<input type="hidden" name="recovery" value="${recovery ? '0' : '1'}">`
    + `<button type="submit" class="login-link">${escapeHtml(recovery ? s.authUseAuthenticator : s.authUseRecovery)}</button></form>`

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
${setupStep(settings, s, 2, 1)}
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
  opts: { ticket: string; codes: string[]; download: string },
): string {
  const s = adminT(settings.language)
  const list = opts.codes.map((code) => `<li><code>${escapeHtml(code)}</code></li>`).join('')
  return loginShell(settings, s.authCodesTitle, `
<h1>${escapeHtml(s.authCodesTitle)}</h1>
${setupStep(settings, s, 3, 2)}
<p class="login-hint">${escapeHtml(s.authCodesHint)}</p>
<ol class="login-codes">${list}</ol>
<p class="login-alt login-codes-tools">
  <a href="${escapeAttr(opts.download)}" download="quire-recovery-codes.txt">${escapeHtml(s.authCodesDownload)}</a>
  <button type="button" class="login-linkish" data-copy-codes hidden
          data-done="${escapeAttr(s.authCodesCopied)}" data-select="${escapeAttr(s.authCodesSelected)}">${escapeHtml(s.authCodesCopy)}</button>
  <span class="sr-only" role="status" data-copy-status></span>
</p>
<form method="post" action="/api/auth/enrol/done" class="login-form">
<input type="hidden" name="ticket" value="${escapeAttr(opts.ticket)}">
<label class="login-check">
  <input type="checkbox" name="saved" value="1" required>
  <span>${escapeHtml(s.authCodesSaved)}</span>
</label>
<button type="submit" class="login-submit" data-needs-saved>${escapeHtml(s.authContinue)}</button>
<p class="login-hint login-why" id="codes-why" data-needs-saved-why hidden>${escapeHtml(s.authCodesTickFirst)}</p>
</form>`)
}

export { fill as fillTemplate }
