// Settings → Server: THE DOOR A PROGRAM READS THROUGH. One switch, one address, and the
// sentence that says what turning it on actually means.
//
// ADR 0057. Next to the MCP card because they are the same kind of thing — a machine surface,
// off at install, 404 while shut — and deliberately much smaller, because they are not the same
// SHAPE. MCP mints credentials and needs a manager for them; this has no credential at all, and
// that is the fact `apiReadOnly` exists to put in front of the owner before they press the key.
//
// ⚠️ NO SAVE KEY OF ITS OWN, and no gate on the address. Both were in the first cut, copied from
// the MCP card, and the tour flow found them: a card's own key is for one that can TRY the far
// end (`fields-box.ts` says so, and names six cards that grew one without a route), and this
// card only sets a boolean — the screen's Save stores it like every other field. With no card
// save there is no card-save path, and `applyLiveGates` runs from nowhere else: a
// `data-gate-live` address would have opened only on the next page load.
//
// The address is shown either way, which is the honest shape here rather than a concession. It
// is a fixed, documented, guessable path — `{site}/api/v1` — with a switch directly above it
// saying whether anything answers there. What the MCP card gates is a TOKEN MINTER, which is a
// capability; this is a string, and hiding it only hides where the door would be.
import type { AdminStrings } from '@/i18n/admin-i18n'
import type { SiteSettings } from '@/types'
import { escapeAttr, escapeHtml } from '@/utils'
import { SHEET_TOOL, buttonClass } from '@/admin-shared/kit'
import { META } from '@/admin-shared/scale'
import { connectionCard, panelList } from '@/web/admin/fields-box'
import { settingRow, switchRow } from '@/web/admin/fields'

/** Same box as the MCP endpoint's: `min-h-9` matches the key beside it, `min-w-0` lets it truncate. */
const COPY_BOX = 'flex min-h-9 min-w-0 flex-1 items-center truncate rounded-lg border'
  + ' border-neutral-300 px-3 text-xs dark:border-neutral-700'

/**
 * WHAT A MACHINE DOOR SHOWS WHEN THE BLOG DOES NOT KNOW ITS OWN ADDRESS.
 *
 * Both cards printed `/api/mcp` and `/api/v1` with nothing in front, and a copy key beside them:
 * a relative path no client can be pointed at, handed out as if it were the answer. With no site
 * address and no `SITE_URL` the page cannot know the host the outside world uses (the admin may
 * be reached through a proxy under another name), so it says where the answer is set instead,
 * and the key goes to that field's tab. `data-needs-address` is the tour's hook for this state.
 */
export function needsAddress(t: AdminStrings, label: string): string {
  // `META`, not the row's note: notes hide with "Hide explanations", and this sentence is the
  // answer in place of the address, not an explanation of it.
  return settingRow({
    label,
    control: `<p class="${META}">${escapeHtml(t.machineNeedsAddress)}</p>`
      + `<button type="button" data-settings-goto="blog" data-needs-address class="${SHEET_TOOL}">`
      + `${escapeHtml(t.seoCanonical)} →</button>`,
  })
}

/**
 * The address row, DRAWN IN BOTH FACES: the copyable address, and the note that stands in for it.
 *
 * ⚠️ BOTH, because the answer changes without a page load. The owner sets the Site address on the
 * Blog tab and presses Save, and this tab is already in the page (all seven panels are, ADR 0054):
 * drawn in one face only, the note went on saying "set the site address first" over an address
 * that had just been set, until a reload. `lib/settings-save.ts` (`paintAddresses`) picks the face
 * after every save from the record the save answered with, falling back to `SITE_URL`, which only
 * the server knows and so rides here as `data-fallback`.
 */
export function machineAddress(t: AdminStrings, a: {
  label: string; note: string; path: string; address: string; fallback: string
  control: (address: string) => string
}): string {
  const known = a.address !== ''
  return `<div data-machine-address data-path="${escapeAttr(a.path)}" data-fallback="${escapeAttr(a.fallback)}">`
    + `<div data-machine-known${known ? '' : ' hidden'}>`
    + settingRow({ label: a.label, note: a.note, control: a.control(a.address) }) + `</div>`
    + `<div data-machine-unknown${known ? ' hidden' : ''}>${needsAddress(t, a.label)}</div></div>`
}

/**
 * `base` is the absolute address, or `''` when the blog's own address is not known; `fallback` is
 * `SITE_URL`'s origin, for the island when a save empties the setting.
 */
export function apiCard(t: AdminStrings, s: SiteSettings, base: string, fallback = ''): string {
  const live = s.api.enabled
  const address = machineAddress(t, {
    label: t.apiUrlLabel, note: t.apiUrlHint, path: '/api/v1', address: base, fallback,
    control: (shown) => `<div class="flex items-center gap-2">`
      + `<code class="${COPY_BOX} bg-neutral-50 dark:bg-neutral-900" data-api-url>`
      + `${escapeHtml(shown)}</code>`
      + `<button type="button" data-api-copy class="${buttonClass('secondary', 'sm')}">`
      + `${escapeHtml(t.mcpCopy)}</button></div>`,
  })
  return connectionCard({
    title: t.cardApi,
    keys: ['api'],
    state: live ? 'good' : 'off',
    lampTitle: live ? t.connectionOn : t.connectionOff,
    // ⚠️ THE WARNING SITS ABOVE THE ADDRESS AND OUTSIDE EVERYTHING, because it is what somebody
    // needs in order to DECIDE: a caution that appears only once the thing is already on is a
    // caution nobody read in time.
    //
    // `META` rather than `NOTE_TEXT`, which carries `admin-note` — the handle one rule in
    // `admin.css` uses to hide every explanation on this screen at once. This sentence says the
    // endpoint has no key, which is not an explanation somebody may choose to switch off. Same
    // reasoning as the AI card's status line and `NOTE_ALERT`; the ink stays neutral because
    // nothing here is broken or waiting to be acted on.
    body: panelList(`<div>`
      + switchRow({ k: 'api.enabled', label: t.apiEnable, note: t.apiEnableDesc, on: live })
      + `<div class="border-t border-neutral-200 p-4 dark:border-neutral-800">`
      + `<p class="${META}">${escapeHtml(t.apiReadOnly)}</p></div>`
      + `<div class="border-t border-neutral-200 p-4 dark:border-neutral-800">${address}</div>`
      + `</div>`),
  })
}
