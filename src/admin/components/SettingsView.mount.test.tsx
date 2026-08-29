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
  it('shows all eight tabs and opens on Site', async () => {
    const { mountAdmin, installFetchMock } = await import('@/admin/test-mount')
    const { SettingsView } = await import('@/admin/components/SettingsView')
    const { adminT } = await import('@/i18n/admin-i18n')
    const t = adminT('en')
    const fetchMock = installFetchMock(() => ({ success: true }))
    trackMock(fetchMock.restore)

    const m = await mountAdmin(<SettingsView {...payload()} />)
    for (const label of [
      t.tabSite, t.tabLayout, t.tabReading, t.tabAppearance,
      t.tabSeo, t.tabConnections, t.tabAi, t.tabSystem,
    ]) expect(m.button(label)).toBeTruthy()
    // The Site tab's card is on screen; a card from another tab is not.
    expect(m.text()).toContain(t.cardGeneral)
    expect(m.text()).not.toContain(t.cardLayout)
    // Rendering asked the server for nothing: every prop arrived through the view payload.
    expect(fetchMock.calls.length).toBe(0)
    await m.unmount()
  })

  it('switching to Layout swaps the cards', async () => {
    const { mountAdmin, installFetchMock } = await import('@/admin/test-mount')
    const { SettingsView } = await import('@/admin/components/SettingsView')
    const { adminT } = await import('@/i18n/admin-i18n')
    const t = adminT('en')
    const fetchMock = installFetchMock(() => ({ success: true }))
    trackMock(fetchMock.restore)

    const m = await mountAdmin(<SettingsView {...payload()} />)
    await m.click(m.button(t.tabLayout))
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
    await m.click(m.button(t.saveSettings))
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
    await m.click(m.button(t.saveSettings))
    await m.flush()
    expect(m.text()).toContain(t.saveFailed)
    expect((title as HTMLInputElement).value).toBe('Unsaved edit')
    await m.unmount()
  })
})
