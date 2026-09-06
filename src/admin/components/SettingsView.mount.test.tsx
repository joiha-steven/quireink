// The settings screen's own mechanics: the tabs are all there, switching one swaps the cards,
// Save PUTs what was edited, and a rejected save keeps the edit on screen.
//
// The per-card groups live in `SettingsView.cards.test.tsx`, split off on 2026-08-29 when the
// Tables group put this file over the 400-line cap. The fixture and the helpers are shared,
// in `settings-fixture.tsx`, whose header records why the settings object is hand-built out
// of the pure-data modules instead of imported from the view layer.

import { describe, expect, it, beforeAll, afterAll, afterEach } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import type { SiteSettings } from '@/types'
import { payload, releaseMocks, settingsFixture, trackMock } from './settings-fixture'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())
afterEach(releaseMocks)

describe('SettingsView, mounted', () => {
  it('shows all seven tabs and opens on Blog', async () => {
    const { mountAdmin, installFetchMock } = await import('@/admin/test-mount')
    const { SettingsView } = await import('@/admin/components/SettingsView')
    const { adminT } = await import('@/i18n/admin-i18n')
    const t = adminT('en')
    const fetchMock = installFetchMock(() => ({ success: true }))
    trackMock(fetchMock.restore)

    const m = await mountAdmin(<SettingsView {...payload()} />)
    for (const label of [
      t.tabBlog, t.tabHome, t.tabPost, t.tabAppearance,
      t.tabPeople, t.tabServer, t.tabAccount,
    ]) expect(m.button(label)).toBeTruthy()
    // The Blog tab's card is on screen; a card from another tab is not.
    expect(m.text()).toContain(t.cardGeneral)
    expect(m.text()).not.toContain(t.cardLayout)
    // Rendering asked the server for nothing: every prop arrived through the view payload.
    expect(fetchMock.calls.length).toBe(0)
    await m.unmount()
  })

  it('switching to Home & menu swaps the cards', async () => {
    const { mountAdmin, installFetchMock } = await import('@/admin/test-mount')
    const { SettingsView } = await import('@/admin/components/SettingsView')
    const { adminT } = await import('@/i18n/admin-i18n')
    const t = adminT('en')
    const fetchMock = installFetchMock(() => ({ success: true }))
    trackMock(fetchMock.restore)

    const m = await mountAdmin(<SettingsView {...payload()} />)
    await m.click(m.button(t.tabHome))
    expect(m.text()).toContain(t.cardLayout)
    expect(m.text()).not.toContain(t.cardGeneral)
    await m.unmount()
  })

  it('editing the title and saving PUTs the edited value to /api/settings', async () => {
    const { mountAdmin, installFetchMock } = await import('@/admin/test-mount')
    const { SettingsView } = await import('@/admin/components/SettingsView')
    const { adminT } = await import('@/i18n/admin-i18n')
    const t = adminT('en')
    const fetchMock = installFetchMock(() => ({ success: true, data: settingsFixture() }))
    trackMock(fetchMock.restore)

    const m = await mountAdmin(<SettingsView {...payload()} />)
    // The title field is the input SiteFields renders with the product-name placeholder.
    const title = m.container.querySelector('input[placeholder="Quire Ink"]')
    expect(title).not.toBeNull()
    await m.type(title as Element, 'My Field Notes')
    // The key NAMES the work waiting on it. Since 2026-09-07 it reads "Save · 1 change(s)"
    // once the form is dirty and is disabled when it is not, so a test that clicks
    // `t.saveSettings` is clicking a label that only exists on a clean form.
    await m.click(m.button(t.saveSettingsCount.replace('{n}', '1')))
    await m.flush()

    const put = fetchMock.calls.find((c) => c.method === 'PUT' && c.url === '/api/settings')
    expect(put).toBeDefined()
    // The body is the WHOLE settings object with the one edit applied — the endpoint
    // merges, but the client always sends the full state it holds.
    const body = put?.body as SiteSettings
    expect(body.title).toBe('My Field Notes')
    expect(body.postsPerPage).toBe(10)
    expect(m.text()).toContain(t.savedSettings) // the toast — the save's only confirmation
    await m.unmount()
  })

  it('counts the changes on the save key, and refuses to save none', async () => {
    // A Save key that is always pressable answers "did I change anything?" with a shrug, and
    // pressing it wrote the same record back and printed a success toast for work nobody did.
    const { mountAdmin, installFetchMock } = await import('@/admin/test-mount')
    const { SettingsView } = await import('@/admin/components/SettingsView')
    const { adminT } = await import('@/i18n/admin-i18n')
    const t = adminT('en')
    const fetchMock = installFetchMock(() => ({ success: true, data: settingsFixture() }))
    trackMock(fetchMock.restore)

    const m = await mountAdmin(<SettingsView {...payload()} />)
    expect(m.button(t.saveSettings).disabled).toBe(true)

    const title = m.container.querySelector('input[placeholder="Quire Ink"]')
    await m.type(title as Element, 'One edit')
    const counted = m.button(t.saveSettingsCount.replace('{n}', '1'))
    expect(counted.disabled).toBe(false)

    // A SECOND field, so the count is proved to be a count and not a boolean wearing a 1.
    const perPage = m.container.querySelector('input[type=number]')
    await m.type(perPage as Element, '25')
    expect(m.button(t.saveSettingsCount.replace('{n}', '2'))).toBeDefined()
    await m.unmount()
  })

  it('renders the sheet\'s Save key on the four save-as-one tabs and on none of the others', async () => {
    // ADR 0041's load-bearing consequence. A page-level Save beside cards that own their own
    // keys is a button that silently does nothing for most of the screen, which is the
    // arrangement this regrouping replaced.
    const { mountAdmin, installFetchMock } = await import('@/admin/test-mount')
    const { SettingsView } = await import('@/admin/components/SettingsView')
    const { adminT } = await import('@/i18n/admin-i18n')
    const t = adminT('en')
    // The mail card asks for its own configuration; a list would leave it loading forever
    // and prove nothing about the tab around it.
    const fetchMock = installFetchMock((url) =>
      url.startsWith('/api/mail')
        ? { success: true, data: { host: '', port: 587, user: '', from: '', secure: false, hasPass: false, configured: false } }
        : url.startsWith('/api/backup')
          ? { success: true, data: { snapshots: [], lastRunAt: null } }
          : { success: true, data: [] })
    trackMock(fetchMock.restore)

    const m = await mountAdmin(<SettingsView {...payload()} />)
    const hasPageSave = () =>
      [...m.container.querySelectorAll('button')].some((b) => b.textContent?.trim() === t.saveSettings)

    for (const tab of [t.tabBlog, t.tabHome, t.tabPost, t.tabAppearance]) {
      await m.click(m.button(tab))
      expect(hasPageSave()).toBe(true)
    }
    for (const tab of [t.tabPeople, t.tabServer, t.tabAccount]) {
      await m.click(m.button(tab))
      await m.flush()
      expect(hasPageSave()).toBe(false)
    }
    await m.unmount()
  })

  it('leaves the admin in its own language until the new one is stored', async () => {
    // Choosing a language used to re-letter the whole admin on `change`, before anything was
    // saved: trying Vietnamese out handed somebody a Vietnamese admin, an unsaved form and a
    // Save key to find in a language they had not chosen. The note under the field says the
    // two disagree; the interface itself waits for the server.
    const { mountAdmin, installFetchMock } = await import('@/admin/test-mount')
    const { SettingsView } = await import('@/admin/components/SettingsView')
    const { adminT } = await import('@/i18n/admin-i18n')
    const t = adminT('en')
    const fetchMock = installFetchMock(() => ({ success: true, data: settingsFixture() }))
    trackMock(fetchMock.restore)

    const m = await mountAdmin(<SettingsView {...payload()} />)
    const picker = m.container.querySelector('select[aria-label="' + t.siteLanguage + '"]')
    expect(picker).not.toBeNull()
    await m.type(picker as Element, 'vi')
    await m.flush()

    // Still English, and the field says why.
    expect(m.text()).toContain(t.cardGeneral)
    expect(m.text()).toContain(t.siteLanguageOnSave)
    await m.unmount()
  })

  it('a rejected save reports failure and keeps the edit on screen', async () => {
    const { mountAdmin, installFetchMock } = await import('@/admin/test-mount')
    const { SettingsView } = await import('@/admin/components/SettingsView')
    const { adminT } = await import('@/i18n/admin-i18n')
    const t = adminT('en')
    const fetchMock = installFetchMock(() => ({ success: false, error: 'nope' }))
    trackMock(fetchMock.restore)

    const m = await mountAdmin(<SettingsView {...payload()} />)
    const title = m.container.querySelector('input[placeholder="Quire Ink"]')
    await m.type(title as Element, 'Unsaved edit')
    await m.click(m.button(t.saveSettingsCount.replace('{n}', '1')))
    await m.flush()
    expect(m.text()).toContain(t.saveFailed)
    expect((title as HTMLInputElement).value).toBe('Unsaved edit')
    await m.unmount()
  })
})
