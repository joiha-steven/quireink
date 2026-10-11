// THE INSTALLED THEMES on the Look card (ADR 0072, T2c), in a DOM: the server's own markup
// (`lookPicker`), the island that wires it, and a fetch that answers as the routes do.
//
// What this proves and the route tests cannot: every answer an install can get is said on the
// card (installed, already installed, refused with one line per finding, too large, no network, a
// server error), the key is busy while the file travels, the list is redrawn without touching the
// rest of the form or the owner's unsaved pick, and Rollback and Remove redraw it too.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { adminT } from '@/i18n/admin-i18n'
import { DEFAULT_SETTINGS } from '@/content/settings'
import type { InstalledTheme } from '@/content/installed-themes'
import type { SiteSettings } from '@/types'
import { lookPicker } from '@/web/admin/screens/settings-appearance-look'
import { wireControls } from './lib/settings-controls'
import { wireThemes } from './lib/settings-themes'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

const t = adminT('en')
const HASH = 'c'.repeat(64)
const BROADSHEET: InstalledTheme = {
  id: 'broadsheet',
  current: {
    version: '1.1.0', hash: HASH, installedAt: 2, name: 'Broadsheet', author: 'A. Writer', description: null,
    license: 'MIT', homepage: null, api: 1, screenshot: `/themes/${HASH}/screenshot.webp`,
  },
  previous: [{ version: '1.0.0', hash: 'd'.repeat(64), installedAt: 1 }],
  active: false,
  reviewed: false,
  readable: true,
}

/** The screen as the server draws it: the picker and one other field with its own unsaved state. */
const page = (s: SiteSettings, installed: InstalledTheme[]): string =>
  `<div data-screen="settings"><div data-settings-panels>`
  + lookPicker(t, s, { installed, health: { ok: true } })
  + `<input data-k="title" value="My blog"></div></div>`

type Reply = { status: number; body?: unknown } | 'offline' | Promise<{ status: number; body?: unknown }>

let root: HTMLElement
let screen: HTMLElement
let said: { message: string; kind?: string }[]
let asked: { url: string; method: string }[]
let serverSettings: SiteSettings
let serverInstalled: InstalledTheme[]
let replies: Record<string, Reply>
let moves: number
/** When set, what the redraw's fetch of the settings page answers instead of the server's state. */
let pageReply: (() => Promise<{ status: number; html: string }>) | null

function serve(): void {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    const method = init?.method ?? 'GET'
    asked.push({ url, method })
    if (url.startsWith('/admin/settings')) {
      const r = pageReply ? await pageReply() : { status: 200, html: `<html><body>${page(serverSettings, serverInstalled)}</body></html>` }
      return new Response(r.html, { status: r.status })
    }
    const reply = await replies[`${method} ${url}`]
    if (reply === 'offline' || reply === undefined) throw new TypeError('Failed to fetch')
    return new Response(JSON.stringify(reply.body ?? {}), { status: reply.status, headers: { 'content-type': 'application/json' } })
  }) as typeof fetch
}

const settle = async (): Promise<void> => { for (let i = 0; i < 30; i++) await new Promise((r) => setTimeout(r, 0)) }
const $ = <T extends HTMLElement = HTMLElement>(q: string) => screen.querySelector<T>(q)
const visible = (q: string): boolean => { const el = $(q); return !!el && !el.hidden }

