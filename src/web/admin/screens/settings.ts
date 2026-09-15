// Settings, as HTML the server sends (ADR 0054) — the last screen before the editor.
//
// ⚠️ ALL SEVEN PANELS SHIP DRAWN, and here that is load-bearing rather than tidy. The Save key
// stores the WHOLE form: an owner changes the blog's name on one tab, the front page's shape on
// another and a palette on a third, and presses Save once. Drawing one tab and navigating
// between them would make every switch a page load, and a page load with unsaved work either
// loses it or raises the browser's own two-button warning — on the one screen in this admin
// where leaving without saving throws work away.
//
// ⚠️ NOTHING HERE IS A FORM, and every button says `type="button"`. This screen drives the most
// dangerous routes in the admin — the password, the recovery codes, the second factor, MCP
// tokens, backups, imports, a CDN purge — and `ui/Button` emits a button with no type, which
// HTML reads as submit. `settings-safety.test.ts` asserts the shape on the rendered markup.
//
// ⚠️ NO SECRET IS EVER IN THE PAGE. `getIntegrationStatus()` turns every stored credential into
// a boolean; a credential field ships EMPTY with a placeholder saying one is stored, because
// sending the dots back would store the dots.
import type { SiteSettings } from '@/types'
import type { AdminStrings } from '@/i18n/admin-i18n'
import { adminT } from '@/i18n/admin-i18n'
import { escapeAttr } from '@/utils'
import { resolveTab, type Tab } from '@/admin-shared/settings-tabs'
import { pageHeader } from '@/web/admin/kit'
import { settingsView } from '@/web/admin/views'
import { panel, sheetAround } from '@/web/admin/screens/settings-shell'
import { blogTab } from '@/web/admin/screens/settings-blog'
import { homeTab } from '@/web/admin/screens/settings-home'
import { postTab } from '@/web/admin/screens/settings-post'
import { appearanceTab } from '@/web/admin/screens/settings-appearance'
import { peopleTab } from '@/web/admin/screens/settings-people'
import { serverTab } from '@/web/admin/screens/settings-server'
import { accountTab } from '@/web/admin/screens/settings-account'
import { getRedirects } from '@/server/redirects'

/**
 * The words the island can need to SAY, and only those.
 *
 * Every label on seven tabs is already in the markup above it. What is here is the handful that
 * depend on something the server could not know: how many changes are waiting, what time a save
 * landed, and the four sentences of the question asked when somebody leaves with work unsaved.
 * `{n}` stays unreplaced — which count depends on what was touched.
 */
function words(t: AdminStrings): string {
  return escapeAttr(JSON.stringify({
    save: t.saveSettings, saveCount: t.saveSettingsCount, saving: t.saving,
    savedAt: t.savedAtPrefix, saved: t.savedSettings, failed: t.saveFailed,
    listTaken: t.listPathTaken,
    leaveTitle: t.leaveUnsavedTitle, leaveBody: t.leaveUnsavedBody,
    leaveSave: t.leaveUnsavedSave, leaveDiscard: t.leaveUnsavedDiscard, leaveStay: t.leaveUnsavedStay,
    connectionOk: t.connectionOk, connectionBad: t.connectionFailed, connectionDirty: t.connectionUnsaved,
    // The SMTP card fills itself from `/api/mail`, and both of these are facts only that reply
    // carries: whether the far end has credentials, and whether there is anything to try.
    connectionOff: t.connectionOff, connectionUntested: t.connectionUntested,
    mailSwitchedOff: t.mailSwitchedOff,
    saveAndTest: t.saveAndTest,
    saveFailed: t.saveFailed,
    // The picker opens over this screen and carries no dictionary of its own.
    pickTitle: t.mediaTitle, pickTitleMulti: t.galleryPickTitle, pickHint: t.galleryPickHint,
    pickAdd: t.galleryAdd, close: t.close, loadFailed: t.loadMediaFailed,
    copyUrl: t.copyUrl, download: t.download, delete: t.delete, unusedBadge: t.unusedBadge,
    // An icon goes straight to the files store, and says so when it lands.
    uploaded: t.uploaded, uploadFailed: t.uploadFailed, loading: t.loading,
    // The three lists, and the one of them that deletes.
    never: t.mcpNeverUsed, deleted: t.movedToTrash, deleteFailed: t.deleteFailed,
    // The account's four flows report what they did; the server's REFUSALS ride on the card
    // itself, because each belongs to the control that can provoke it.
    passwordChanged: t.securityPasswordChanged, signedOut: t.securitySignedOut,
    totpDone: t.securityTotpDone,
  }))
}

type View = Awaited<ReturnType<typeof settingsView>>

type Extra = { redirects: Awaited<ReturnType<typeof getRedirects>>; origin: string }

/** The seven panels, in the order the strip shows them. */
function panels(t: AdminStrings, s: SiteSettings, view: View, extra: Extra, open: Tab): string {
  return panel('blog', t, blogTab(t, s), open)
    + panel('home', t, homeTab(t, s, {
      posts: view.posts, pages: view.pages, categories: view.categories,
    }), open)
    + panel('post', t, postTab(t, s), open)
    + panel('appearance', t, appearanceTab(t, s, { presets: view.presets }), open)
    + panel('people', t, peopleTab(t, s, { commentEnv: view.commentEnv }), open)
    + panel('server', t, serverTab(t, s, {
      integrations: view.integrations, update: view.update,
      redirects: extra.redirects, origin: extra.origin,
    }), open)
    + panel('account', t, accountTab(t, s), open)
}

export async function settingsScreen(settings: SiteSettings, query: URLSearchParams): Promise<string> {
  const t = adminT(settings.language)
  const open = resolveTab(query.get('tab'))
  // The redirects are the one list on this screen the server can read and React fetched; they
  // ride along rather than opening a round trip the page does not need.
  const [view, redirects] = await Promise.all([settingsView(), getRedirects()])
  // With no site address set the server derives one from the environment, which no page can
  // read — React fell back to `window.location.origin` for that reason.
  const origin = settings.siteUrl || ''

  return `<div data-screen="settings" data-settings-tab="${escapeAttr(open)}"`
    + ` data-lang="${escapeAttr(settings.language)}" data-settings-words="${words(t)}">`
    + pageHeader({ title: t.settingsTitle })
    + sheetAround(t, open, panels(t, view.settings, view, { redirects, origin }, open))
    + `</div>`
}
