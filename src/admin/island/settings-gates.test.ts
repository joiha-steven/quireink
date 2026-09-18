// THE BLOCKS THAT WAIT FOR A SAVED ANSWER.
//
// `data-gate` follows the switch the instant it moves. `data-gate-live` follows the RECORD, and
// the MCP card explains at length why the difference is load-bearing: its Save writes the
// setting, so the endpoint stays shut until the key is pressed, and opening the address block on
// the flip handed out a URL and a freshly minted token for a door that still answered 404.
//
// ⚠️ IT WAS DRAWN TWICE AND READ BY NOBODY. The hook shipped with the conversion and no island
// ever looked at it, so the other half never happened either: after the owner switched the
// server on and saved, the address and the "mint a token" key were simply absent until the page
// was reloaded. The card's comment described behaviour that did not exist.
//
// The CALL SITE is held by `scripts/checks/admin-wired.ts`, which fails on a hook nothing reads.
// What is held here is what the function does once it is called.
import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { adminT } from '@/i18n/admin-i18n'
import { freshDatabase, dropDatabase } from '@/test/db'
import { getSettings } from '@/content/settings'
import { mcpCard } from '@/web/admin/screens/settings-server-mcp'
import { applyGates, applyLiveGates } from './lib/settings-controls'

const DIR = './.tmp/test-gates'
freshDatabase(DIR)
beforeAll(() => GlobalRegistrator.register())
afterAll(() => { GlobalRegistrator.unregister(); dropDatabase(DIR) })

const t = adminT('en')
let card: HTMLElement
let base: Awaited<ReturnType<typeof getSettings>>

const draw = (enabled: boolean): void => {
  document.body.innerHTML = mcpCard(t, { ...base, mcp: { ...base.mcp, enabled } }, 'https://example.com/api/mcp')
  card = document.body.querySelector<HTMLElement>('[data-card]')!
}

const gated = (): boolean[] =>
  [...card.querySelectorAll<HTMLElement>('[data-gate-live]')].map((el) => el.hidden)

const flip = (on: boolean): void => {
  const sw = card.querySelector<HTMLElement>('[data-switch][data-k="mcp.enabled"]')!
  sw.setAttribute('aria-checked', String(on))
}

beforeAll(async () => { base = await getSettings() })
beforeEach(() => draw(false))

describe('a block gated on the saved answer', () => {
  it('arrives shut when the setting is off, and open when it is on', () => {
    expect(gated()).toEqual([true, true])
    draw(true)
    expect(gated()).toEqual([false, false])
  })

  it('does NOT open when the switch moves, which is the whole point of the hook', () => {
    flip(true)
    applyGates(card)
    expect(gated()).toEqual([true, true])
  })

  it('opens when the card has saved, because then the form IS the record', () => {
    flip(true)
    applyLiveGates(card)
    expect(gated()).toEqual([false, false])
  })

  it('shuts again when the switch goes off and that is saved', () => {
    draw(true)
    flip(false)
    applyLiveGates(card)
    expect(gated()).toEqual([true, true])
  })
})
