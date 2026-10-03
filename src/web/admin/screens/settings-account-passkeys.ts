// The passkeys row of the security card (ADR 0071): the list, the name box, the key that adds one,
// and what the card has to say about an address that changes.
//
// Its own file because `settings-account.ts` stands near the line limit, and because it is the one
// row on the card with a template of its own. The rules of that file hold here word for word:
// MARKUP ONLY (the island in `src/admin/island/lib/settings-passkeys.ts` does everything), no
// `data-k` anywhere (a passkey is not a setting), and nothing that the page could not show to
// anyone — the list ships EMPTY, because the server drawing this has not asked who has passkeys.
import type { AdminStrings } from '@/i18n/admin-i18n'
import { escapeAttr, escapeHtml } from '@/utils'
import { CONTROL, buttonClass } from '@/admin-shared/kit'
import { NOTE_ALERT } from '@/admin-shared/scale'
import { settingRow } from '@/web/admin/fields'

const STATE = 'text-sm text-neutral-700 dark:text-neutral-300'
const META = 'block text-xs text-neutral-500 dark:text-neutral-400'

/**
 * ONE PASSKEY, as a `<template>` the island clones, for the reason `sessionRow` gives: a row built
 * in JavaScript is a second copy of the markup, and every word stays here, where the locales are.
 * "Last used" and "not used yet" both ship drawn, one hidden.
 */
function passkeyRow(t: AdminStrings): string {
  return `<template data-sec-passkey-row>`
    + `<li class="flex flex-wrap items-center justify-between gap-3 py-2" data-security-passkey>`
    + `<span class="min-w-0">`
    + `<span class="block text-sm text-neutral-700 dark:text-neutral-300" data-sec-passkey-name></span>`
    + `<span class="${META}">${escapeHtml(t.securityPasskeyCreated)} <span data-sec-passkey-created></span> · `
    + `<span data-sec-passkey-used>${escapeHtml(t.securityPasskeyLastUsed)} <span data-sec-passkey-when></span></span>`
    + `<span data-sec-passkey-never hidden>${escapeHtml(t.securityPasskeyNever)}</span></span></span>`
    + `<button type="button" data-sec-passkey-remove disabled class="${buttonClass('secondary', 'sm')}">`
    + `${escapeHtml(t.securityPasskeyRemove)}</button></li></template>`
}

/**
 * The row. THE DOMAIN SENTENCE IS A STATE, NOT A NOTE: it is the one thing on this row that must
 * survive explanations being switched off, because it is the thing an owner about to move the blog
 * needs and will not go looking for. It carries `{host}` raw in `data-tpl` and ships hidden; the
 * island fills in the RP ID `/api/security` reports and shows it.
 *
 * The add key ships DISABLED like every action on this card: it needs the password above, a
 * browser that can make passkeys, and an address that is a name rather than an IP.
 */
export function passkeysRow(t: AdminStrings): string {
  return settingRow({
    label: t.securityPasskeys, note: t.securityPasskeysHint,
    control: `<p class="${STATE}" data-sec-passkeys-bound data-tpl="${escapeAttr(t.securityPasskeysBound)}" hidden></p>`
      + `<p class="${STATE} mt-2" data-sec-passkeys-none>${escapeHtml(t.securityPasskeyNone)}</p>`
      + `<ul class="divide-y divide-neutral-100 dark:divide-neutral-800" data-sec-passkeys></ul>`
      + passkeyRow(t)
      + `<div class="mt-3 flex flex-wrap items-center gap-2">`
      // A name the owner will recognise on this list in a year. Optional: left empty, the server
      // names it after the device it was made on, the way the device list below does.
      + `<input type="text" maxlength="60" autocomplete="off" data-sec-passkey-name-box`
      + ` aria-label="${escapeAttr(t.securityPasskeyName)}" placeholder="${escapeAttr(t.securityPasskeyNamePlaceholder)}"`
      + ` class="${CONTROL} w-full max-w-sm">`
      // `md`, beside a box, for the reason the password row gives.
      + `<button type="button" data-sec-passkey-add disabled class="${buttonClass('secondary', 'md')}">`
      + `${escapeHtml(t.securityPasskeyAdd)}</button></div>`
      + `<p class="${NOTE_ALERT} mt-2" data-sec-passkey-unsupported hidden>${escapeHtml(t.securityPasskeyUnsupported)}</p>`
      + `<p class="${NOTE_ALERT} mt-2" data-sec-passkey-needs-name hidden>${escapeHtml(t.securityPasskeyNeedsName)}</p>`,
  })
}
