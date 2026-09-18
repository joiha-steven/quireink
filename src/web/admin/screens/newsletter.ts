// The newsletter, as HTML the server sends (ADR 0054).
//
// THREE TABS OVER ONE AUDIENCE: who is on the list and what they have been sent; which posts
// to mail and the exact email that will go; and the three sample sends that answer "did the
// SMTP settings actually work". All three ship drawn and an attribute picks one, the way the
// trash ships its seven kinds.
//
// ⚠️ THE TAB IS IN THE ADDRESS NOW, and it was not in the React face, which always opened on
// People and forgot where you were on a reload. A server-drawn screen has to be told which
// panel to open before it draws anything, and once the server is reading `?tab=` there is no
// reason for the address to lie about where you are. Same rule as the trash: `replaceState`,
// so Back leaves the newsletter rather than walking the three tabs you clicked through.
//
// ⚠️ NOTHING ON THIS SCREEN IS A FORM. See `newsletter-send.ts` for why that is a safety rule.
import type { SiteSettings } from '@/types'
import type { AdminStrings } from '@/i18n/admin-i18n'
import { adminT } from '@/i18n/admin-i18n'
import { escapeAttr, escapeHtml } from '@/utils'
import { SHEET_FOOT, SHEET_TOOL_ON_CANVAS } from '@/admin-shared/kit'
import { pageHeader, pager, sheet, sheetTop, tabs } from '@/web/admin/kit'
import { newsletterView, subscribersView } from '@/web/admin/views-news'
import { peoplePanel } from '@/web/admin/screens/newsletter-people'
import { sendPanel, testPanel } from '@/web/admin/screens/newsletter-send'

const TABS = ['people', 'send', 'test'] as const
type Tab = (typeof TABS)[number]

const openTab = (query: URLSearchParams): Tab => {
  const asked = query.get('tab')
  return TABS.find((k) => k === asked) ?? 'people'
}

/**
 * The words the island can need to SAY, and only those.
 *
 * Every other string on this screen is already written into the markup above it. `{n}`, `{s}`,
 * `{sent}`, `{total}` and `{to}` stay unreplaced: which count, which second and which address
 * depend on what was ticked and what came back.
 */
function words(t: AdminStrings): string {
  return escapeAttr(JSON.stringify({
    digest: t.nlDigestHint, already: t.nlAlreadySent,
    armed: t.nlArmed, send: t.nlSendButton, going: t.nlSendGoing, loading: t.loading,
    sendDone: t.nlSendDone, sendFailed: t.nlSendFailed,
    previewEmpty: t.nlPreviewEmpty, previewFailed: t.nlPreviewFailed,
    testSent: t.nlTestSent, testFailed: t.nlTestFailed,
    deleteFailed: t.deleteFailed, showing: t.nlShowing,
  }))
}

export async function newsletterScreen(settings: SiteSettings, query: URLSearchParams): Promise<string> {
  const t = adminT(settings.language)
  const open = openTab(query)
  const [letter, people] = await Promise.all([
    newsletterView(), subscribersView(Number(query.get('page') ?? '1')),
  ])

  const strip = tabs({
    items: [
      { key: 'people', label: t.nlTabPeople },
      { key: 'send', label: t.nlTabSend },
      { key: 'test', label: t.nlTabTest },
    ],
    value: open,
    attrs: 'data-nl-tabs',
  })

  // ONE banner, not one per tab: nothing on this page can send without SMTP. `{tab}` is the
  // one substitution the server can make here, because which tab it names never changes.
  const warning = letter.mailConfigured ? '' : `<p class="border-b border-neutral-100 bg-neutral-50 px-5 py-2.5`
    + ` text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-400">`
    + `${escapeHtml(t.nlNoSmtpWarning.replace('{tab}', t.tabPeople))}</p>`

  const link = `<a href="/admin/settings?tab=people" class="${SHEET_TOOL_ON_CANVAS}">`
    + `${escapeHtml(t.nlSmtpSettingsLink)} →</a>`

  return `<div data-screen="newsletter" data-nl-tab="${escapeAttr(open)}"`
    + ` data-lang="${escapeAttr(settings.language)}" data-nl-words="${words(t)}">`
    + pageHeader({ title: t.navNewsletter, actions: link })
    + sheet(sheetTop(strip) + warning
      + peoplePanel(t, settings.language, people, open === 'people',
        pager(t, '/admin/newsletter', 'people', people.at, people.pages))
      + sendPanel(t, letter.posts, open === 'send')
      + testPanel(t, open === 'test')
      + `<div class="${SHEET_FOOT}">${escapeHtml(t.nlPageHint)}</div>`)
    + `</div>`
}