function choose(name = 'broadsheet.zip'): void {
  const input = $<HTMLInputElement>('[data-theme-file]')!
  Object.defineProperty(input, 'files', { configurable: true, value: [new File([new Uint8Array([80, 75])], name)] })
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

function mount(s: SiteSettings, installed: InstalledTheme[]): void {
  document.body.innerHTML = ''
  root = document.createElement('div')
  root.innerHTML = page(s, installed)
  document.body.appendChild(root)
  screen = root.querySelector<HTMLElement>('[data-screen]')!
  wireControls(screen.querySelector<HTMLElement>('[data-settings-panels]')!, () => { moves++ })
  wireThemes(screen)
}

beforeAll(() => {
  window.addEventListener('quire:toast', ((e: Event) => said.push((e as CustomEvent).detail as never)) as EventListener)
  window.addEventListener('quire:confirm', ((e: Event) => {
    e.preventDefault()
    ;((e as CustomEvent).detail as { respond: (a: string) => void }).respond(confirming ? 'confirm' : 'cancel')
  }) as EventListener)
})
let confirming = true

beforeEach(() => {
  said = []
  asked = []
  replies = {}
  moves = 0
  confirming = true
  pageReply = null
  serverSettings = { ...DEFAULT_SETTINGS, theme: 'plain' }
  serverInstalled = []
  serve()
  mount(serverSettings, [])
})

describe('installing from a file', () => {
  it('says installed, lists the new tile, and keeps the owner’s unsaved pick and other fields', async () => {
    // Unsaved work elsewhere on the form: a typed title and the Newspaper pressed.
    $<HTMLInputElement>('[data-k="title"]')!.value = 'A new name'
    $('[data-choice="paper"]')!.click()
    replies['POST /api/themes'] = { status: 200, body: { success: true, data: { id: 'broadsheet', version: '1.1.0', hash: HASH, changed: true } } }
    serverInstalled = [BROADSHEET]
    choose()
    await settle()
    expect($('[data-theme-status]')!.textContent).toBe('Installed Broadsheet 1.1.0.')
    expect(visible('[data-theme-status]')).toBe(true)
    expect(visible('[data-theme-error]')).toBe(false)
    expect($('[data-theme-cell="broadsheet"]')).not.toBeNull()
    expect($('[data-theme-cell="broadsheet"]')!.textContent).toContain(t.themeUnreviewed)
    expect($('[data-choice="paper"]')!.getAttribute('aria-pressed')).toBe('true')
    expect($('[data-choice="broadsheet"]')!.getAttribute('aria-pressed')).toBe('false')
    expect($<HTMLInputElement>('[data-k="title"]')!.value).toBe('A new name')
    // The Save key was told to count again after the swap.
    expect(moves).toBeGreaterThan(1)
  })

  it('says already installed when the package changed nothing', async () => {
    replies['POST /api/themes'] = { status: 200, body: { success: true, data: { id: 'broadsheet', version: '1.1.0', hash: HASH, changed: false } } }
    serverInstalled = [BROADSHEET]
    choose()
    await settle()
    expect($('[data-theme-status]')!.textContent).toBe('Broadsheet 1.1.0 was already installed. Nothing changed.')
  })

  it('is busy while the file travels, and pressable again after', async () => {
    let answer: (r: { status: number; body?: unknown }) => void = () => {}
    replies['POST /api/themes'] = new Promise((r) => { answer = r })
    choose()
    await settle()
    const key = $<HTMLButtonElement>('[data-theme-choose]')!
    expect(key.disabled).toBe(true)
    expect(key.textContent).toBe(t.themeInstalling)
    expect($('[data-look-picker]')!.getAttribute('aria-busy')).toBe('true')
    // A second file chosen while the first is on its way sends nothing.
    choose('again.zip')
    answer({ status: 413, body: { success: false, error: 'file_too_large' } })
    await settle()
    expect(asked.filter((a) => a.url === '/api/themes')).toHaveLength(1)
    expect(key.disabled).toBe(false)
    expect(key.textContent).toBe(t.themeInstall)
    expect($('[data-look-picker]')!.hasAttribute('aria-busy')).toBe(false)
  })

  it('lists every finding of a refused package, each with its rule in words and where it is', async () => {
    const violations = [
      { rule: 'C1', file: 'theme.css', line: 3, col: 5, subject: 'color:red' },
      { rule: 'S2', file: 'theme.css', line: 0, col: 0, subject: 'front' },
      { rule: 'Z9', file: '', line: 0, col: 0, subject: 'from a later build' },
    ]
    replies['POST /api/themes'] = { status: 422, body: { success: false, error: 'theme_refused', violations } }
    choose()
    await settle()
    expect(visible('[data-theme-refusal]')).toBe(true)
    expect($('[data-theme-refusal-head]')!.textContent).toBe('Not installed. Problems the check found: 3')
    const lines = [...screen.querySelectorAll('[data-theme-violations] li')].map((li) => [
      li.querySelector('[data-theme-violation-what]')!.textContent, li.querySelector('[data-theme-violation-where]')!.textContent,
    ])
    expect(lines).toEqual([
      [t.themeRules.C1, 'C1 · theme.css:3:5 · color:red'],
      [t.themeRules.S2, 'S2 · theme.css · front'],
      [t.themeRules.other, 'Z9 · from a later build'],
    ])
    expect($('[data-theme-cell="broadsheet"]')).toBeNull()
  })

  it('says a file over the limit is too large', async () => {
    replies['POST /api/themes'] = { status: 413, body: { success: false, error: 'file_too_large' } }
    choose()
    await settle()
    expect($('[data-theme-error]')!.textContent).toBe(t.themeTooBig)
    expect(visible('[data-theme-error]')).toBe(true)
    expect(visible('[data-theme-status]')).toBe(false)
  })

  it('says the file did not reach the server when the network fails', async () => {
    replies['POST /api/themes'] = 'offline'
    choose()
    await settle()
    expect($('[data-theme-error]')!.textContent).toBe(t.themeNetwork)
    expect($<HTMLButtonElement>('[data-theme-choose]')!.disabled).toBe(false)
  })

  it('says a server error with its status, and a new answer replaces the old one', async () => {
    replies['POST /api/themes'] = { status: 422, body: { success: false, error: 'theme_refused', violations: [{ rule: 'P1', file: 'theme.css', line: 1, col: 1, subject: '!important' }] } }
    choose()
    await settle()
    replies['POST /api/themes'] = { status: 500, body: { success: false, error: 'internal' } }
    choose()
    await settle()
    expect($('[data-theme-error]')!.textContent).toBe(t.themeServerError.replace('{status}', '500'))
    expect(visible('[data-theme-refusal]')).toBe(false)
  })
})

describe('rolling back and removing', () => {
  beforeEach(() => {
    serverSettings = { ...DEFAULT_SETTINGS, theme: 'broadsheet' }
    serverInstalled = [BROADSHEET]
    mount(serverSettings, serverInstalled)
  })

  it('rolls back, redraws the tile without its Rollback key, and says the version now current', async () => {
    replies['POST /api/themes/broadsheet/rollback'] = { status: 200, body: { success: true, data: { id: 'broadsheet', current: { version: '1.0.0' }, removed: { version: '1.1.0' } } } }
    serverInstalled = [{ ...BROADSHEET, current: { ...BROADSHEET.current, version: '1.0.0' }, previous: [] }]
    $('[data-theme-rollback="broadsheet"]')!.click()
    await settle()
    expect(said.at(-1)?.message).toBe('Rolled Broadsheet back to 1.0.0.')
    expect($('[data-theme-rollback]')).toBeNull()
    expect($('[data-theme-cell="broadsheet"]')!.textContent).toContain('Version 1.0.0')
  })

  it('asks before removing, saying the blog goes back to Plain, and does nothing when told no', async () => {
    let question = ''
    window.addEventListener('quire:confirm', ((e: Event) => {
      question = ((e as CustomEvent).detail as { request: { body: string } }).request.body
    }) as EventListener, { once: true })
    confirming = false
    $('[data-theme-remove="broadsheet"]')!.click()
    await settle()
    expect(question).toContain(t.lookPlain)
    expect(asked.some((a) => a.method === 'DELETE')).toBe(false)
    expect($('[data-theme-cell="broadsheet"]')).not.toBeNull()
  })

  it('removes, redraws the list, and the stored choice shows as Plain again', async () => {
    replies['DELETE /api/themes/broadsheet'] = { status: 200, body: { success: true, data: { id: 'broadsheet', removed: 2 } } }
    serverSettings = { ...DEFAULT_SETTINGS, theme: 'plain' }
    serverInstalled = []
    $('[data-theme-remove="broadsheet"]')!.click()
    await settle()
    expect(said.at(-1)?.message).toBe('Removed Broadsheet.')
    expect($('[data-theme-cell]')).toBeNull()
    expect($('[data-choice-track][data-k="theme"]')!.dataset.was).toBe('plain')
    expect($('[data-choice="plain"]')!.getAttribute('aria-pressed')).toBe('true')
  })

  it('says it did not work when the server refuses, and leaves the list as it was', async () => {
    replies['DELETE /api/themes/broadsheet'] = { status: 404, body: { success: false, error: 'not_found' } }
    $('[data-theme-remove="broadsheet"]')!.click()
    await settle()
    expect(said.at(-1)).toMatchObject({ message: t.themeActionFailed, kind: 'error' })
    expect($('[data-theme-cell="broadsheet"]')).not.toBeNull()
    expect($<HTMLButtonElement>('[data-theme-remove="broadsheet"]')!.disabled).toBe(false)
  })
})

const TWO: InstalledTheme[] = [BROADSHEET, { ...BROADSHEET, id: 'ledger', current: { ...BROADSHEET.current, name: 'Ledger' } }]
const rolledBack = (theme: InstalledTheme): InstalledTheme =>
  ({ ...theme, current: { ...theme.current, version: '1.0.0' }, previous: [] })
const OK_ROLLBACK = { status: 200, body: { success: true, data: { current: { version: '1.0.0' } } } }

describe('the redraw', () => {
  it('lands the later of two overlapping redraws, so both rolled-back themes lose their Rollback key', async () => {
    serverInstalled = TWO
    mount({ ...DEFAULT_SETTINGS, theme: 'plain' }, TWO)
    replies['POST /api/themes/broadsheet/rollback'] = OK_ROLLBACK
    replies['POST /api/themes/ledger/rollback'] = OK_ROLLBACK
    // The two redraws are answered in order, the first with only Broadsheet rolled back.
    const answers: ((html: string) => void)[] = []
    pageReply = () => new Promise((r) => answers.push((html) => r({ status: 200, html })))
    $('[data-theme-rollback="broadsheet"]')!.click()
    $('[data-theme-rollback="ledger"]')!.click()
    await settle()
    expect(answers).toHaveLength(2)
    answers[0]!(page(DEFAULT_SETTINGS, [rolledBack(TWO[0]!), TWO[1]!]))
    await settle()
    answers[1]!(page(DEFAULT_SETTINGS, TWO.map(rolledBack)))
    await settle()
    expect($('[data-theme-rollback]')).toBeNull()
    expect(screen.querySelectorAll('[data-look-list]')).toHaveLength(1)
  })

  it('keeps the later redraw when the earlier answer arrives last', async () => {
    serverInstalled = TWO
    mount({ ...DEFAULT_SETTINGS, theme: 'plain' }, TWO)
    replies['POST /api/themes/broadsheet/rollback'] = OK_ROLLBACK
    replies['POST /api/themes/ledger/rollback'] = OK_ROLLBACK
    const answers: ((html: string) => void)[] = []
    pageReply = () => new Promise((r) => answers.push((html) => r({ status: 200, html })))
    $('[data-theme-rollback="broadsheet"]')!.click()
    $('[data-theme-rollback="ledger"]')!.click()
    await settle()
    expect(answers).toHaveLength(2)
    answers[1]!(page(DEFAULT_SETTINGS, TWO.map(rolledBack)))
    await settle()
    answers[0]!(page(DEFAULT_SETTINGS, [rolledBack(TWO[0]!), TWO[1]!]))
    await settle()
    expect($('[data-theme-rollback]')).toBeNull()
    expect(screen.querySelectorAll('[data-look-list]')).toHaveLength(1)
  })

  it('tells the owner to reload when the list cannot be drawn again after an install', async () => {
    replies['POST /api/themes'] = { status: 200, body: { success: true, data: { id: 'broadsheet', version: '1.1.0', hash: HASH, changed: true } } }
    // What an expired session gets: a sign-in page, 200, with no list in it.
    pageReply = async () => ({ status: 200, html: '<html><body><form action="/login"></form></body></html>' })
    choose()
    await settle()
    expect($('[data-theme-status]')!.textContent).toBe(`Installed broadsheet 1.1.0. ${t.themeReloadToSee}`)
  })

  it('tells the owner to reload when the list cannot be drawn again after a rollback', async () => {
    serverInstalled = [BROADSHEET]
    mount(DEFAULT_SETTINGS, [BROADSHEET])
    replies['POST /api/themes/broadsheet/rollback'] = OK_ROLLBACK
    pageReply = async () => ({ status: 500, html: '' })
    $('[data-theme-rollback="broadsheet"]')!.click()
    await settle()
    expect(said.at(-1)?.message).toBe(`Rolled Broadsheet back to 1.0.0. ${t.themeReloadToSee}`)
  })

  it('puts focus on the installed theme’s tile, the rolled-back one, or the pressed one after a removal', async () => {
    replies['POST /api/themes'] = { status: 200, body: { success: true, data: { id: 'broadsheet', version: '1.1.0', hash: HASH, changed: true } } }
    serverInstalled = [BROADSHEET]
    choose()
    await settle()
    expect(document.activeElement).toBe($('[data-choice="broadsheet"]'))

    replies['POST /api/themes/broadsheet/rollback'] = OK_ROLLBACK
    serverInstalled = [rolledBack(BROADSHEET)]
    $<HTMLElement>('[data-theme-remove="broadsheet"]')!.focus()
    $('[data-theme-rollback="broadsheet"]')!.click()
    await settle()
    expect(document.activeElement).toBe($('[data-choice="broadsheet"]'))

    replies['DELETE /api/themes/broadsheet'] = { status: 200, body: { success: true, data: { id: 'broadsheet', removed: 1 } } }
    serverInstalled = []
    $('[data-theme-remove="broadsheet"]')!.click()
    await settle()
    expect(document.activeElement).toBe($('[data-choice-track][data-k="theme"] [data-choice="plain"]'))
  })

  it('keeps the live region in the page across a redraw, so the sentence put in it is read out', async () => {
    const region = $('[aria-live="polite"]')
    replies['POST /api/themes'] = { status: 200, body: { success: true, data: { id: 'broadsheet', version: '1.1.0', hash: HASH, changed: true } } }
    serverInstalled = [BROADSHEET]
    choose()
    await settle()
    expect($('[aria-live="polite"]')).toBe(region)
    expect(region!.contains($('[data-theme-status]'))).toBe(true)
  })
})

describe('a screenshot that does not decode', () => {
  it('is hidden when it fails, so the drawing under it shows', async () => {
    serverInstalled = [BROADSHEET]
    mount(DEFAULT_SETTINGS, [BROADSHEET])
    const img = $<HTMLImageElement>('img[data-theme-shot]')!
    img.hidden = false
    img.dispatchEvent(new Event('error'))
    expect(img.hidden).toBe(true)
  })

  it('is hidden when it had already failed before the island ran', async () => {
    document.body.innerHTML = ''
    root = document.createElement('div')
    root.innerHTML = page(DEFAULT_SETTINGS, [BROADSHEET])
    document.body.appendChild(root)
    screen = root.querySelector<HTMLElement>('[data-screen]')!
    const img = $<HTMLImageElement>('img[data-theme-shot]')!
    Object.defineProperty(img, 'complete', { configurable: true, value: true })
    Object.defineProperty(img, 'naturalWidth', { configurable: true, value: 0 })
    wireThemes(screen)
    expect(img.hidden).toBe(true)
  })

  it('stays shown once it has decoded', async () => {
    document.body.innerHTML = ''
    root = document.createElement('div')
    root.innerHTML = page(DEFAULT_SETTINGS, [BROADSHEET])
    document.body.appendChild(root)
    screen = root.querySelector<HTMLElement>('[data-screen]')!
    const img = $<HTMLImageElement>('img[data-theme-shot]')!
    Object.defineProperty(img, 'complete', { configurable: true, value: true })
    Object.defineProperty(img, 'naturalWidth', { configurable: true, value: 1200 })
    wireThemes(screen)
    expect(img.hidden).toBe(false)
  })
})
