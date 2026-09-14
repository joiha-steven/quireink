// The newsletter screen's behaviour (ADR 0054): three tabs, a list that narrows and pages, a
// two-stage send latch, and three test sends.
//
// ⚠️ THE ONE IRREVERSIBLE THING IN THIS ADMIN IS IN HERE. `POST /api/broadcast` puts mail on a
// relay and a newsletter cannot be unsent, so exactly one line in this file issues it, it is
// reachable only from a click handler that has already checked the latch is armed, and there
// is no form anywhere on the screen for a stray Enter to submit.
//
// NOTHING HERE BUILDS A ROW. Every subscriber, every post and both empty states arrived as
// markup; the filter, the pager and the tabs set `hidden`, and the only text written is a
// count, a countdown and a subject line.
import type { SiteLang } from '@/types'
import { formatCount } from '@/i18n/format'
import { buttonClass } from '@/admin-shared/kit'
import { wireSubscribers } from './lib/subscriber-list'

const root = document.querySelector<HTMLElement>('[data-screen="newsletter"]')

type Words = Partial<Record<
  'digest' | 'already' | 'armed' | 'send' | 'going' | 'loading' | 'sendDone' | 'sendFailed'
  | 'previewEmpty' | 'previewFailed' | 'testSent' | 'testFailed' | 'deleteFailed' | 'showing', string>>

type Run = { sent: number; failed: number; recipients: number; done: boolean }

