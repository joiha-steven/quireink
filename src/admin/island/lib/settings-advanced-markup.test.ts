// THE ADVANCED BAND ON THE SERVER TAB, asserted on the markup the screen actually sends.
//
// What is folded is a list of cards a writer never needs (`settings-server.ts`); what may NOT
// happen is a card moving there that an owner does need, the band shipping open, or the band
// hiding a card that is asking for attention. And the line each tab used to print under the
// strip is gone (ADR 0073), leaving the explanations switch alone on its row.
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { freshDatabase, dropDatabase } from '@/test/db'
import { getSettings } from '@/content/settings'
import { saveIntegrationKeys } from '@/store/integration-keys'
import { adminT } from '@/i18n/admin-i18n'
import { SETTINGS_INDEX } from '@/admin-shared/settings-index'
import { TAB_IDS } from '@/admin-shared/settings-tabs'
import { settingsScreen } from '@/web/admin/screens/settings'

const DIR = './.tmp/test-settings-advanced-markup'
freshDatabase(DIR)
beforeAll(() => GlobalRegistrator.register())
afterAll(async () => { await GlobalRegistrator.unregister(); dropDatabase(DIR) })

/** The whole screen, drawn against real settings, parsed. */
async function drawn(): Promise<HTMLElement> {
  document.body.innerHTML = await settingsScreen(await getSettings(), new URLSearchParams('tab=server'))
  return document.querySelector<HTMLElement>('[data-screen="settings"]')!
}

/** Where each card the tab draws lives: inside the band, or above it. Found by its own hook. */
const CARDS = {
  advanced: {
    'crawlers and feeds': '[data-k="seo.sitemap"]',
    'custom code': '[data-k="customHead"]',
    'MCP server': '[data-k="mcp.enabled"]',
    'Content API': '[data-k="api.enabled"]',
    'Cloudflare cache': '[data-card-route="/api/integrations/cloudflare"]',
    'Run on Cloudflare': '[data-cf-card], [data-cf-live]',
    redirects: '[data-redirect-list]',
  },
  owner: {
    cache: '[data-k="cache.enabled"]',
    updates: '[data-k="updateCheck"]',
    'storage limits': '[data-k="maxUploadMb"]',
    backups: '[data-k="backups.enabled"]',
    'off-server copy': '[data-card-route="/api/integrations/s3"]',
    import: '[data-import-file]',
    'AI key': '[data-card-route="/api/integrations/ai"]',
    fediverse: '[data-k="activitypub.enabled"]',
  },
}

describe('the Server tab folds its developer cards', () => {
  it('puts every developer card in the band and every owner card above it', async () => {
    const screen = await drawn()
    const panel = screen.querySelector('[data-settings-panel="server"]')!
    const band = panel.querySelector('[data-advanced-body]')!
    expect(panel.querySelectorAll('[data-advanced]').length).toBe(1)
    for (const [name, sel] of Object.entries(CARDS.advanced)) {
      expect({ name, inBand: band.querySelector(sel) !== null }).toEqual({ name, inBand: true })
    }
    for (const [name, sel] of Object.entries(CARDS.owner)) {
      const el = panel.querySelector(sel)
      expect({ name, drawn: el !== null, inBand: band.contains(el) }).toEqual({ name, drawn: true, inBand: false })
    }
  })

  it('ships the band shut, with one key that names what it controls and what is inside', async () => {
    const screen = await drawn()
    const key = screen.querySelector<HTMLElement>('[data-advanced-toggle]')!
    const body = screen.querySelector<HTMLElement>('[data-advanced-body]')!
    expect(body.hidden).toBe(true)
    expect(key.getAttribute('type')).toBe('button')
    expect(key.getAttribute('aria-expanded')).toBe('false')
    expect(key.getAttribute('aria-controls')).toBe(body.id)
    const hint = document.getElementById(key.getAttribute('aria-describedby')!)!
    expect(hint.textContent).toBe(adminT('en').serverAdvancedHint)
    // Exempt from "hide explanations": it is the only thing saying what the key hides.
    expect(hint.classList.contains('tab-hint')).toBe(true)
  })

  it('keeps the two-column grid inside the band', async () => {
    const screen = await drawn()
    const grid = screen.querySelector('[data-advanced-body] > .grid')!
    expect(grid.classList.contains('xl:grid-cols-2')).toBe(true)
    expect(grid.children.length).toBe(2)
    for (const col of grid.children) expect(col.children.length).toBeGreaterThan(0)
  })

  it('draws every settings key it folds, so the sheet can still count and send them', async () => {
    const screen = await drawn()
    const keys = [...screen.querySelectorAll<HTMLElement>('[data-advanced-body] [data-k]')].map((el) => el.dataset.k)
    for (const k of ['seo.autoSchema', 'seo.sitemap', 'seo.rss', 'seo.llms', 'seo.robots', 'seo.ogImage',
      'seo.ogFallbackImage', 'customHead', 'customBodyEnd', 'mcp.enabled', 'api.enabled']) {
      expect(keys).toContain(k)
    }
  })
})

describe('the count on the key does not cry wolf', () => {
  const count = (screen: HTMLElement) => screen.querySelector<HTMLElement>('[data-advanced-count]')!

  // Every card in the band is optional: an unconfigured Cloudflare is how a fresh blog looks,
  // not a problem. The island counts failed tests and unsaved edits (settings-advanced.test.ts).
  it('ships hidden on a seeded blog with nothing set up in the band', async () => {
    await saveIntegrationKeys({ cloudflareApiToken: '', cloudflareZoneId: '' })
    const screen = await drawn()
    expect(screen.querySelector('[data-advanced-body] [data-lamp-rest="attention"]')).not.toBeNull()
    expect(count(screen).hidden).toBe(true)
    // When it does show, it wears the amber of the lamp vocabulary, not a new colour.
    expect(count(screen).querySelector('.bg-amber-500')).not.toBeNull()
  })
})

describe('the line under the tab strip is gone (ADR 0073)', () => {
  it('prints no tab sentence on any panel, and leaves the switch alone on its row', async () => {
    const screen = await drawn()
    const t = adminT('en')
    for (const hint of [t.tabBlogHint, t.tabHomeHint, t.tabPostHint, t.tabAppearanceHint,
      t.tabPeopleHint, t.tabServerHint, t.tabAccountHint]) {
      expect(screen.innerHTML).not.toContain(hint)
    }
    const rows = [...screen.querySelectorAll<HTMLElement>('[data-notes-row]')]
    expect(rows.map((r) => r.dataset.notesRow)).toEqual([...TAB_IDS])
    for (const row of rows) {
      expect(row.children.length).toBe(1)
      expect(row.children[0]!.hasAttribute('data-notes-toggle')).toBe(true)
    }
  })
})

describe('?setting= has something to land on', () => {
  it('names every search row by its dictionary key', async () => {
    const screen = await drawn()
    const named = [...screen.querySelectorAll<HTMLElement>('[data-found]')].map((r) => r.dataset.setting)
    expect(named).toEqual(SETTINGS_INDEX.map((e) => e.label))
  })
})
