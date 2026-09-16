// THE ACCOUNT CARD, whose whole job is refusing people who already hold a session.
//
// Everything here is a control that changes the locks, so the two facts worth pinning are the
// ones a browser proves and a type cannot: the device list FILLS (its stamps are epoch
// milliseconds and were read as text, which threw inside a `.map()` and left the card showing
// "no signed-in devices" on a screen whose only purpose is listing them), and a refusal SAYS
// WHICH refusal it was. The island holds no dictionary — every string in this admin lives in
// `locales/` — so the sentence for each refusal rides on the card as an attribute, and if the
// server stops writing them the card degrades to "Could not save" for a wrong password. That
// is a working refusal that reads as a broken screen, and nothing else would report it.
import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import type { SecurityWire } from '@/admin-shared/wire'
import { formatDateTimeShort } from '@/admin-shared/when'
import { adminT } from '@/i18n/admin-i18n'
import { DEFAULT_SETTINGS } from '@/content/settings'
import { accountTab } from '@/web/admin/screens/settings-account'
import { wireSecurity } from './lib/settings-security'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

const t = adminT('en')
const WHEN = new Date(2026, 8, 14, 3, 10).getTime()

const state = (over: Partial<SecurityWire> = {}): SecurityWire => ({
  currentSessionId: 'here',
  recoveryLeft: 8,
  totpEnabled: true,
  sessions: [
    { id: 'here', device: 'Safari on a Mac', createdAt: WHEN, lastSeenAt: WHEN, current: true },
    { id: 'phone', device: 'Chrome on Android', createdAt: WHEN, lastSeenAt: WHEN, current: false },
  ],
  ...over,
})

let root: HTMLElement
let said: { message: string; kind?: string }[]

const answer = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/** `/api/security` answers `get`; every write answers `refuse`, or succeeds when it is null. */
function serve(get: SecurityWire | null, refuse: { error: string; status: number } | null): void {
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    if (!init?.method && url.includes('/api/security')) {
      return Promise.resolve(get ? answer({ success: true, data: get }) : answer({ success: false }, 500))
    }
    return Promise.resolve(refuse
      ? answer({ success: false, error: refuse.error }, refuse.status)
      : answer({ success: true, data: { codes: ['aaaa-bbbb'] } }))
  }) as typeof fetch
}

const settle = async (): Promise<void> => { for (let i = 0; i < 12; i++) await Promise.resolve() }

beforeEach(() => {
  said = []
  document.body.innerHTML = ''
  root = document.createElement('div')
  root.innerHTML = accountTab(t, DEFAULT_SETTINGS)
  document.body.appendChild(root)
  window.addEventListener('quire:toast', ((e: Event) => {
    said.push((e as CustomEvent).detail as { message: string; kind?: string })
  }) as EventListener)
})

describe('the signed-in devices', () => {
  it('lists every one, and says which is the one asking', async () => {
    serve(state(), null)
    wireSecurity(root, {})
    await settle()
    const rows = [...root.querySelectorAll('[data-security-session]')]
    expect(rows.length).toBe(2)
    expect(rows[0]?.textContent).toContain('Safari on a Mac')
    expect(rows.some((r) => !r.querySelector<HTMLElement>('[data-sec-this]')?.hidden)).toBe(true)
  })

  it('prints the last-seen stamp from a number, not from string arithmetic', async () => {
    serve(state(), null)
    wireSecurity(root, {})
    await settle()
    const seen = root.querySelector<HTMLElement>('[data-sec-seen]')?.textContent ?? ''
    // The bug this file exists for: `.slice()` on an integer throws, the whole `.map()` goes
    // with it, and the list stays empty behind the server's own "no devices" state.
    expect(seen).toBe(formatDateTimeShort(WHEN))
    expect(seen).not.toContain('Invalid')
  })

  it('offers to end the others only when there are others', async () => {
    serve(state(), null)
    wireSecurity(root, {})
    await settle()
    expect(root.querySelector<HTMLElement>('[data-sec-signout-others]')?.hidden).toBe(false)
  })

  it('keeps that offer down when this is the only device', async () => {
    serve(state({ sessions: [
      { id: 'here', device: 'Safari on a Mac', createdAt: WHEN, lastSeenAt: WHEN, current: true },
    ] }), null)
    wireSecurity(root, {})
    await settle()
    expect(root.querySelector<HTMLElement>('[data-sec-signout-others]')?.hidden).toBe(true)
  })
})

