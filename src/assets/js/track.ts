// The analytics beacon: one page view on load, one scroll-depth sample on leave.
//
// Both are held back by `whenActivated`. A prerendered page runs its scripts at
// speculation time, so without that guard a hover would record a view for a page the
// reader never opened, and the dwell timer would count the wait as reading time.

import { whenActivated } from './activation'

/** `sendBeacon` when it exists, a keepalive fetch when it does not. Never blocks. */
function beacon(payload: Record<string, unknown>): void {
  const body = JSON.stringify(payload)
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }))
    } else {
      fetch('/api/track', {
        method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true,
      })
    }
  } catch {
    /* analytics must never affect the page */
  }
}

/** The referrer host, but only when it is another site. '' otherwise. */
function externalReferrer(): string {
  try {
    const r = document.referrer
    if (!r) return ''
    const host = new URL(r).host
    return host && host !== location.host ? host : ''
  } catch {
    return '' // malformed referrer
  }
}

/** How far down the page the reader has got, as a percentage. */
function depth(): number {
  const doc = document.documentElement
  const scrollable = doc.scrollHeight - doc.clientHeight
  if (scrollable <= 0) return 100 // the page fits the viewport, so it was fully seen
  return Math.max(0, Math.min(100, Math.round((scrollY / scrollable) * 100)))
}

// Dwell is ENGAGED time, not elapsed time. Wall-clock dwell measured every tab someone
// walked away from: manhhung.me's table held samples of an hour, six hours, a day — a lit
// monitor, not a reader — and one 24-hour sample moved the site's average by minutes.
// So the clock only runs while the page is visible AND the reader has done something in
// the last three minutes. Three, not one: reading IS idleness punctuated by scrolls, and a
// long screenful of text takes a couple of minutes before there is any reason to move.
const IDLE_MS = 180_000
const TICK_MS = 5_000

export function track(): void {
  const path = location.pathname
  // Defence in depth. The server drops these paths too, but there is no reason to send them.
  if (path.startsWith('/admin') || path.startsWith('/api')) return

  whenActivated(() => {
    beacon({ path, referrer: externalReferrer() })

    const now = () => performance.now()
    let max = depth()
    let sent = false
    let engaged = 0
    let lastActive = now()
    let lastTick = lastActive
    const active = () => { lastActive = now() }

    // The accumulator. Ticks are also how throttling is survived: a background tab fires
    // its timer once a minute at best, so the delta since the last tick can be huge — it
    // is capped at two ticks' worth, and a hidden or idle page adds nothing at all.
    // `closing` is for the final slice: by the time the leave handler runs, the page
    // already reports itself hidden, and without it a five-second visit measured zero.
    const meter = (closing?: boolean) => {
      const t = now()
      const delta = Math.min(t - lastTick, TICK_MS * 2)
      lastTick = t
      if ((closing || document.visibilityState === 'visible') && t - lastActive <= IDLE_MS && delta > 0) {
        engaged += delta
      }
    }
    const interval = setInterval(() => meter(), TICK_MS)
    for (const kind of ['pointerdown', 'pointermove', 'keydown', 'touchstart'] as const) {
      addEventListener(kind, active, { passive: true })
    }

    // The depth sample is sent ONCE, when the reader leaves. `pagehide` and a hidden tab
    // both count as leaving, and either can be the last event a browser delivers, so both
    // are wired and `sent` makes the second one a no-op.
    const send = () => {
      if (sent || max <= 0) return
      sent = true
      meter(true) // close the open slice, so a quick bounce still measures
      clearInterval(interval)
      beacon({ path, depth: max, dwell: Math.round(engaged) })
    }

    addEventListener('scroll', () => { max = Math.max(max, depth()); active() }, { passive: true })
    addEventListener('pagehide', send)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') send()
    })
  })
}
