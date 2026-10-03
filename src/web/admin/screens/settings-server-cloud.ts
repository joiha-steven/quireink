// Settings → Server → Run on Cloudflare (G5.3): the card that moves a Bun blog into a Worker in the
// owner's own Cloudflare account — and, on a blog already there, its update and its cost (G5.4). The move is `install/cloudflare/move.ts`, its routes are
// `web/admin/cloudflare-move.ts`, and what each key does is `admin/island/lib/settings-cloud.ts`.
//
// ⚠️ NOTHING HERE IS A SETTING. The account ID, the token and the password are `textControl`s with
// no `data-k`, so the sheet's Save never sees them: a token in the settings payload would be a
// credential written to the database and echoed into every later save. They go to the move's own
// route and nowhere else.
//
// ⚠️ EVERY STATE SHIPS DRAWN AND HIDDEN — the check's three answers, the six steps, the finished
// line, the error — because the words live here with the locales and a state built in JavaScript
// is a second copy of this markup that drifts from it (`fields-pic.ts` states the rule).
import type { AdminStrings } from '@/i18n/admin-i18n'
import { escapeAttr, escapeHtml } from '@/utils'
import { readEnv } from '@/env'
import { buttonClass } from '@/admin-shared/kit'
import { NOTE_ALERT, NOTE_TEXT } from '@/admin-shared/scale'
import { panelCard, settingRow, textControl } from '@/web/admin/fields'
import { lamp } from '@/web/admin/kit'
import { MOVE_STEPS, type MoveStep } from '@/install/cloudflare/move'

const LINE = 'text-sm text-neutral-700 dark:text-neutral-300'

function stepLabel(t: AdminStrings, step: MoveStep): string {
  return {
    check: t.cfStepCheck, package: t.cfStepPackage, install: t.cfStepInstall,
    archive: t.cfStepArchive, upload: t.cfStepUpload, verify: t.cfStepVerify,
  }[step]
}

/** The sentences only the island knows when to say, with their `{…}` left for it to fill. */
function words(t: AdminStrings): string {
  return escapeAttr(JSON.stringify({
    paid: t.cfCheckPaid, free: t.cfCheckFree, unknown: t.cfCheckUnknown, exists: t.cfCheckExists,
    done: t.cfDone, domainNote: t.cfDomainNote, attach: t.cfAttach, attached: t.cfAttached,
    siteUrlNeeded: t.cfSiteUrlNeeded, wrongPassword: t.cfWrongPassword, running: t.cfRunning,
    failed: t.cfFailed, tooMany: t.cfTooMany, tooBig: t.cfCheckTooBig, network: t.cfErrNetwork,
    interrupted: t.cfInterrupted, tokenRequired: t.cfErrToken,
  }))
}

/**
 * On Cloudflare (G5.4): the version, how this blog takes a newer one, and what the month costs. All of
 * it comes from `GET /api/cloudflare/status`, which this render has not called — so every variant
 * ships drawn and hidden, and the island shows the one that applies.
 */
function onCloudflare(t: AdminStrings): string {
  const words = escapeAttr(JSON.stringify({
    version: t.cfVersion, updateTo: t.cfUpdateTo, newest: t.cfUpdateNewest, updating: t.cfUpdating,
    updated: t.cfUpdated, rolledBack: t.cfRolledBack, failed: t.cfUpdateFailed, cost: t.cfCost,
    confirmLabel: t.cfLeaveConfirmLabel, leaveDone: t.cfLeaveDone, mismatch: t.cfConfirmMismatch,
    wrongPassword: t.cfWrongPassword, tooMany: t.cfTooMany, look: t.cfUpdateLook, network: t.cfErrNetwork,
    tokenRequired: t.cfErrToken, notApi: t.cfErrNotApi, tokenCannot: t.cfErrTokenCannot, leaveFailed: t.cfLeaveFailed,
  }))
  return panelCard({
    title: t.cardCloudOn,
    attrs: `data-cf-live data-cf-words="${words}"`,
    body: `<div class="space-y-4">`
      + `<p class="${LINE}" data-cf-version></p>`
      + `<div class="space-y-3" data-cf-path="api" hidden>`
      + `<div class="space-y-3" data-cf-ask-token hidden><p class="${NOTE_TEXT}">${escapeHtml(t.cfUpdateTokenNote)}</p>`
      + settingRow({ label: t.cfAccountLabel, control: textControl({ value: '', label: t.cfAccountLabel, attrs: 'data-cf-u-account autocomplete="off" spellcheck="false"' }) })
      + settingRow({ label: t.cfTokenLabel, control: textControl({ value: '', type: 'password', label: t.cfTokenLabel, attrs: 'data-cf-u-token autocomplete="off"' }) })
      + `</div>`
      + `<button type="button" data-cf-update class="${buttonClass('primary', 'sm')}" hidden></button>`
      + `<p class="${LINE}" data-cf-update-line aria-live="polite" hidden></p></div>`
      + `<p class="${NOTE_TEXT}" data-cf-path="git" hidden>${escapeHtml(t.cfUpdateGit)}</p>`
      + `<p class="${NOTE_TEXT}" data-cf-path="cli" hidden>${escapeHtml(t.cfUpdateCli)}</p>`
      + `<p class="${NOTE_ALERT}" data-cf-error role="alert" hidden></p>`
      + `<p class="${NOTE_TEXT}" data-cf-cost></p>`
      // Leaving: the archive first, because nothing is behind the delete — no Trash, and the
      // object's 30 days of bookmarks go with it.
      + `<div class="space-y-3 border-t border-neutral-200 pt-4 dark:border-neutral-800" data-cf-leave hidden>`
      + `<p class="${LINE} font-medium">${escapeHtml(t.cfLeaveTitle)}</p>`
      + `<p class="${NOTE_TEXT}">${escapeHtml(t.cfLeaveNote)}</p>`
      + `<a href="/api/backup/export" download class="${buttonClass('secondary', 'sm')}">${escapeHtml(t.cfLeaveDownload)}</a>`
      + settingRow({ label: t.cfCurrentLabel, control: textControl({ value: '', type: 'password', label: t.cfCurrentLabel, attrs: 'data-cf-leave-current autocomplete="current-password"' }) })
      + settingRow({ label: t.cfLeaveConfirmLabel, control: textControl({ value: '', label: t.cfLeaveConfirmLabel, attrs: 'data-cf-leave-confirm autocomplete="off" spellcheck="false"' }) })
      + `<button type="button" data-cf-leave-key class="${buttonClass('danger', 'sm')}">${escapeHtml(t.cfLeaveDelete)}</button>`
      + `<p class="${LINE}" data-cf-leave-line aria-live="polite" hidden></p></div>`
      + `<p class="${NOTE_TEXT}" data-cf-leave-git hidden>${escapeHtml(t.cfLeaveGit)}</p>`
      + `<p class="${NOTE_TEXT}" data-cf-leave-cli hidden>${escapeHtml(t.cfLeaveCli)}</p>`
      + `</div>`,
  })
}

