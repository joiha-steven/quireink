// THE CONTENT API CARD, FROM ITS MARKUP TO THE CLIPBOARD.
//
// ⚠️ THIS TESTS THE JOIN, which is the half nothing else can see. `check:admin-wired` proves the
// hook is MENTIONED by some island file; it cannot prove that the function mentioning it is ever
// CALLED. Between those two facts sits a control that is drawn, labelled, pressable and inert —
// the exact shape of the eight dead keys found on 2026-09-15, and of the `<select>` that took
// the owner's answer and saved nothing four days ago.
//
// So it goes through `wireLists`, the hub the settings screen actually calls, rather than
// through `wireApi` directly. Deleting the one line that calls it turns this red.
import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { adminT } from '@/i18n/admin-i18n'
import { freshDatabase, dropDatabase } from '@/test/db'
import { getSettings } from '@/content/settings'
import { apiCard } from '@/web/admin/screens/settings-server-api'
import { wireLists } from './lib/settings-lists'

const DIR = './.tmp/test-settings-api'
freshDatabase(DIR)
beforeAll(() => GlobalRegistrator.register())
afterAll(() => { GlobalRegistrator.unregister(); dropDatabase(DIR) })

const t = adminT('en')
const BASE = 'https://blog.example/api/v1'
let settings: Awaited<ReturnType<typeof getSettings>>
let screen: HTMLElement
let written: string[]

const draw = (enabled: boolean): void => {
  document.body.innerHTML = apiCard(t, { ...settings, api: { enabled } }, BASE)
  screen = document.body.querySelector<HTMLElement>('[data-card]')!
}

beforeAll(async () => { settings = await getSettings() })

beforeEach(() => {
  written = []
  // happy-dom has no clipboard, and a real one would need a secure context anyway. What is
  // under test is WHICH STRING is handed over, so the hand is the seam.
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: (text: string) => { written.push(text); return Promise.resolve() } },
  })
  draw(true)
})

describe('the copy key', () => {
  it('puts the address the SERVER printed on the clipboard', async () => {
    wireLists(screen, { apiUrlCopied: 'copied' })
    screen.querySelector<HTMLElement>('[data-api-copy]')!.click()
    await Promise.resolve()
    // ⚠️ THE SERVER'S STRING, not one the island built. `resolveSiteUrl` can answer from an
    // environment variable no page can read, so an island composing `location.origin + '/api/v1'`
    // hands out the hostname the ADMIN was reached on — which on any install behind a proxy
    // under a second name is an address that answers nothing.
    expect(written).toEqual([BASE])
  })

  it('does nothing when something else on the card is clicked', () => {
    // The counter-test: a delegated listener that answers every click would pass the case above
    // while copying on the switch, on the card, on the note.
    wireLists(screen, { apiUrlCopied: 'copied' })
    screen.querySelector<HTMLElement>('[data-switch]')!.click()
    screen.click()
    expect(written).toEqual([])
  })

  it('is inert until the screen is wired, which is what the case above proves is not the case', () => {
    // Drawn but unwired: pressing it does nothing at all. This is the state eight controls
    // shipped in, and it is what the first test here would look like if the call site were
    // dropped from `wireLists`.
    screen.querySelector<HTMLElement>('[data-api-copy]')!.click()
    expect(written).toEqual([])
  })
})

describe('the card itself', () => {
  it('has NO Save key of its own, because it does not try anything', () => {
    // ⚠️ A card's own Save is for a card that can reach the far end (`fields-box.ts`), and the
    // first cut of this one copied MCP's. Two things followed: a second Save key three inches
    // from the screen's, and — because `applyLiveGates` runs only on the card-save path — an
    // address block that would have opened on the next page load rather than on the save. The
    // screen's Save stores `api.enabled` like every other field.
    expect(screen.querySelector('[data-card-save]')).toBeNull()
    expect(screen.dataset.cardKeys).toBe('api')
  })

  it('shows the address whether the switch is on or off', () => {
    // Not hidden behind a gate: it is a fixed, documented path with a switch directly above it
    // saying whether anything answers there. The counter-test below is what a gate would be FOR.
    draw(false)
    expect(screen.querySelector<HTMLElement>('[data-api-url]')!.textContent).toBe(BASE)
    expect(screen.querySelector('[data-gate-live]')).toBeNull()
    draw(true)
    expect(screen.querySelector<HTMLElement>('[data-api-url]')!.textContent).toBe(BASE)
  })

  it('says it is read-only and keyless before the switch is ever touched', () => {
    // The whole point of the warning: it is what somebody needs in order to DECIDE. A caution
    // that appears only once the thing is on is a caution nobody read in time.
    draw(false)
    expect(screen.textContent).toContain(t.apiReadOnly)
    // ⚠️ AND IT SURVIVES `[data-explanations=off]`. `NOTE_TEXT` carries `admin-note`, the handle
    // one rule in `admin.css` uses to quiet every explanation on this screen at once — so an
    // owner who had switched the explanations off would be offered this door with the sentence
    // "there is no key" removed. It is `META`, which that rule does not touch.
    const note = [...screen.querySelectorAll('p')].find((el) => el.textContent === t.apiReadOnly)!
    expect(note.className).not.toContain('admin-note')
  })

  it('draws the lamp off while the setting is off, and on once it is stored', () => {
    draw(false)
    expect(screen.querySelector<HTMLElement>('[data-card-lamp]')!.dataset.lampRest).toBe('off')
    draw(true)
    expect(screen.querySelector<HTMLElement>('[data-card-lamp]')!.dataset.lampRest).toBe('good')
  })
})
