// Newsletter → Send, and Newsletter → Test (ADR 0054).
//
// ⚠️ THERE IS NO `<form>` ON THIS SCREEN, AND THAT IS A SAFETY DECISION, not a style one.
// `POST /api/broadcast` puts mail on a relay and a newsletter cannot be unsent. A `<button>`
// with no `type` is a SUBMIT button, so a form here would mean that Enter, pressed anywhere
// inside it, fires the real send and walks straight past the two-press latch below. Every
// control here is `type="button"` and the island does the request. `tour-flows-news.ts` holds
// that shape: it fails if a form ever appears in this panel or a button loses its type.
//
// THE LATCH, which `docs/admin-design.md` names as the admin's one two-stage control: the
// first press ARMS the button, turning it amber and printing the recipient count the send will
// use; only a second press within five seconds sends. Esc, a click anywhere else, touching the
// selection, or running out of seconds stands it down. It replaced a native `confirm()` that
// asked its question in the browser's voice with none of the numbers.
//
// The PREVIEW is not rendered here even though `previewBroadcast()` is safe to call on the
// server. The default tab is People, so pre-rendering the email would put tens of kilobytes of
// message HTML on every visit to a screen most visits never open this half of. The island
// fetches it when the tab opens, exactly as the React face did on mount.
import type { AdminStrings } from '@/i18n/admin-i18n'
import { escapeAttr, escapeHtml } from '@/utils'
import { CHECK, CONTROL } from '@/admin-shared/kit'
import { NOTE_TEXT, SETTING_LABEL } from '@/admin-shared/scale'
import { buttonClass } from '@/admin-shared/kit'
import { card } from '@/web/admin/kit'
import type { newsletterView } from '@/web/admin/views-news'

type Letter = Awaited<ReturnType<typeof newsletterView>>
type Post = Letter['posts'][number]

const PICK_ROW = 'flex cursor-pointer items-start gap-3 border-b border-neutral-100 px-3.5 py-2.5'
  + ' last:border-0 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/40'

/**
 * One post in the picker. `data-sent` is what already left the server for this slug, read from
 * the send LOG rather than from `posts.broadcast_at`: the log is what the server's own consent
 * check reads, so the button and the server agree about what "already sent" means.
 */
function pick(t: AdminStrings, p: Post, first: boolean): string {
  const done = (p.stats?.sent ?? 0) > 0
  return `<label class="${PICK_ROW}">`
    + `<input type="checkbox" data-nl-post value="${escapeAttr(p.slug)}" data-sent="${done ? '1' : ''}"`
    + `${first ? ' checked' : ''} class="mt-1 ${CHECK}">`
    + `<span class="min-w-0 flex-1">`
    + `<span class="block truncate text-sm text-neutral-800 dark:text-neutral-100">${escapeHtml(p.title)}</span>`
    + `<span class="mt-0.5 block text-xs tabular-nums text-neutral-500 dark:text-neutral-400">`
    + `${escapeHtml(p.date.slice(0, 10))}${done ? ` · ${escapeHtml(t.nlAlreadySentShort)}` : ''}</span>`
    + `</span></label>`
}

