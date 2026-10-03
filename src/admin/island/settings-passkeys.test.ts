// THE PASSKEYS ROW of the account card (ADR 0071), in a DOM.
//
// What a browser proves and the route tests cannot: the list fills from `/api/security`, the
// sentence about the address names the host, an IP address turns the key off with a reason, the
// add key waits for the password, and the browser's own refusal ("this device has one already")
// reaches the owner in words. The ceremony itself is a stand-in here; the tour drives a real one
// through Chrome's virtual authenticator.
import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import type { PasskeyWire, SecurityWire } from '@/admin-shared/wire'
import { adminT } from '@/i18n/admin-i18n'
import { DEFAULT_SETTINGS } from '@/content/settings'
import { accountTab } from '@/web/admin/screens/settings-account'
import { wireSecurity } from './lib/settings-security'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

const t = adminT('en')
const WHEN = new Date(2026, 9, 3, 9, 30).getTime()
const words = {
  passkeyDone: t.securityPasskeyDone, passkeyGone: t.securityPasskeyGone, passkeyCancelled: t.securityPasskeyCancelled,
  passkeyExists: t.securityPasskeyExists, askPasskeyTitle: t.askPasskeyTitle, askPasskeyBody: t.askPasskeyBody,
  askPasskeyYes: t.askPasskeyYes, no: t.askCancel,
}

const state = (passkeys: PasskeyWire[], passkeyRpId = 'blog.example'): SecurityWire => ({
  currentSessionId: 'here', recoveryLeft: 8, totpEnabled: true,
  sessions: [{ id: 'here', device: 'Safari on a Mac', createdAt: WHEN, lastSeenAt: WHEN, current: true }],
  passkeys, passkeyRpId,
})

let root: HTMLElement
let said: { message: string; kind?: string }[]
let posted: { url: string; body: Record<string, unknown> }[]

function serve(get: SecurityWire, writes: Record<string, unknown> = {}): void {
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    const reply = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } }))
    if (!init?.method) return reply({ success: true, data: get })
    posted.push({ url, body: JSON.parse(String(init.body ?? '{}')) as Record<string, unknown> })
    const path = Object.keys(writes).find((p) => url.endsWith(p))
    return reply({ success: true, data: path ? writes[path] : {} })
  }) as typeof fetch
}

const settle = async (): Promise<void> => { for (let i = 0; i < 20; i++) await Promise.resolve() }
const $ = <T extends HTMLElement = HTMLElement>(q: string) => root.querySelector<T>(q)

async function typePassword(): Promise<void> {
  const box = $<HTMLInputElement>('[data-security-current]')!
  box.value = 'the password'
  box.dispatchEvent(new Event('input', { bubbles: true }))
  await settle()
}

/** A browser with WebAuthn, whose `create` does what the test says. */
function webauthn(create: () => Promise<unknown>): void {
  ;(globalThis as Record<string, unknown>).PublicKeyCredential = class {}
  Object.defineProperty(navigator, 'credentials', { configurable: true, value: { create } })
}

beforeEach(() => {
  said = []
  posted = []
  delete (globalThis as Record<string, unknown>).PublicKeyCredential
  document.body.innerHTML = ''
  root = document.createElement('div')
  root.innerHTML = accountTab(t, DEFAULT_SETTINGS)
  document.body.appendChild(root)
  window.addEventListener('quire:toast', ((e: Event) => said.push((e as CustomEvent).detail as never)) as EventListener)
})

beforeAll(() => window.addEventListener('quire:confirm', ((e: Event) => {
  e.preventDefault()
  ;((e as CustomEvent).detail as { respond: (a: string) => void }).respond('confirm')
}) as EventListener))

describe('the list', () => {
  it('ships empty, and fills with a name and its dates', async () => {
    expect(root.querySelectorAll('[data-security-passkey]').length).toBe(0)
    serve(state([
      { id: 'a', name: 'Laptop', createdAt: WHEN, lastUsedAt: WHEN },
      { id: 'b', name: 'Phone', createdAt: WHEN, lastUsedAt: null },
    ]))
    wireSecurity(root, words)
    await settle()
    const rows = [...root.querySelectorAll<HTMLElement>('[data-security-passkey]')]
    expect(rows.map((r) => r.querySelector('[data-sec-passkey-name]')?.textContent)).toEqual(['Laptop', 'Phone'])
    expect(rows[1]!.querySelector<HTMLElement>('[data-sec-passkey-never]')?.hidden).toBe(false)
    expect(rows[1]!.querySelector<HTMLElement>('[data-sec-passkey-used]')?.hidden).toBe(true)
    expect($('[data-sec-passkeys-none]')?.hidden).toBe(true)
    // The device list still finds ITS template, not the passkeys' one above it.
    expect(root.querySelectorAll('[data-security-session]').length).toBe(1)
  })

  it('says which address the passkeys belong to, and that a move ends them', async () => {
    serve(state([]))
    wireSecurity(root, words)
    await settle()
    const bound = $('[data-sec-passkeys-bound]')!
    expect(bound.hidden).toBe(false)
    expect(bound.textContent).toContain('blog.example')
    expect(bound.textContent).not.toContain('{host}')
    expect($('[data-sec-passkeys-none]')?.hidden).toBe(false)
  })
})

