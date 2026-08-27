// First run, after the account: the only two questions worth interrupting somebody for.
//
// The list of what is NOT here is the design. Palettes, fonts, book mode, the feature
// switches — none of them belongs in a wizard, because nobody can judge them before the site
// has a single post on it. Asking is asking a person to pick the binding for a book they
// have not written, and a choice made blind is worse than a default: a default still reads
// as "not decided yet", while something you clicked reads as decided. Those live on the
// dashboard's "first five minutes" card, which is re-openable, which is the right shape for
// them and the shape the owner asked for when he designed it.
//
// What is left qualifies on one of two grounds. The site address and the time zone are
// WRONG BY DEFAULT AND SILENT ABOUT IT — one makes every feed, sitemap and share card say
// `localhost:3000`, the other makes every date on the site read in the server's timezone —
// and the browser happens to know both. The front page is the one honest coin-flip: it
// decides what `/` even is.

import type { SiteSettings } from '@/types'
import { adminT } from '@/i18n/admin-i18n'
import { SITE_LANGS } from '@/locales/langs'
import { loginShell } from '@/web/login-page'
import { escapeAttr, escapeHtml } from '@/utils'

/**
 * Step one: what the site is, where it lives, and what clock it reads.
 *
 * `data-tz` is filled by `login.js` from `Intl.DateTimeFormat().resolvedOptions().timeZone`,
 * because the server cannot know it and asking somebody to pick their own timezone out of a
 * list of four hundred is a worse question than not asking. It stays a real text input: the
 * island is a convenience, and a browser with no JavaScript still gets a field it can type
 * in rather than an empty one it cannot.
 */
export function siteStepScreen(
  settings: SiteSettings,
  opts: { address: string },
): string {
  const s = adminT(settings.language)
  const langs = SITE_LANGS.map(({ value, label }) =>
    `<option value="${escapeAttr(value)}"${value === settings.language ? ' selected' : ''}>`
    + `${escapeHtml(label)}</option>`).join('')

  return loginShell(settings, s.siteStepTitle, `
<h1>${escapeHtml(s.siteStepTitle)}</h1>
<p class="login-lede">${escapeHtml(s.siteStepLede)}</p>
<form method="post" action="/setup/site" class="login-form">

<label for="language">${escapeHtml(s.siteStepLanguage)}</label>
<select id="language" name="language" data-setup-lang>${langs}</select>

<label for="title">${escapeHtml(s.siteStepName)}</label>
<input id="title" name="title" type="text" required autofocus
       value="${escapeAttr(settings.title)}">

<label for="timezone">${escapeHtml(s.siteStepTz)}</label>
<input id="timezone" name="timezone" type="text" data-tz autocapitalize="none"
       spellcheck="false" value="${escapeAttr(settings.timezone)}">
<p class="login-hint">${escapeHtml(s.siteStepTzHint)}</p>

<label for="siteUrl">${escapeHtml(s.siteStepAddress)}</label>
<input id="siteUrl" name="siteUrl" type="url" autocapitalize="none" spellcheck="false"
       value="${escapeAttr(settings.siteUrl || opts.address)}">
<p class="login-hint">${escapeHtml(s.siteStepAddressHint)}</p>

<button type="submit" class="login-submit">${escapeHtml(s.authContinue)}</button>
</form>`)
}

/**
 * Step two: the front page, SHOWN rather than described.
 *
 * This is a choice about a look, and a sentence is the wrong medium for one — "a composed
 * front page with a lead story and rows" means nothing until you have seen it beside the
 * alternative. Two diagrams in CSS rather than two screenshots: the difference between the
 * layouts is coarse enough that a drawing carries it, and a screenshot pipeline in the
 * product would be a build step, a cache and a thing to keep in sync for one screen.
 */
export function faceStepScreen(settings: SiteSettings): string {
  const s = adminT(settings.language)
  const mode = settings.home.mode === 'front' ? 'front' : 'list'

  // The two drawings. Bars, not words: a diagram that needs reading is a paragraph.
  const listArt = '<span class="face-row face-wide"></span>'
    + Array.from({ length: 3 }, () =>
      '<span class="face-item"><span class="face-line"></span>'
      + '<span class="face-line face-short"></span></span>').join('')
  const frontArt = '<span class="face-lead"></span>'
    + '<span class="face-cols"><span></span><span></span><span></span></span>'
    + '<span class="face-row"></span>'

  const option = (value: string, art: string, label: string, hint: string): string => `
<label class="face-choice">
  <input type="radio" name="mode" value="${escapeAttr(value)}"${value === mode ? ' checked' : ''}>
  <span class="face-art" aria-hidden="true">${art}</span>
  <span class="face-name">${escapeHtml(label)}</span>
  <span class="face-hint">${escapeHtml(hint)}</span>
</label>`

  return loginShell(settings, s.faceStepTitle, `
<h1>${escapeHtml(s.faceStepTitle)}</h1>
<p class="login-lede">${escapeHtml(s.faceStepLede)}</p>
<form method="post" action="/setup/face" class="login-form">
<div class="face-grid">
${option('list', listArt, s.faceList, s.faceListHint)}
${option('front', frontArt, s.faceFront, s.faceFrontHint)}
</div>
<button type="submit" class="login-submit">${escapeHtml(s.setupFinish)}</button>
</form>`)
}
