// WHAT THE SHEET'S SAVE DOES WITH THE SERVER'S ANSWER (`lib/settings-save.ts`).
//
// Three things it did not do until 2026-10-08, each measured in a browser first:
// - the MCP address and token manager wait for a SAVED switch (`data-gate-live`), and only a
//   card's own Save opened them; the MCP card has none, so they stayed shut until a reload;
// - a refused address came back as the generic "Could not save", nowhere near the field;
// - an address the save keeps as its origin went on showing what was typed.
//
// Real server markup for the cards, a stubbed `fetch` for the route.
import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { adminT } from '@/i18n/admin-i18n'
import { DEFAULT_SETTINGS } from '@/content/settings'
import { mcpCard } from '@/web/admin/screens/settings-server-mcp'
import { apiCard } from '@/web/admin/screens/settings-server-api'
import { textField } from '@/web/admin/fields'
import { wireSave } from './lib/settings-save'
import { wireFieldChecks } from './lib/field-check'

beforeAll(() => {
  GlobalRegistrator.register()
  window.addEventListener('quire:toast', (e) => toasts.push((e as CustomEvent).detail))
})
afterAll(() => GlobalRegistrator.unregister())

const toasts: { message: string; kind?: string }[] = []
const t = adminT('en')
const s = DEFAULT_SETTINGS
const WORDS = { saved: 'saved', failed: 'failed', fieldUrl: 'not an address', fieldInvalid: 'unusable' }

let screen: HTMLElement
let answer: { status: number; body: unknown }

beforeEach(() => {
  toasts.length = 0
  document.body.innerHTML = `<div data-screen="settings"><button data-settings-save></button>`
    + `<div data-settings-panels>`
    + textField({ k: 'siteUrl', label: 'Site address', type: 'url', value: '' })
    + mcpCard(t, s, 'https://example.test/api/mcp')
    + `</div></div>`
  screen = document.querySelector<HTMLElement>('[data-screen]')!
  answer = { status: 200, body: { success: true, data: s } }
  globalThis.fetch = (() => Promise.resolve(new Response(JSON.stringify(answer.body), {
    status: answer.status, headers: { 'content-type': 'application/json' },
  }))) as unknown as typeof fetch
})

const gated = (): boolean[] =>
  [...screen.querySelectorAll<HTMLElement>('[data-gate-live="mcp.enabled"]')].map((el) => el.hidden)

const flipMcp = (): void => {
  screen.querySelector<HTMLElement>('[data-switch][data-k="mcp.enabled"]')!.setAttribute('aria-checked', 'true')
}

const typeAddress = (v: string): HTMLInputElement => {
  const f = screen.querySelector<HTMLInputElement>('[data-k="siteUrl"]')!
  f.value = v
  return f
}

describe('the MCP blocks that wait for a saved switch', () => {
  it('open when the SHEET saves the switch on, with no reload', async () => {
    const form = wireSave(screen, WORDS)
    expect(gated()).toEqual([true, true])
    flipMcp()
    answer.body = { success: true, data: { ...s, mcp: { ...s.mcp, enabled: true } } }
    expect(await form.save()).toBe(true)
    expect(gated()).toEqual([false, false])
  })

  it('stay shut when that save is refused', async () => {
    const form = wireSave(screen, WORDS)
    flipMcp()
    answer = { status: 500, body: { success: false, error: 'boom' } }
    expect(await form.save()).toBe(false)
    expect(gated()).toEqual([true, true])
  })
})

describe('a field the server refuses by name', () => {
  it('gets its sentence UNDER the field, not only in a toast, and is not reported saved', async () => {
    const form = wireSave(screen, WORDS)
    const f = typeAddress('not a url')
    answer = { status: 400, body: { success: false, error: 'field_url: siteUrl' } }
    expect(await form.save()).toBe(false)
    const slot = screen.querySelector<HTMLElement>('[data-field-check="siteUrl"]')!
    expect(slot.hidden).toBe(false)
    expect(slot.textContent).toBe('not an address')
    expect(f.getAttribute('aria-invalid')).toBe('true')
    expect(toasts).toEqual([{ message: 'not an address', kind: 'error' }])
    // Still unsaved: the count goes on saying so, and the value is what was typed.
    expect(form.count()).toBe(1)
    expect(f.value).toBe('not a url')
  })
})

describe('what the save kept', () => {
  it('is what the box shows afterwards', async () => {
    const form = wireSave(screen, WORDS)
    const f = typeAddress('https://example.org/blog/')
    answer.body = { success: true, data: { ...s, siteUrl: 'https://example.org' } }
    expect(await form.save()).toBe(true)
    expect(f.value).toBe('https://example.org')
    expect(form.count()).toBe(0)
  })
})

const visible = (sel: string): HTMLElement[] =>
  [...document.querySelectorAll<HTMLElement>(sel)].filter((el) => !el.closest('[hidden]'))

