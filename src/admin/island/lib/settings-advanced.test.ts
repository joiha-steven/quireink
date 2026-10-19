// The advanced band's island, run against the markup the server sends for the settings screen.
//
// What it must hold: shut unless this device asked for it open; a search hit or a refused field
// opens it WITHOUT changing that preference; a key edited inside it and folded away is still
// counted and still sent by the sheet's Save; and the count on the key follows the lamps.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { freshDatabase, dropDatabase } from '@/test/db'
import { getSettings } from '@/content/settings'
import { settingsScreen } from '@/web/admin/screens/settings'
import { adminT } from '@/i18n/admin-i18n'
import { ADVANCED_KEY, needsAttention, wireAdvanced } from './settings-advanced'
import { wireSave } from './settings-save'
import { setLamp } from './settings-cards'
import { wireControls } from './settings-controls'

const DIR = './.tmp/test-settings-advanced-island'
const t = adminT('en')
freshDatabase(DIR)
let html = ''
beforeAll(async () => {
  GlobalRegistrator.register()
  html = await settingsScreen(await getSettings(), new URLSearchParams('tab=server'))
})
afterAll(async () => { await GlobalRegistrator.unregister(); dropDatabase(DIR) })

beforeEach(() => {
  localStorage.clear()
  document.body.innerHTML = html
})

const screen = (): HTMLElement => document.querySelector<HTMLElement>('[data-screen="settings"]')!
const key = (): HTMLElement => document.querySelector<HTMLElement>('[data-advanced-toggle]')!
const body = (): HTMLElement => document.querySelector<HTMLElement>('[data-advanced-body]')!
const badge = (): HTMLElement => document.querySelector<HTMLElement>('[data-advanced-count]')!
const frame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()))

describe('open or shut', () => {
  it('stays shut for a device that never asked', () => {
    wireAdvanced(screen())
    expect(body().hidden).toBe(true)
    expect(key().getAttribute('aria-expanded')).toBe('false')
  })

  it('opens for a device that asked, and the key remembers either answer', () => {
    localStorage.setItem(ADVANCED_KEY, '1')
    wireAdvanced(screen())
    expect(body().hidden).toBe(false)
    expect(key().getAttribute('aria-expanded')).toBe('true')
    key().click()
    expect(body().hidden).toBe(true)
    expect(localStorage.getItem(ADVANCED_KEY)).toBe('0')
    key().click()
    expect(body().hidden).toBe(false)
    expect(localStorage.getItem(ADVANCED_KEY)).toBe('1')
  })

  it('still opens and shuts when storage refuses', () => {
    const real = Object.getOwnPropertyDescriptor(window, 'localStorage')
    Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new Error('denied') } })
    try {
      wireAdvanced(screen())
      expect(body().hidden).toBe(true)
      key().click()
      expect(body().hidden).toBe(false)
    } finally {
      if (real) Object.defineProperty(window, 'localStorage', real)
    }
  })
})

describe('a reason to look once', () => {
  it('opens for a setting inside it, and does not remember that', () => {
    const fold = wireAdvanced(screen())
    const inside = document.querySelector('[data-k="mcp.enabled"]')
    expect(fold.reveal(inside)).toBe(true)
    expect(body().hidden).toBe(false)
    expect(key().getAttribute('aria-expanded')).toBe('true')
    expect(localStorage.getItem(ADVANCED_KEY)).toBeNull()
  })

  it('does nothing for a setting above it', () => {
    const fold = wireAdvanced(screen())
    expect(fold.reveal(document.querySelector('[data-k="cache.enabled"]'))).toBe(false)
    expect(body().hidden).toBe(true)
  })
})

