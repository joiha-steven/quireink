// Settings → Server: THE BLOG AS SOMEBODY YOU CAN FOLLOW. ADR 0059.
//
// The third machine door on this tab, and the one that is different in kind. MCP and the Content
// API are ways IN to this blog; this one gives it an identity OUT there — a name in a network of
// other people's servers, and a list of strangers who asked to hear from it.
//
// ⚠️ THE WARNING IS NOT GATED AND IS NOT AN EXPLANATION. The handle and the site address
// together ARE the actor's id, cached by every server that follows this blog. Change either and
// the old actor stops existing for them, with nothing anywhere telling them where it went. That
// sentence has to be readable BEFORE the switch moves, and it must survive
// `[data-explanations=off]` — which is why it is `META` and not `NOTE_TEXT`, the same reasoning
// the Content API card carries.
import type { AdminStrings } from '@/i18n/admin-i18n'
import type { SiteSettings } from '@/types'
import { escapeHtml, fill } from '@/utils'
import { META } from '@/admin-shared/scale'
import { connectionCard, panelList } from '@/web/admin/fields-box'
import { settingRow, switchRow, textField } from '@/web/admin/fields'

const COPY_BOX = 'flex min-h-9 min-w-0 flex-1 items-center truncate rounded-lg border'
  + ' border-neutral-300 px-3 text-xs dark:border-neutral-700'

export function activityPubCard(
  t: AdminStrings, s: SiteSettings, view: { origin: string; followers: number },
): string {
  const site = (s.siteUrl || view.origin).replace(/\/+$/, '')
  const host = hostOf(site)
  const handle = s.activitypub.handle
  // The full address, or the shape it would take, so the owner can see what they are choosing.
  const address = handle && host ? `@${handle}@${host}` : ''
  const live = s.activitypub.enabled && handle !== '' && s.siteUrl !== ''

  const name = textField({
    k: 'activitypub.handle',
    label: t.apHandle,
    note: t.apHandleHint,
    value: handle,
    attrs: 'maxlength="30" autocapitalize="none" spellcheck="false"',
  })

  const shown = settingRow({
    label: t.apAddress,
    note: t.apAddressHint,
    control: `<code class="${COPY_BOX} bg-neutral-50 dark:bg-neutral-900" data-ap-address>`
      + `${escapeHtml(address || '—')}</code>`,
  })

  return connectionCard({
    title: t.cardActivityPub,
    keys: ['activitypub'],
    state: live ? 'good' : 'off',
    lampTitle: live ? t.connectionOk : t.connectionOff,
    body: panelList(`<div>`
      + switchRow({
        k: 'activitypub.enabled', label: t.apEnable, note: t.apEnableDesc, on: s.activitypub.enabled,
      })
      + `<div class="border-t border-neutral-200 p-4 dark:border-neutral-800">`
      + `<p class="${META}">${escapeHtml(t.apWarning)}</p></div>`
      + `<div class="border-t border-neutral-200 p-4 dark:border-neutral-800">${name}</div>`
      + `<div class="border-t border-neutral-200 p-4 dark:border-neutral-800">${shown}</div>`
      // ⚠️ THE ADDRESS IS THE ONE THING THAT CAN BE MISSING AND IS NOT A TYPO. Without it the
      // actor's id would say `localhost`, so the feature refuses to run — and an owner whose
      // switch is on and whose blog is silent deserves to be told which of the two it is.
      + (s.siteUrl === ''
        ? `<div class="border-t border-neutral-200 p-4 dark:border-neutral-800">`
          + `<p class="${META}">${escapeHtml(t.apNeedsAddress)}</p></div>`
        : '')
      + (live
        ? `<div class="border-t border-neutral-200 p-4 dark:border-neutral-800">`
          + `<p class="${META}">${escapeHtml(fill(t.apFollowers, { n: String(view.followers) }))}</p></div>`
        : '')
      + `</div>`),
  })
}

const hostOf = (site: string): string => {
  try {
    return new URL(site).host
  } catch {
    return ''
  }
}