describe('the machine doors when the blog does not know its address', () => {
  it('print a note and a way to the field, never a relative path', () => {
    document.body.innerHTML = mcpCard(t, { ...s, mcp: { ...s.mcp, enabled: true } }, '') + apiCard(t, s, '')
    expect(visible('[data-mcp-url], [data-api-url]')).toEqual([])
    const notes = visible('[data-needs-address]')
    expect(notes.length).toBe(2)
    expect(notes.every((n) => n.dataset.settingsGoto === 'blog')).toBe(true)
    expect(document.body.textContent).toContain(t.machineNeedsAddress)
    // No copyable box anywhere holds a path: the descriptions may name one, a box may not.
    expect([...document.querySelectorAll('code')].some((c) => c.textContent?.includes('/api/'))).toBe(false)
  })

  it('print the absolute address when it is known', () => {
    document.body.innerHTML = apiCard(t, s, 'https://example.org/api/v1')
    expect(visible('[data-api-url]')[0]?.textContent).toBe('https://example.org/api/v1')
    expect(visible('[data-needs-address]')).toEqual([])
  })

  // The Server tab is in the page while the Blog tab saves the address (ADR 0054), and it went
  // on saying "set the site address first" until a reload (2026-10-08).
  it('swap to the address, live, when a save sets it, and back when a save empties it', async () => {
    document.body.innerHTML = `<div data-screen="settings"><button data-settings-save></button>`
      + `<div data-settings-panels>`
      + textField({ k: 'siteUrl', label: 'Site address', type: 'url', value: '' })
      + mcpCard(t, { ...s, mcp: { ...s.mcp, enabled: true } }, '') + apiCard(t, s, '')
      + `</div></div>`
    screen = document.querySelector<HTMLElement>('[data-screen]')!
    const form = wireSave(screen, WORDS)
    typeAddress('https://example.org')
    answer.body = { success: true, data: { ...s, siteUrl: 'https://example.org' } }
    expect(await form.save()).toBe(true)
    expect(visible('[data-mcp-url], [data-api-url]').map((c) => c.textContent))
      .toEqual(['https://example.org/api/mcp', 'https://example.org/api/v1'])
    expect(visible('[data-needs-address]')).toEqual([])
    typeAddress('')
    answer.body = { success: true, data: { ...s, siteUrl: '' } }
    expect(await form.save()).toBe(true)
    expect(visible('[data-mcp-url], [data-api-url]')).toEqual([])
    expect(visible('[data-needs-address]').length).toBe(2)
  })

  it('fall back to SITE_URL, which the server handed over, when a save empties the setting', async () => {
    document.body.innerHTML = `<div data-screen="settings"><button data-settings-save></button>`
      + `<div data-settings-panels>`
      + textField({ k: 'siteUrl', label: 'Site address', type: 'url', value: 'https://a.example' })
      + apiCard(t, s, 'https://a.example/api/v1', 'https://env.example') + `</div></div>`
    screen = document.querySelector<HTMLElement>('[data-screen]')!
    const form = wireSave(screen, WORDS)
    typeAddress('')
    answer.body = { success: true, data: { ...s, siteUrl: '' } }
    expect(await form.save()).toBe(true)
    expect(visible('[data-api-url]')[0]?.textContent).toBe('https://env.example/api/v1')
  })
})

// A value the browser calls valid (`ftp://…` in a `type="url"` box) that the server refused:
// `field-check.ts` cleared the sentence on the next blur, because `validity.valid` was true.
describe('a server refusal and the blur after it', () => {
  it('keeps the sentence through a blur, and lets it go once the value is edited', async () => {
    const form = wireSave(screen, WORDS)
    wireFieldChecks(screen, WORDS)
    const f = typeAddress('ftp://example.org')
    answer = { status: 400, body: { success: false, error: 'field_url: siteUrl' } }
    expect(await form.save()).toBe(false)
    const slot = screen.querySelector<HTMLElement>('[data-field-check="siteUrl"]')!
    f.dispatchEvent(new FocusEvent('blur'))
    expect(slot.hidden).toBe(false)
    expect(slot.textContent).toBe('not an address')
    f.value = 'https://example.org'
    f.dispatchEvent(new Event('input', { bubbles: true }))
    expect(slot.hidden).toBe(true)
    expect(f.hasAttribute('aria-invalid')).toBe(false)
  })
})

describe('the zone a save moves', () => {
  it('moves <html data-tz> BEFORE the receipt reads the clock, so "Saved at" is on the new zone', async () => {
    document.documentElement.dataset.tz = 'UTC'
    screen.insertAdjacentHTML('beforeend', '<span data-settings-said></span>')
    const form = wireSave(screen, { ...WORDS, savedAt: 'at' })
    typeAddress('https://example.test')
    answer.body = { success: true, data: { ...s, timezone: '', zone: 'America/Los_Angeles' } }
    const before = Date.now()
    expect(await form.save()).toBe(true)
    const said = screen.querySelector('[data-settings-said]')!.textContent ?? ''
    const la = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Los_Angeles', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    expect([la.format(before), la.format(Date.now())]).toContain(said.replace('at ', ''))
    expect(document.documentElement.dataset.tz).toBe('America/Los_Angeles')
    delete document.documentElement.dataset.tz
  })
})