describe('a shut band is still in the form', () => {
  it('counts a key changed inside it and sends it with the sheet\'s Save', async () => {
    const sent: unknown[] = []
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      sent.push(JSON.parse(String(init?.body)))
      return new Response(JSON.stringify({ success: true, data: {} }), { status: 200 })
    }) as typeof fetch
    const fold = wireAdvanced(screen())
    const form = wireSave(screen(), { save: 'Save settings', saveCount: 'Save · {n} change|Save · {n} changes' }, fold.recount)
    wireControls(document.querySelector<HTMLElement>('[data-settings-panels]')!, form.recount)

    const sw = document.querySelector<HTMLElement>('[data-switch][data-k="seo.llms"]')!
    expect(body().hidden).toBe(true)
    // RELATIVE to what is waiting at rest: happy-dom reads two Home-tab selects as changed the
    // moment they are parsed (Chrome reads none — the Save key ships disabled on the real page),
    // and the claim here is about the one key folded under Advanced.
    const resting = form.count()
    const was = sw.getAttribute('aria-checked')
    sw.click()
    expect(sw.getAttribute('aria-checked')).not.toBe(was)
    expect(form.count()).toBe(resting + 1)
    const save = document.querySelector<HTMLButtonElement>('[data-settings-save]')!
    expect(save.disabled).toBe(false)

    expect(await form.save()).toBe(true)
    expect(sent.length).toBe(1)
    expect((sent[0] as { seo?: { llms?: boolean } }).seo).toEqual({ llms: was !== 'true' })
    expect(form.count()).toBe(0)
  })
})

describe('what needs attention', () => {
  const lampOf = (sel: string) => document.querySelector(sel)!.closest('section')!.querySelector<HTMLElement>('[data-card-lamp]')!

  it('is a failed test or an unsaved edit, never "not set up yet"', () => {
    const card = document.querySelector('[data-card-route="/api/integrations/cloudflare"]')!
    const lamp = card.querySelector<HTMLElement>('[data-card-lamp]')!
    // As drawn on a blog with no Cloudflare: amber, saying it is not set up. Optional, so quiet.
    expect(lamp.dataset.lampRest).toBe('attention')
    expect(needsAttention(card)).toBe(false)
    setLamp(lamp, 'attention', t.connectionUnsaved)
    expect(needsAttention(card)).toBe(true)
    setLamp(lamp, 'attention', t.connectionFailed)
    expect(needsAttention(card)).toBe(true)
    // Painted back to the state it was drawn in, it is quiet again.
    setLamp(lamp, 'attention', lamp.dataset.lampRestTitle ?? '')
    expect(needsAttention(card)).toBe(false)
    setLamp(lamp, 'good', t.connectionUntested)
    expect(needsAttention(card)).toBe(false)
    setLamp(lamp, 'off', '')
    expect(needsAttention(card)).toBe(false)
  })

  it('is an unsaved key, on a card with no lamp to say so', () => {
    const card = document.querySelector('[data-k="customHead"]')!.closest('section[class]')!.closest('.card-body')!.closest('section')!
    expect(card.querySelector('[data-card-lamp]')).toBeNull()
    expect(needsAttention(card)).toBe(false)
    const box = card.querySelector<HTMLTextAreaElement>('[data-k="customHead"]')!
    box.value = '<meta name="x" content="y">'
    expect(needsAttention(card)).toBe(true)
  })

  it('moves the count on the key as a lamp inside changes', async () => {
    wireAdvanced(screen())
    // A seeded blog, Cloudflare not set up: nothing to say.
    expect(badge().hidden).toBe(true)
    const mcp = lampOf('[data-k="mcp.enabled"]')
    const cf = lampOf('[data-card-route="/api/integrations/cloudflare"]')
    setLamp(mcp, 'attention', t.connectionUnsaved)
    await frame(); await frame()
    expect(badge().hidden).toBe(false)
    expect(badge().textContent?.trim()).toBe('1 needs attention')
    setLamp(cf, 'attention', t.connectionFailed)
    await frame(); await frame()
    expect(badge().textContent?.trim()).toBe('2 need attention')
    setLamp(cf, 'good', t.connectionUntested)
    setLamp(mcp, 'off', '')
    await frame(); await frame()
    expect(badge().hidden).toBe(true)
  })
})