if (root) {
  const screen: HTMLElement = root
  const lang = (screen.dataset.lang ?? 'en') as SiteLang
  const words = JSON.parse(screen.dataset.nlWords ?? '{}') as Words
  const n = (x: number): string => formatCount(x, lang)
  const say = (message: string, kind?: 'error'): void => {
    window.dispatchEvent(new CustomEvent('quire:toast', { detail: { message, kind } }))
  }
  const pick = <T extends HTMLElement>(sel: string): T | null => screen.querySelector<T>(sel)

  // ---- the three tabs ------------------------------------------------------------------
  const strip = pick('[data-nl-tabs]')
  const panels = [...screen.querySelectorAll<HTMLElement>('[data-nl-panel]')]
  const ON = strip?.querySelector<HTMLElement>('[aria-pressed="true"]')?.className ?? ''
  const OFF = strip?.querySelector<HTMLElement>('[aria-pressed="false"]')?.className ?? ''

  function swap(tab: string): void {
    screen.dataset.nlTab = tab
    // The address follows the strip. `replaceState`, not `pushState`: three tabs are one
    // screen, and Back should leave the newsletter rather than walk the ones clicked through.
    const url = new URL(location.href)
    if (tab === 'people') url.searchParams.delete('tab')
    else url.searchParams.set('tab', tab)
    history.replaceState(history.state, '', url)
    for (const p of panels) p.hidden = p.dataset.nlPanel !== tab
    for (const b of strip?.querySelectorAll<HTMLElement>('[data-tab]') ?? []) {
      const on = b.dataset.tab === tab
      b.setAttribute('aria-pressed', String(on))
      b.className = on ? ON : OFF
    }
    if (tab === 'send') void preview()
  }

  strip?.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-tab]')
    if (b?.dataset.tab) swap(b.dataset.tab)
  })

  // ---- People -----------------------------------------------------------------------
  // Its own module under `island/lib/`, which the build's `*.ts` glob does not reach: a list
  // that narrows, pages, picks, drops and exports is the shape the media library will want
  // too, and it took this file past its 400-line ceiling inline.
  wireSubscribers(screen, { lang, words, say })

  // ---- Send: the preview, and the latch --------------------------------------------------
  const postBoxes = [...screen.querySelectorAll<HTMLInputElement>('[data-nl-post]')]
  const hintOne = pick('[data-nl-hint-one]')
  const hintMany = pick('[data-nl-hint-many]')
  const consent = pick('[data-nl-consent]')
  const consentLine = pick('[data-nl-consent-line]')
  const resend = pick<HTMLInputElement>('[data-nl-resend]')
  const latch = pick('[data-nl-latch]')
  const sendButton = pick<HTMLButtonElement>('[data-nl-send]')
  const sendLabel = pick('[data-nl-send-label]')
  const sendLamp = pick('[data-nl-send-lamp]')
  const previewState = pick('[data-nl-preview-state]')
  const previewBox = pick('[data-nl-preview]')
  const subject = pick('[data-nl-subject]')
  const frame = pick<HTMLIFrameElement>('[data-nl-frame]')

  let armed = 0
  let ticking: ReturnType<typeof setInterval> | null = null
  let sending = false
  let recipients: number | null = null
  let asked = ''

  const slugs = (): string[] => postBoxes.filter((b) => b.checked).map((b) => b.value)
  const priorSent = (): number => postBoxes.filter((b) => b.checked && b.dataset.sent).length

  function paint(): void {
    const many = slugs().length
    const prior = priorSent()
    const blocked = prior > 0 && !(resend?.checked ?? false)
    if (sendButton) {
      sendButton.disabled = sending || many === 0 || blocked
      sendButton.className = buttonClass(armed > 0 || sending ? 'armed' : 'primary')
    }
    if (sendLamp) sendLamp.hidden = !sending
    if (!sendLabel) return
    if (sending) sendLabel.textContent = words.loading ?? ''
    else if (armed > 0) {
      sendLabel.textContent = (words.armed ?? '')
        .replace('{n}', recipients === null ? '…' : n(recipients)).replace('{s}', String(armed))
    } else sendLabel.textContent = words.send ?? ''
  }

  function disarm(): void {
    armed = 0
    if (ticking) clearInterval(ticking)
    ticking = null
    paint()
  }

  function arm(): void {
    armed = 5
    ticking = setInterval(() => {
      armed -= 1
      if (armed <= 0) disarm()
      else paint()
    }, 1000)
    paint()
  }

  /** An armed latch is armed for ONE exact selection; changing anything stands it down. */
  function changed(): void {
    disarm()
    const prior = priorSent()
    const many = slugs().length
    if (hintOne) hintOne.hidden = many > 1
    if (hintMany) {
      hintMany.hidden = many <= 1
      hintMany.textContent = (words.digest ?? '').replace('{n}', n(many))
    }
    if (consent) consent.hidden = prior === 0
    if (consentLine) consentLine.textContent = (words.already ?? '').replace('{n}', n(prior))
    paint()
    void preview()
  }

  async function preview(): Promise<void> {
    const list = slugs()
    const key = list.join(',')
    if (key === asked) return
    asked = key
    if (!previewState || !previewBox) return
    previewBox.hidden = true
    previewState.hidden = false
    if (list.length === 0) {
      previewState.textContent = words.previewEmpty ?? ''
      recipients = null
      paint()
      return
    }
    previewState.textContent = words.loading ?? ''
    const qs = list.map((s) => `slug=${encodeURIComponent(s)}`).join('&')
    const body = await fetch(`/api/broadcast?${qs}`)
      .then((r) => r.json() as Promise<{ success?: boolean; data?: { subject: string; html: string; recipients: number } }>)
      .catch(() => null)
    if (asked !== key) return
    if (!body?.success || !body.data) {
      previewState.textContent = words.previewFailed ?? ''
      recipients = null
      paint()
      return
    }
    recipients = body.data.recipients
    if (subject) subject.textContent = body.data.subject
    if (frame) frame.srcdoc = body.data.html
    previewState.hidden = true
    previewBox.hidden = false
    paint()
  }

  /** How far the run has got. The request that started it answered before the mail went out. */
  async function watch(): Promise<void> {
    for (;;) {
      await new Promise((r) => setTimeout(r, 1200))
      const body = await fetch('/api/broadcast/status')
        .then((r) => r.json() as Promise<{ success?: boolean; data?: Run | null }>)
        .catch(() => null)
      const run = body?.data
      if (!run) return
      if (sendLabel) {
        sendLabel.textContent = (words.going ?? '')
          .replace('{sent}', n(run.sent)).replace('{total}', n(run.recipients))
      }
      if (!run.done) continue
      say((words.sendDone ?? '').replace('{sent}', n(run.sent)).replace('{total}', n(run.recipients)))
      return
    }
  }

  for (const b of postBoxes) b.addEventListener('change', changed)
  resend?.addEventListener('change', () => { disarm(); paint() })

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && armed > 0) disarm() })
  document.addEventListener('click', (e) => {
    if (armed > 0 && !latch?.contains(e.target as Node)) disarm()
  })

  // ⚠️ THE ONLY LINE IN THIS PRODUCT THAT SENDS A NEWSLETTER is inside this handler, behind
  // the armed check. The first press arms and returns.
  sendButton?.addEventListener('click', () => {
    if (sending || sendButton.disabled) return
    if (armed === 0) { arm(); return }
    disarm()
    sending = true
    paint()
    if (sendLabel) sendLabel.textContent = (words.going ?? '').replace('{sent}', n(0)).replace('{total}', n(recipients ?? 0))
    void (async () => {
      try {
        const res = await fetch('/api/broadcast', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ slugs: slugs(), force: resend?.checked ?? false }),
        })
        const body = await res.json() as { success?: boolean; error?: string; data?: Run }
        if (!body?.success || !body.data) {
          say(`${words.sendFailed ?? ''}: ${body?.error ?? ''}`, 'error')
          return
        }
        for (const b of postBoxes) if (b.checked) b.dataset.sent = '1'
        if (resend) resend.checked = false
        await watch()
      } catch {
        say(words.sendFailed ?? '', 'error')
      } finally {
        sending = false
        changed()
      }
    })()
  })

  // ---- Test: three sample sends ----------------------------------------------------------
  const testTo = pick<HTMLInputElement>('[data-nl-test-to]')
  screen.addEventListener('click', (e) => {
    const button = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-nl-test]')
    const kind = button?.dataset.nlTest
    if (!button || !kind) return
    button.disabled = true
    void fetch('/api/mail/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind, to: testTo?.value ?? '' }),
    })
      .then((r) => r.json() as Promise<{ success?: boolean; error?: string; data?: { to: string } }>)
      .then((body) => {
        if (body?.success && body.data) say((words.testSent ?? '').replace('{to}', body.data.to))
        else say(`${words.testFailed ?? ''}: ${body?.error ?? ''}`, 'error')
      })
      .catch(() => say(words.testFailed ?? '', 'error'))
      .finally(() => { button.disabled = false })
  })

  // The server drew the button's resting state; this derives it again from the boxes, so the
  // two can never disagree about whether a already-sent post is ticked. No fetch: the preview
  // is only worth asking for on the tab that shows it.
  paint()
  if (screen.dataset.nlTab === 'send') void preview()
}
