// First run, after the account: the only four questions worth interrupting somebody for.
//
// The list of what is NOT here is the design. Palettes, fonts, book mode, the feature
// switches — none of them belongs in a wizard, because nobody can judge them before the site
// has a single post on it. Asking is asking a person to pick the binding for a book they
// have not written, and a choice made blind is worse than a default: a default still reads
// as "not decided yet", while something you clicked reads as decided. Those live on the
// dashboard's "first five minutes" card, which is re-openable, which is the right shape for
// them: a choice you can return to is a choice you can safely postpone.
//
// What is left qualifies on one of three grounds. The site address and the time zone are
// WRONG BY DEFAULT AND SILENT ABOUT IT — one makes every feed, sitemap and share card say
// `localhost:3000`, the other makes every date on the site read in the server's timezone —
// and the browser happens to know both. The front page is the one honest coin-flip: it
// decides what `/` even is.
//
// The reader's pen (2026-09-11) is the third, and it is not a taste question like the ones
// ruled out above. It is the only switch on this software that changes what OTHER PEOPLE may
// do on your pages, and it is the thing Quire Ink has that the blog you came from does not
// (ADR 0043) — an owner who never opens Settings never learns it is there. So it is asked
// once, with the answer it already has, and one click in Settings undoes the asking.
//
// The dialect (2026-09-13) is the fourth, and it looks at first like exactly the taste
// question ruled out above. It is not, and the difference is what the question ASKS. A
// palette or a typeface asks you to judge a thing you have not seen on writing you have not
// done. This asks what you are about to write — which you know before you have written a
// word, and which is the only fact the four dialects differ on. It is also the one setting
// here that a screenshot carries whole, so an owner who never opens Settings would never
// learn that their blog could have looked like anything else.
//
// LAST, and that is also where the run is finished and the release stamped: a blog that has
// answered this has been asked, and the admin's what's-new panel must never ask it again.

import type { SiteLook, SiteSettings } from '@/types'
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
<button type="submit" class="login-submit">${escapeHtml(s.authContinue)}</button>
</form>`)
}

/**
 * Step three: the reader's pen, drawn rather than argued.
 *
 * Same two-card shape as the front page, for the same reason and out of the same CSS: the
 * question is what a page LOOKS like after a reader has been at it. The mark in the drawing
 * is a flat band in the site's own accent and not the pen's real stroke — the sheets that
 * carry the real one are 280 drawings and 270 KB (ADR 0027), which is not a thing to put in
 * front of somebody on the third screen of setup. The drawing says "a mark on the words",
 * which is the whole of what is being asked.
 */
export function readerStepScreen(settings: SiteSettings): string {
  const s = adminT(settings.language)
  const on = settings.features.readerPen

  const lines = (marked: boolean): string =>
    Array.from({ length: 4 }, (_, i) =>
      `<span class="face-line${i === 3 ? ' face-short' : ''}${marked && i === 1 ? ' face-mark' : ''}"></span>`)
      .join('')

  const option = (value: string, art: string, label: string, hint: string, checked: boolean): string => `
<label class="face-choice">
  <input type="radio" name="pen" value="${escapeAttr(value)}"${checked ? ' checked' : ''}>
  <span class="face-art" aria-hidden="true">${art}</span>
  <span class="face-name">${escapeHtml(label)}</span>
  <span class="face-hint">${escapeHtml(hint)}</span>
</label>`

  return loginShell(settings, s.penStepTitle, `
<h1>${escapeHtml(s.penStepTitle)}</h1>
<p class="login-lede">${escapeHtml(s.penStepLede)}</p>
<form method="post" action="/setup/reader" class="login-form">
<div class="face-grid">
${option('on', lines(true), s.penStepOn, s.penStepOnHint, on)}
${option('off', lines(false), s.penStepOff, s.penStepOffHint, !on)}
</div>
<button type="submit" class="login-submit">${escapeHtml(s.setupFinish)}</button>
</form>`)
}

/**
 * Step four: what you are about to write, which is what the site dresses itself for.
 *
 * Four cards, same shape as the two before it, and DRAWN for the same reason: "the furniture
 * reads as source code while your text stays analogue" is a sentence nobody can picture. The
 * drawings are the same bars the other steps use plus three small parts — a gutter of line
 * numbers, a masthead over columns, a ruled sheet — because that is the whole of what
 * separates the four at this size.
 *
 * The names are the ones the Settings field uses. A person who meets "Newspaper" here and
 * goes looking for it later finds the same word.
 */
export function lookStepScreen(settings: SiteSettings): string {
  const s = adminT(settings.language)
  const worn: SiteLook = settings.look

  const lines = (n: number): string =>
    Array.from({ length: n }, (_, i) =>
      `<span class="face-line${i === n - 1 ? ' face-short' : ''}"></span>`).join('')
  // A gutter of numbers beside each line: the one mark that says "editor" at this size.
  const gutter = (n: number): string =>
    Array.from({ length: n }, (_, i) =>
      `<span class="face-gut"><span class="face-num"></span>`
      + `<span class="face-line${i === n - 1 ? ' face-short' : ''}"></span></span>`).join('')
  // A centred nameplate over a heavy rule, then columns: a masthead and nothing else.
  const masthead = '<span class="face-plate"></span><span class="face-heavy"></span>'
    + '<span class="face-cols"><span></span><span></span><span></span></span>'
  // A sheet lifted off the desk, with the printing already on it.
  const sheet = `<span class="face-sheet">${
    Array.from({ length: 4 }, () => '<span class="face-ruled"></span>').join('')}</span>`

  const option = (value: SiteLook, art: string, label: string, hint: string): string => `
<label class="face-choice">
  <input type="radio" name="look" value="${escapeAttr(value)}"${value === worn ? ' checked' : ''}>
  <span class="face-art" aria-hidden="true">${art}</span>
  <span class="face-name">${escapeHtml(label)}</span>
  <span class="face-hint">${escapeHtml(hint)}</span>
</label>`

  return loginShell(settings, s.lookStepTitle, `
<h1>${escapeHtml(s.lookStepTitle)}</h1>
<p class="login-lede">${escapeHtml(s.lookStepLede)}</p>
<form method="post" action="/setup/look" class="login-form">
<div class="face-grid">
${option('plain', lines(4), s.lookPlain, s.lookStepPlainHint)}
${option('code', gutter(4), s.lookCode, s.lookStepCodeHint)}
${option('paper', masthead, s.lookPaper, s.lookStepPaperHint)}
${option('notes', sheet, s.lookNotes, s.lookStepNotesHint)}
</div>
<button type="submit" class="login-submit">${escapeHtml(s.setupFinish)}</button>
</form>`)
}
