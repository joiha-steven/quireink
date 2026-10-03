// Run on Cloudflare (G5.3): what the card's three keys do. Markup and words are the server's
// (`web/admin/screens/settings-server-cloud.ts`); the move itself runs on the server and this only
// starts it and follows it.
//
// ⚠️ THE MOVE KEY STAYS DISABLED UNTIL A CHECK HAS SAID YES — and is disabled again the moment the
// account or the token is edited, because the yes was about the values that were checked. A move
// started with a token nobody checked fails three steps in, after a Worker has been created.
//
// ⚠️ THE TOKEN AND THE PASSWORD ARE CLEARED once the move has started: they were sent, and a
// password left in a field on a screen the owner walks away from is a password on the screen.
import { setLamp } from './settings-cards'

type Words = Partial<Record<string, string>>
type Step = 'check' | 'package' | 'install' | 'archive' | 'upload' | 'verify'
type Status = {
  running: boolean
  steps: Record<Step, 'wait' | 'run' | 'done' | 'fail'>
  detail: string
  url: string
  scriptName: string
  siteUrl: string
  error: string
}
type Check = { plan: 'paid' | 'free' | 'unknown'; scriptName: string; exists: boolean; siteUrl: string | null }
type Envelope<T> = { success?: boolean; data?: T; error?: string }

const fill = (text: string | undefined, values: Record<string, string>): string =>
  (text ?? '').replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? '')

async function call<T>(url: string, init?: RequestInit): Promise<Envelope<T>> {
  const res = await fetch(url, init)
  if (res.status === 401) {
    location.href = `/login?next=${encodeURIComponent(location.pathname + location.search)}`
    return {}
  }
  return (await res.json().catch(() => ({}))) as Envelope<T>
}

const post = <T>(url: string, body: unknown) =>
  call<T>(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

export function wireCloud(screen: HTMLElement): void {
  const card = screen.querySelector<HTMLElement>('[data-cf-card]')
  if (!card) return
  const w = JSON.parse(card.dataset.cfWords ?? '{}') as Words
  const $ = <E extends Element = HTMLElement>(sel: string) => card.querySelector<E>(sel)
  const account = $<HTMLInputElement>('[data-cf-account]')!
  const token = $<HTMLInputElement>('[data-cf-token]')!
  const current = $<HTMLInputElement>('[data-cf-current]')!
  const selfUpdate = $<HTMLInputElement>('[data-cf-self-update]')!
  const confirmPaid = $<HTMLInputElement>('[data-cf-confirm-paid]')!
  const paidRow = $('[data-cf-paid-row]')!
  const answer = $('[data-cf-answer]')!
  const checkKey = $<HTMLButtonElement>('[data-cf-check]')!
  const moveKey = $<HTMLButtonElement>('[data-cf-move]')!
  const stepsBox = $('[data-cf-steps]')!
  const error = $('[data-cf-error]')!
  const done = $('[data-cf-done]')!
  const domainKey = $<HTMLButtonElement>('[data-cf-domain]')!

  let checked: Check | null = null
  let host = ''

  const say = (el: HTMLElement, text: string): void => { el.textContent = text; el.hidden = !text }
  const armMove = (): void => {
    moveKey.disabled = !checked || !checked.siteUrl || checked.plan === 'free' || (checked.plan === 'unknown' && !confirmPaid.checked)
  }

  for (const el of [account, token]) {
    el.addEventListener('input', () => { checked = null; say(answer, ''); paidRow.hidden = true; armMove() })
  }
  confirmPaid.addEventListener('change', armMove)

  checkKey.addEventListener('click', async () => {
    checkKey.disabled = true
    say(error, '')
    try {
      const r = await post<Check>('/api/cloudflare/check', { accountId: account.value, token: token.value })
      if (!r.success || !r.data) { checked = null; say(answer, r.error ?? w.failed ?? ''); return }
      checked = r.data
      const name = { name: r.data.scriptName }
      const lines = [!r.data.siteUrl ? w.siteUrlNeeded : fill(w[r.data.plan], name)]
      if (r.data.exists) lines.push(fill(w.exists, name))
      say(answer, lines.join(' '))
      paidRow.hidden = r.data.plan !== 'unknown'
      host = r.data.siteUrl ? new URL(r.data.siteUrl).hostname : ''
    } finally {
      checkKey.disabled = false
      armMove()
    }
  })

  function paint(s: Status): void {
    stepsBox.hidden = false
    for (const li of stepsBox.querySelectorAll<HTMLElement>('[data-cf-step]')) {
      const state = s.steps[li.dataset.cfStep as Step]
      const lampEl = li.querySelector('[data-cf-lamp]')
      setLamp(lampEl, state === 'done' ? 'good' : state === 'wait' ? 'off' : 'attention', '')
      lampEl?.classList.toggle('lamp-pulse', state === 'run')
      const detail = li.querySelector<HTMLElement>('[data-cf-detail]')
      if (detail) detail.textContent = state === 'run' || state === 'fail' ? s.detail : ''
    }
    say(error, s.error ? `${w.failed ?? ''} ${s.error}`.trim() : '')
    if (s.siteUrl) host = new URL(s.siteUrl).hostname
    if (!s.running && !s.error && s.url) {
      done.hidden = false
      say($('[data-cf-done-line]')!, fill(w.done, { url: s.url }))
      say($('[data-cf-domain-note]')!, fill(w.domainNote, { host, name: s.scriptName }))
      domainKey.textContent = fill(w.attach, { host })
      domainKey.hidden = !host
    }
  }

  async function follow(): Promise<void> {
    for (;;) {
      const r = await call<Status | null>('/api/cloudflare/move')
      if (r.data) paint(r.data)
      if (!r.data || !r.data.running) break
      await new Promise((resolve) => setTimeout(resolve, 1500))
    }
    moveKey.disabled = false
    armMove()
  }

  moveKey.addEventListener('click', async () => {
    moveKey.disabled = true
    say(error, '')
    done.hidden = true
    const r = await post<Status>('/api/cloudflare/move', {
      accountId: account.value, token: token.value, current: current.value,
      selfUpdate: selfUpdate.checked, confirmedPaid: confirmPaid.checked,
    })
    if (!r.success || !r.data) {
      const reason = r.error === 'wrong_password' ? w.wrongPassword
        : r.error === 'too_many_attempts' ? w.tooMany
          : r.error === 'move_running' ? w.running
            : r.error === 'site_url_needed' ? w.siteUrlNeeded
              : `${w.failed ?? ''} ${r.error ?? ''}`.trim()
      say(error, reason ?? '')
      armMove()
      return
    }
    token.value = ''
    current.value = ''
    checked = null
    paint(r.data)
    await follow()
  })

  domainKey.addEventListener('click', async () => {
    domainKey.disabled = true
    const r = await post<{ attached: string }>('/api/cloudflare/domain', {})
    domainKey.disabled = false
    if (r.success && r.data) {
      say($('[data-cf-domain-note]')!, fill(w.attached, { host: r.data.attached }))
      domainKey.hidden = true
    } else {
      say(error, `${w.failed ?? ''} ${r.error ?? ''}`.trim())
    }
  })

  // A move started before this page was opened (another tab, a reload) is followed, not lost.
  void call<Status | null>('/api/cloudflare/move').then((r) => {
    if (r.data) { paint(r.data); if (r.data.running) void follow() }
  })
}