export function sendPanel(t: AdminStrings, posts: Post[], open: boolean): string {
  const shell = (body: string): string =>
    `<div data-nl-panel="send" class="px-5 py-4"${open ? '' : ' hidden'}>${body}</div>`

  if (posts.length === 0) {
    return shell(`<p class="text-sm text-neutral-500 dark:text-neutral-400">${escapeHtml(t.nlNoPosts)}</p>`)
  }

  // Both hints ship; the island shows the one that matches how many are ticked, because "these
  // three go out as ONE email" is the whole answer to the question ticking a third one raises.
  // The digest line stays EMPTY in the markup: it carries a count, and a `{n}` sitting in the
  // page waiting for JavaScript is a placeholder somebody eventually sees.
  const hints = `<p class="${NOTE_TEXT}">`
    + `<span data-nl-hint-one>${escapeHtml(t.nlSendHint)}</span>`
    + `<span data-nl-hint-many hidden></span></p>`

  /**
   * ⚠️ THE FIRST POST IS TICKED, AND IT MAY ALREADY HAVE GONE OUT.
   *
   * The server draws the state the screen is actually IN, not a resting state the island
   * corrects a frame later: if the newest post has successful sends behind it, the consent
   * block is open and the button is locked in the first response. Drawn the other way round,
   * the owner met a live Send button for a post the server would then refuse — an error toast
   * where the screen should have been asking a question.
   */
  const priorSent = posts[0] && (posts[0].stats?.sent ?? 0) > 0 ? 1 : 0
  const consent = `<div data-nl-consent class="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm dark:border-neutral-800 dark:bg-neutral-900"${priorSent ? '' : ' hidden'}>`
    + `<p class="text-neutral-600 dark:text-neutral-400" data-nl-consent-line>`
    + `${priorSent ? escapeHtml(t.nlAlreadySent.replace('{n}', String(priorSent))) : ''}</p>`
    + `<label class="mt-2 flex items-center gap-2 text-neutral-700 dark:text-neutral-300">`
    + `<input type="checkbox" data-nl-resend class="${CHECK}">${escapeHtml(t.nlResendConfirm)}</label></div>`

  const button = `<span data-nl-latch class="inline-flex">`
    + `<button type="button" data-nl-send class="${buttonClass('primary')}"${priorSent ? ' disabled' : ''}>`
    + `<span data-nl-send-lamp aria-hidden="true" class="h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber-500 motion-reduce:animate-none" hidden></span>`
    + `<span data-nl-send-label>${escapeHtml(t.nlSendButton)}</span></button></span>`

  const picker = card({
    title: escapeHtml(t.nlPickPost),
    body: `<div class="space-y-4">`
      + `<div class="scroll-fade max-h-80 overflow-y-auto rounded-lg border border-neutral-200 dark:border-neutral-800">`
      + posts.map((p, i) => pick(t, p, i === 0)).join('')
      + `</div>${hints}${consent}${button}</div>`,
  })

  // `sandbox=""` with no allow-* tokens: the email HTML cannot run scripts, submit forms or
  // navigate the admin. It is only ever rendered, never trusted.
  const preview = card({
    title: escapeHtml(t.nlPreview),
    body: `<p data-nl-preview-state class="text-sm text-neutral-500 dark:text-neutral-400">${escapeHtml(t.loading)}</p>`
      + `<div data-nl-preview class="space-y-3" hidden>`
      + `<p class="text-sm"><span class="text-neutral-500 dark:text-neutral-400">${escapeHtml(t.nlSubjectLabel)}: </span>`
      + `<span data-nl-subject class="font-medium"></span></p>`
      + `<iframe data-nl-frame title="${escapeAttr(t.nlPreview)}" sandbox=""`
      + ` class="h-[34rem] w-full rounded-lg border border-neutral-200 bg-white dark:border-neutral-800"></iframe>`
      + `<p class="${NOTE_TEXT}">${escapeHtml(t.nlPreviewHint)}</p></div>`,
  })

  return shell(`<div class="grid items-start gap-5 xl:grid-cols-2">${picker}${preview}</div>`)
}

/**
 * Newsletter → Test: one sample of each email the blog sends, through the SAVED SMTP config.
 *
 * It lives beside the audience rather than beside the credentials because this is the "did it
 * actually work" step, not a setting. Each of the three sends ONE real message, to the address
 * typed or to the owner's own when that is empty.
 */
export function testPanel(t: AdminStrings, open: boolean): string {
  const kinds: [string, string][] = [
    ['smtp', t.nlTestSmtp], ['post', t.nlTestPost], ['subscribe', t.nlTestSubscribe],
  ]
  return `<div data-nl-panel="test" class="px-5 py-4"${open ? '' : ' hidden'}>`
    + card({
      title: escapeHtml(t.nlTestHeading),
      body: `<div class="space-y-4"><p class="${NOTE_TEXT}">${escapeHtml(t.nlTestHint)}</p>`
        + `<div class="sm:max-w-sm"><label class="${SETTING_LABEL}" for="nl-test-to">${escapeHtml(t.nlTestTo)}</label>`
        + `<input id="nl-test-to" data-nl-test-to type="email" autocomplete="off" class="${CONTROL} mt-2 w-full"></div>`
        + `<div class="flex flex-wrap gap-2">`
        + kinds.map(([kind, label]) =>
          `<button type="button" data-nl-test="${escapeAttr(kind)}" class="${buttonClass('secondary')}">${escapeHtml(label)}</button>`).join('')
        + `</div></div>`,
    })
    + `</div>`
}
