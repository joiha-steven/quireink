// The first-run claim screens: an unclaimed install, a claimed one met by a setup link, and the
// claim form itself. Split from `login-page.ts` (the same door, the same shell) only to keep that
// file inside its line budget; they are the sign-in screens' neighbours and import their pieces.

import type { SiteSettings } from '@/types'
import { adminT } from '@/i18n/admin-i18n'
import { escapeAttr, escapeHtml } from '@/utils'
import { SITE_LANGS } from '@/locales/langs'
import { MIN_LENGTH } from '@/auth/password'
import { EYE, errorBox, fieldError, fill, invalidAttrs, loginShell, setupStep } from '@/web/login-page'

/**
 * What a browser gets at `/setup` on an install nobody has claimed, WITHOUT the link.
 *
 * It has to say two things and leak nothing: that the install is unclaimed, and where the
 * link is. Naming the log is the whole point — before this page a fresh install answered a
 * sign-in form to credentials that could not exist, which is indistinguishable from having
 * forgotten your own password on a blog you never made.
 */
export function unclaimedScreen(
  settings: SiteSettings,
  opts: { error?: string; askCode?: boolean } = {},
): string {
  const s = adminT(settings.language)
  // Two installs, two screens. With `SETUP_CODE` set the person has the secret in a file
  // they wrote, so the page asks for it; without it the secret is in a log, so the page
  // says where the log is and shows no field — a field here would invite guessing at a
  // 24-byte token, and the log line is the way in.
  const body = opts.askCode
    ? `<p class="login-lede">${escapeHtml(s.setupCodeLede)}</p>
${errorBox(opts.error)}
<form method="get" action="/setup" class="login-form">
<label for="token">${escapeHtml(s.setupCodeLabel)}</label>
<input id="token" name="token" type="text" required autofocus autocomplete="off"
  autocapitalize="none" spellcheck="false" inputmode="text">
<button type="submit" class="login-submit">${escapeHtml(s.setupCodeGo)}</button>
</form>`
    : `<p class="login-lede">${escapeHtml(s.setupUnclaimedLede)}</p>
${errorBox(opts.error)}
<p class="login-hint">${escapeHtml(s.setupWhereToLook)}</p>`
  // The other way out of an unclaimed install, a blog moving here (ADR 0067). It asks for the
  // same secret, so offering it here gives nothing away.
  return loginShell(settings, s.setupUnclaimedTitle, `
<h1>${escapeHtml(s.setupUnclaimedTitle)}</h1>
${body}
<p class="login-alt"><a href="/setup/restore" data-setup-restore-link>${escapeHtml(s.setupRestoreLink)}</a></p>`)
}

/**
 * A CLAIMED blog met by a setup link (FIXLIST 9.1). It used to reuse the unclaimed screen, so a
 * reload of the QR step read "This blog has no owner yet" above "This blog already has an
 * owner", with no way on. The way on is the sign-in, which resumes at the authenticator.
 */
export function claimedScreen(settings: SiteSettings): string {
  const s = adminT(settings.language)
  return loginShell(settings, s.setupClaimedTitle, `
<h1>${escapeHtml(s.setupClaimedTitle)}</h1>
<p class="login-lede">${escapeHtml(s.setupClaimedLede)}</p>
<p class="login-alt"><a href="/login">${escapeHtml(s.authSignIn)}</a></p>`)
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
  opts: { token: string; error?: string; username?: string; email?: string; errorAtPassword?: boolean },
): string {
  const s = adminT(settings.language)
  // A password the rules refuse is reported under the password box, which comes back empty (the
  // password is never echoed); the other fields keep what was typed. Errors about the name or the
  // address stay in the banner, where they were.
  const atPassword = opts.errorAtPassword === true ? opts.error : undefined
  const banner = atPassword === undefined ? opts.error : undefined
  return loginShell(settings, s.setupTitle, `
<h1>${escapeHtml(s.setupTitle)}</h1>
${setupStep(settings, s, 1)}
<p class="login-lede">${escapeHtml(s.setupLede)}</p>
${errorBox(banner)}
<form method="post" action="/api/setup/claim" class="login-form">
<input type="hidden" name="token" value="${escapeAttr(opts.token)}">

${languageField(settings)}

<label for="username">${escapeHtml(s.authUsername)}</label>
<input id="username" name="username" type="text" autocomplete="username" autocapitalize="none"
       spellcheck="false" required${atPassword === undefined ? ' autofocus' : ''} value="${escapeAttr(opts.username ?? '')}">
<p class="login-hint">${escapeHtml(s.setupUsernameHint)}</p>

<label for="email">${escapeHtml(s.setupEmail)}</label>
<input id="email" name="email" type="email" autocomplete="email" autocapitalize="none"
       spellcheck="false" required value="${escapeAttr(opts.email ?? '')}">
<p class="login-hint">${escapeHtml(s.setupEmailHint)}</p>

<label for="password">${escapeHtml(s.authPassword)}</label>
<div class="login-reveal">
  <input id="password" name="password" type="password" autocomplete="new-password" required${atPassword === undefined ? '' : ' autofocus'}${invalidAttrs('password', atPassword)}>
  <button type="button" data-reveal
          data-show="${escapeAttr(s.authShowPassword)}"
          data-hide="${escapeAttr(s.authHidePassword)}"
          aria-label="${escapeAttr(s.authShowPassword)}">${EYE}</button>
</div>
${fieldError('password', atPassword)}
<p class="login-caps" data-caps hidden>${escapeHtml(s.authCapsLock)}</p>
<p class="login-hint">${escapeHtml(fill(s.setupPwHint, { n: MIN_LENGTH }))}</p>

<button type="submit" class="login-submit">${escapeHtml(s.setupCreate)}</button>
</form>
<p class="login-alt"><a href="/setup/restore?token=${encodeURIComponent(opts.token)}" data-setup-restore-link>${escapeHtml(s.setupRestoreLink)}</a></p>`)
}

/**
 * The language select, on the FIRST screen of setup rather than only on the third.
 *
 * The wizard has always asked this, and it asked too late: until 2026-09-11 the two screens
 * before it — claim the blog, then set up an authenticator — were in English for everybody,
 * and those are the two a person is least able to guess their way through. It is the same
 * control the site step carries, the same `data-setup-lang` island (which reloads with
 * `?lang=` and keeps the setup token in the URL while it does), and the claim form SAVES the
 * answer, so the authenticator screen after it is already in the right language.
 */
export function languageField(settings: SiteSettings): string {
  const s = adminT(settings.language)
  const options = SITE_LANGS.map(({ value, label }) =>
    `<option value="${escapeAttr(value)}"${value === settings.language ? ' selected' : ''}>`
    + `${escapeHtml(label)}</option>`).join('')
  return `<label for="language">${escapeHtml(s.siteStepLanguage)}</label>
<select id="language" name="language" data-setup-lang>${options}</select>`
}