describe('adding one', () => {
  it('says plainly when the browser cannot, and keeps the key off', async () => {
    serve(state([]))
    wireSecurity(root, words)
    await settle()
    await typePassword()
    expect($('[data-sec-passkey-unsupported]')?.hidden).toBe(false)
    expect($<HTMLButtonElement>('[data-sec-passkey-add]')?.disabled).toBe(true)
  })

  it('on an IP address, says why and keeps the key off', async () => {
    webauthn(() => Promise.resolve(null))
    serve(state([], '192.168.1.50'))
    wireSecurity(root, words)
    await settle()
    await typePassword()
    expect($('[data-sec-passkey-needs-name]')?.hidden).toBe(false)
    expect($<HTMLButtonElement>('[data-sec-passkey-add]')?.disabled).toBe(true)
  })

  it('waits for the password, then runs the ceremony and sends what came back', async () => {
    const buf = (n: number) => new Uint8Array([n, n, n]).buffer
    webauthn(() => Promise.resolve({
      id: 'cred',
      response: { clientDataJSON: buf(1), attestationObject: buf(2), getTransports: () => ['internal'] },
    }))
    serve(state([]), {
      '/passkeys/start': {
        challenge: 'AAAA', rp: { id: 'blog.example', name: 'Blog' }, user: { id: 'AQID', name: 'o', displayName: 'o' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }], timeout: 1000, attestation: 'none',
        authenticatorSelection: { userVerification: 'required' }, excludeCredentials: [],
      },
      '/passkeys/finish': { id: 'cred' },
    })
    wireSecurity(root, words)
    await settle()
    expect($<HTMLButtonElement>('[data-sec-passkey-add]')?.disabled).toBe(true)
    await typePassword()
    $<HTMLInputElement>('[data-sec-passkey-name-box]')!.value = 'Laptop'
    $<HTMLButtonElement>('[data-sec-passkey-add]')!.click()
    await settle()
    const finish = posted.find((p) => p.url.endsWith('/passkeys/finish'))!
    expect(finish.body).toMatchObject({ current: 'the password', name: 'Laptop', clientDataJSON: 'AQEB', attestationObject: 'AgIC', transports: ['internal'] })
    expect(said.at(-1)?.message).toBe(t.securityPasskeyDone)
    expect($<HTMLInputElement>('[data-sec-passkey-name-box]')!.value).toBe('')
  })

  it('a device that already holds one says so, in words', async () => {
    webauthn(() => Promise.reject(new DOMException('exists', 'InvalidStateError')))
    serve(state([]), { '/passkeys/start': { challenge: 'AAAA', rp: { id: 'x', name: 'x' }, user: { id: 'AQID', name: 'o', displayName: 'o' }, pubKeyCredParams: [], timeout: 1, attestation: 'none', authenticatorSelection: {}, excludeCredentials: [] } })
    wireSecurity(root, words)
    await settle()
    await typePassword()
    $<HTMLButtonElement>('[data-sec-passkey-add]')!.click()
    await settle()
    expect(said.at(-1)).toEqual({ message: t.securityPasskeyExists, kind: 'error' })
    expect(posted.some((p) => p.url.endsWith('/passkeys/finish'))).toBe(false)
  })
})

describe('removing one', () => {
  it('asks, then sends the password with the id', async () => {
    serve(state([{ id: 'gone', name: 'Old', createdAt: WHEN, lastUsedAt: null }]))
    wireSecurity(root, words)
    await settle()
    const key = $<HTMLButtonElement>('[data-sec-passkey-remove]')!
    expect(key.disabled).toBe(true)
    await typePassword()
    expect(key.disabled).toBe(false)
    key.click()
    await settle()
    expect(posted.at(-1)).toEqual({ url: '/api/security/passkeys/remove', body: { current: 'the password', id: 'gone' } })
    expect(said.at(-1)?.message).toBe(t.securityPasskeyGone)
  })
})