/** The move on a Bun install; the version, the update and the cost on Cloudflare. */
export function cloudCard(t: AdminStrings): string {
  if (readEnv().package === 'cloudflare') return onCloudflare(t)
  const steps = MOVE_STEPS.map((step) =>
    `<li class="flex items-center gap-2.5" data-cf-step="${step}">`
    + lamp({ state: 'off', attrs: 'data-cf-lamp' })
    + `<span class="${LINE}">${escapeHtml(stepLabel(t, step))}</span>`
    + `<span class="ml-auto truncate text-xs text-neutral-500 dark:text-neutral-400" data-cf-detail></span></li>`).join('')
  return panelCard({
    title: t.cardCloud,
    attrs: `data-cf-card data-cf-words="${words(t)}"`,
    body: `<div class="space-y-5">`
      + `<p class="${NOTE_TEXT}">${escapeHtml(t.cfMoveIntro)}</p>`
      + settingRow({
        label: t.cfAccountLabel, note: t.cfAccountNote,
        control: textControl({ value: '', label: t.cfAccountLabel, attrs: 'data-cf-account autocomplete="off" spellcheck="false"' }),
      })
      + settingRow({
        label: t.cfTokenLabel, note: t.cfTokenNote,
        control: textControl({ value: '', type: 'password', label: t.cfTokenLabel, attrs: 'data-cf-token autocomplete="off"' }),
      })
      + `<div class="flex flex-wrap items-center gap-3">`
      + `<button type="button" data-cf-check class="${buttonClass('secondary', 'sm')}">${escapeHtml(t.cfCheck)}</button>`
      + `<p class="${LINE}" data-cf-answer aria-live="polite" hidden></p></div>`
      + `<label class="flex items-center gap-2 ${LINE}" data-cf-paid-row hidden>`
      + `<input type="checkbox" data-cf-confirm-paid> ${escapeHtml(t.cfConfirmPaid)}</label>`
      + `<label class="flex items-start gap-2 ${LINE}"><input type="checkbox" class="mt-1" data-cf-self-update>`
      + `<span>${escapeHtml(t.cfSelfUpdate)}<span class="block ${NOTE_TEXT}">${escapeHtml(t.cfSelfUpdateNote)}</span></span></label>`
      + settingRow({
        label: t.cfCurrentLabel, note: t.cfCurrentNote,
        control: textControl({ value: '', type: 'password', label: t.cfCurrentLabel, attrs: 'data-cf-current autocomplete="current-password"' }),
      })
      + `<button type="button" data-cf-move disabled class="${buttonClass('primary', 'sm')}">${escapeHtml(t.cfMove)}</button>`
      + `<ol class="space-y-2" data-cf-steps hidden>${steps}</ol>`
      + `<p class="${NOTE_ALERT}" data-cf-error role="alert" hidden></p>`
      + `<div class="space-y-3" data-cf-done hidden>`
      + `<p class="${LINE}" data-cf-done-line></p>`
      + `<p class="${NOTE_TEXT}" data-cf-domain-note></p>`
      + `<button type="button" data-cf-domain class="${buttonClass('secondary', 'sm')}"></button>`
      + `</div></div>`,
  })
}