describe('a refusal', () => {
  /** Type a password and press one of the keys that needs it. */
  async function attempt(hook: string): Promise<void> {
    const box = root.querySelector<HTMLInputElement>('[data-security-current]')!
    box.value = 'definitely not the password'
    box.dispatchEvent(new Event('input', { bubbles: true }))
    await settle()
    root.querySelector<HTMLButtonElement>(`[${hook}]`)?.click()
    await settle()
  }

  it('names a wrong password instead of saying something broke', async () => {
    serve(state(), { error: 'wrong_password', status: 403 })
    wireSecurity(root, {})
    await settle()
    await attempt('data-sec-recovery')
    expect(said.at(-1)?.message).toBe(t.securityWrongPassword)
    expect(said.at(-1)?.kind).toBe('error')
  })

  it('names one guess too many', async () => {
    serve(state(), { error: 'too_many_attempts', status: 429 })
    wireSecurity(root, {})
    await settle()
    await attempt('data-sec-recovery')
    expect(said.at(-1)?.message).toBe(t.securityTooMany)
  })

  it('mints nothing, and leaves the codes panel shut', async () => {
    serve(state(), { error: 'wrong_password', status: 403 })
    wireSecurity(root, {})
    await settle()
    await attempt('data-sec-recovery')
    // The panel ships DRAWN and empty under ADR 0054, so "is it in the DOM" is not the question.
    const list = root.querySelector('[data-security-codes]')
    expect(list?.children.length ?? 0).toBe(0)
    expect(root.querySelector<HTMLElement>('[data-sec-codes-panel]')?.hidden).toBe(true)
  })

  it('leaves every key dead until the password is typed', async () => {
    serve(state(), null)
    wireSecurity(root, {})
    await settle()
    for (const hook of ['data-sec-change', 'data-sec-recovery', 'data-sec-reenrol']) {
      expect(root.querySelector<HTMLButtonElement>(`[${hook}]`)?.disabled).toBe(true)
    }
  })
})

describe('ending one device', () => {
  /** Route the DELETE separately: the list still has to load before a row can be clicked. */
  function serveDelete(status: number): void {
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      if (init?.method === 'DELETE') return Promise.resolve(answer({ success: status === 200 }, status))
      if (url.includes('/api/security')) return Promise.resolve(answer({ success: true, data: state() }))
      return Promise.resolve(answer({ success: true }))
    }) as typeof fetch
  }

  const rowFor = (device: string): HTMLElement =>
    [...root.querySelectorAll<HTMLElement>('[data-security-session]')]
      .find((r) => r.textContent?.includes(device))!

  it('takes the row away when the server actually ended it', async () => {
    serveDelete(200)
    wireSecurity(root, {})
    await settle()
    rowFor('Chrome on Android').querySelector<HTMLButtonElement>('[data-sec-end]')?.click()
    await settle()
    expect(root.querySelectorAll('[data-security-session]').length).toBe(1)
  })

  it('keeps the row and says so when the server refused', async () => {
    serveDelete(500)
    wireSecurity(root, {})
    await settle()
    rowFor('Chrome on Android').querySelector<HTMLButtonElement>('[data-sec-end]')?.click()
    await settle()
    expect(root.querySelectorAll('[data-security-session]').length).toBe(2)
    expect(said.at(-1)?.kind).toBe('error')
  })

  it('says it failed when ending THIS device failed, instead of the sign-in page', async () => {
    // The fault this test exists for. The current-device branch ran before `res.ok` was read,
    // so a refused DELETE answered with the one screen that means "you are signed out" while
    // the session on this machine was still open and the device was still listed.
    //
    // ⚠️ The REDIRECT ITSELF CANNOT BE ASSERTED HERE: happy-dom ignores an assignment to
    // `location.href` and leaves it at `about:blank`, so `expect(location.href).toBe(before)`
    // passes whether the branch ran or not. What separates the three outcomes is the pair
    // below — a refusal SAYS so and keeps the row; a signing-out keeps the row and says
    // nothing; an ordinary success takes the row away.
    serveDelete(500)
    wireSecurity(root, {})
    await settle()
    rowFor('Safari on a Mac').querySelector<HTMLButtonElement>('[data-sec-end]')?.click()
    await settle()
    expect(said.at(-1)?.kind).toBe('error')
    expect(root.querySelectorAll('[data-security-session]').length).toBe(2)
  })

  it('signs the owner out rather than deleting the row, when THIS device ends for real', async () => {
    serveDelete(200)
    wireSecurity(root, {})
    await settle()
    rowFor('Safari on a Mac').querySelector<HTMLButtonElement>('[data-sec-end]')?.click()
    await settle()
    // Neither a refusal nor a vanished row: the card is left standing and the browser leaves.
    expect(said.length).toBe(0)
    expect(root.querySelectorAll('[data-security-session]').length).toBe(2)
  })
})
