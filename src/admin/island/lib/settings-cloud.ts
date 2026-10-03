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
type Check = { plan: 'paid' | 'free' | 'unknown'; scriptName: string; exists: boolean; siteUrl: string | null; bytes: number }
type Envelope<T> = { success?: boolean; data?: T; error?: string }

const fill = (text: string | undefined, values: Record<string, string>): string =>
  (text ?? '').replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? '')

/**
 * Every request here answers, even when the network does not: a key left disabled with nothing on
 * screen after a dropped connection is a card that looks broken. `network` is the one error the
 * island makes itself; the rest are the server's codes, put into words by `reason`.
 */
async function call<T>(url: string, init?: RequestInit): Promise<Envelope<T>> {
  const res = await fetch(url, init).catch(() => null)
  if (!res) return { success: false, error: 'network' }
  if (res.status === 401) {
    location.href = `/login?next=${encodeURIComponent(location.pathname + location.search)}`
    return {}
  }
  return (await res.json().catch(() => ({}))) as Envelope<T>
}

/** A server code, said in the owner's language; an unknown one after the step's own prefix. */
function reason(w: Words, code: string | undefined, prefix: string | undefined): string {
  const known: Record<string, string | undefined> = {
    network: w.network, wrong_password: w.wrongPassword, too_many_attempts: w.tooMany,
    move_running: w.running, site_url_needed: w.siteUrlNeeded, token_required: w.tokenRequired,
    account_and_token_required: w.tokenRequired, not_installed_by_api: w.notApi, already_newest: w.newest,
    confirm_mismatch: w.mismatch, bad_request: w.network,
  }
  const c = code ?? ''
  if (known[c]) return known[c]!
  if (c.startsWith('token_cannot')) return w.tokenCannot ?? c
  return `${prefix ?? ''} ${c}`.trim()
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
      if (!r.success || !r.data) { checked = null; say(answer, reason(w, r.error, w.failed)); return }
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
      // Nothing to report, mid-move: the server restarted and the move's state went with it.
      if (!r.success || !r.data) { say(error, r.success ? w.interrupted ?? '' : reason(w, r.error, w.failed)); break }
      paint(r.data)
      if (!r.data.running) break
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
      say(error, reason(w, r.error, w.failed))
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
      say(error, reason(w, r.error, w.failed))
    }
  })

  // A move started before this page was opened (another tab, a reload) is followed, not lost.
  void call<Status | null>('/api/cloudflare/move').then((r) => {
    if (r.data) { paint(r.data); if (r.data.running) void follow() }
  })
}

type Live = {
  current: string
  latest: string | null
  state: 'behind' | 'current' | 'unknown'
  updates: 'api' | 'git' | 'cli'
  hasToken: boolean
  siteUrl: string
  cost: { views30: number; requests: number; r2Bytes: number; dbBytes: number; usd: number }
}

const size = (n: number): string => (n >= 1e9 ? `${(n / 1e9).toFixed(1)} GB` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.round(n / 1e3)} KB`)

/**
 * The card on a Cloudflare install (G5.4). ⚠️ THE UPDATE IS ONE LONG REQUEST to the Worker
 * (`POST /api/cloudflare/update`, about a minute), not a job to poll: the Worker runs it, and the
 * object that would answer a poll is the thing being replaced. A reload follows a success, so the
 * page comes back from the new version.
 */
export function wireCloudLive(screen: HTMLElement): void {
  const card = screen.querySelector<HTMLElement>('[data-cf-live]')
  if (!card) return
  const w = JSON.parse(card.dataset.cfWords ?? '{}') as Words
  const $ = <E extends Element = HTMLElement>(sel: string) => card.querySelector<E>(sel)
  const say = (el: HTMLElement | null, text: string): void => { if (el) { el.textContent = text; el.hidden = !text } }
  const key = $<HTMLButtonElement>('[data-cf-update]')!
  const line = $('[data-cf-update-line]')
  const error = $('[data-cf-error]')
  let target: string | null = null

  void call<Live>('/api/cloudflare/status').then((r) => {
    const s = r.data
    if (!s) { say(error, reason(w, r.error, w.failed)); return }
    say($('[data-cf-version]'), fill(w.version, { v: s.current }))
    for (const el of card.querySelectorAll<HTMLElement>('[data-cf-path]')) el.hidden = el.dataset.cfPath !== s.updates
    target = s.latest
    $('[data-cf-leave]')!.hidden = s.updates !== 'api'
    $('[data-cf-leave-git]')!.hidden = s.updates !== 'git'
    $('[data-cf-leave-cli]')!.hidden = s.updates !== 'cli'
    const confirm = $<HTMLInputElement>('[data-cf-leave-confirm]')
    if (confirm && s.siteUrl) confirm.placeholder = new URL(s.siteUrl).hostname
    if (s.updates === 'api') {
      // The token boxes serve the update and the delete alike; shown whenever none is kept.
      $('[data-cf-ask-token]')!.hidden = s.hasToken
      // Newest only when the daily check SAID so; unknown is a key that asks (the Worker asks GitHub).
      key.hidden = s.state === 'current'
      key.textContent = s.latest ? fill(w.updateTo, { v: s.latest }) : w.look ?? ''
      if (s.state === 'current') say(line, w.newest ?? '')
    }
    const c = s.cost
    say($('[data-cf-cost]'), fill(w.cost, {
      views: c.views30.toLocaleString(), requests: c.requests.toLocaleString(), r2: size(c.r2Bytes), db: size(c.dbBytes), usd: c.usd.toFixed(2),
    }))
  })

  // Leaving (G5.4): the password and the address typed out, then one long request to the Worker.
  const leaveKey = $<HTMLButtonElement>('[data-cf-leave-key]')
  leaveKey?.addEventListener('click', async () => {
    leaveKey.disabled = true
    say(error, '')
    const r = await post<{ deleted: string }>('/api/cloudflare/uninstall', {
      current: $<HTMLInputElement>('[data-cf-leave-current]')?.value ?? '',
      confirm: $<HTMLInputElement>('[data-cf-leave-confirm]')?.value ?? '',
      token: $<HTMLInputElement>('[data-cf-u-token]')?.value ?? '',
      accountId: $<HTMLInputElement>('[data-cf-u-account]')?.value ?? '',
    }).catch(() => ({ success: false, error: 'network' }) as Envelope<never>)
    leaveKey.disabled = false
    if (r.success) { say($('[data-cf-leave-line]'), w.leaveDone ?? ''); leaveKey.hidden = true; return }
    say(error, reason(w, r.error, w.leaveFailed))
  })

  key.addEventListener('click', async () => {
    key.disabled = true
    say(error, '')
    say(line, w.updating ?? '')
    const r = await post<{ to: string; rolledBack: boolean; error: string }>('/api/cloudflare/update', {
      target,
      token: $<HTMLInputElement>('[data-cf-u-token]')?.value ?? '',
      accountId: $<HTMLInputElement>('[data-cf-u-account]')?.value ?? '',
    }).catch(() => ({ success: false, error: 'network' }) as Envelope<never>)
    key.disabled = false
    if (r.success && r.data) {
      say(line, fill(w.updated, { v: r.data.to }))
      setTimeout(() => location.reload(), 2500)
      return
    }
    say(line, '')
    say(error, r.data?.rolledBack ? fill(w.rolledBack, { why: r.error ?? '' }) : reason(w, r.error, w.failed))
  })
}
