// The analytics screen's two pieces of behaviour (ADR 0054).
//
// THE REST OF THE SCREEN IS READING. Six React files drew this page; five of them turned into
// markup the server sends once, and what is left here is the only state that cannot be: a live
// number that goes stale while you look at it, and a filter over rows that are already drawn.
//
// ⚠️ NOTHING HERE BUILDS A ROW. The filter hides and unhides; the live strip writes one count
// and up to three names into spans the server already placed, with the classes the server
// already wrote. An island that types out an emerald or a `text-xs` is a screen that drifts
// from the kit with nothing to catch it.
import type { SiteLang } from '@/types'
import type { RightNow } from '@/analytics/types'
import { formatCount } from '@/i18n/format'
import { fold } from '@/admin-shared/fold'
import { TOP_N } from '@/admin-shared/analytics'

const root = document.querySelector<HTMLElement>('[data-screen="analytics"]')

if (root) {
  const screen: HTMLElement = root
  const lang = (screen.dataset.lang ?? 'en') as SiteLang

  // ---- the piece index: a filter over rows the server drew -----------------------------
  const box = screen.querySelector<HTMLInputElement>('[data-piece-search]')
  const rows = [...screen.querySelectorAll<HTMLElement>('[data-piece]')]
  if (box && rows.length) {
    const countTag = screen.querySelector<HTMLElement>('[data-piece-count]')
    const none = screen.querySelector<HTMLElement>('[data-piece-none]')
    const table = screen.querySelector<HTMLElement>('[data-piece-table]')
    const more = screen.querySelector<HTMLElement>('[data-piece-more]')
    const fewer = screen.querySelector<HTMLElement>('[data-piece-fewer]')
    let showAll = false

    const apply = (): void => {
      const needle = fold(box.value)
      // SEARCHING OPENS THE LIST. Somebody who typed a title wants the answer, not the answer
      // plus a button admitting there might be more of it.
      const open = showAll || needle.length > 0
      // `shown` is how many MATCH, which is what the count beside the heading reports.
      // `placed` is how many are on screen, which is what the ten-row cap counts. They were
      // one variable until the rows already drawn in the table above started arriving hidden:
      // those still match a search, and still have to come back the moment one is typed.
      let shown = 0
      let placed = 0
      let last: HTMLElement | null = null
      for (const row of rows) {
        const hit = !needle || (row.dataset.find ?? '').includes(needle)
        if (hit) shown += 1
        const eligible = hit && (open || !row.hasAttribute('data-piece-above'))
        const show = eligible && (open || placed < TOP_N)
        if (show) placed += 1
        row.hidden = !show
        row.removeAttribute('data-last')
        if (show) last = row
      }
      // The hairline belongs under the last row SHOWING. `TROW`'s own `last:border-0` answers
      // for `:last-child`, which is a hidden row whenever anything is hidden.
      last?.setAttribute('data-last', '')
      if (countTag) countTag.textContent = formatCount(shown, lang)
      if (none) none.hidden = shown > 0
      if (table) table.hidden = shown === 0
      // Neither button is useful while something is typed: a search already shows every match.
      if (more) more.hidden = open || shown <= TOP_N
      if (fewer) fewer.hidden = !showAll || needle.length > 0 || shown <= TOP_N
    }

    box.addEventListener('input', apply)
    screen.querySelector('[data-piece-showall]')?.addEventListener('click', () => {
      showAll = true
      apply()
    })
    screen.querySelector('[data-piece-showfewer]')?.addEventListener('click', () => {
      showAll = false
      apply()
    })
    // The server drew the ten; this only matters when the browser restored a typed query on a
    // back-navigation, where the box has a value and every row is still standing.
    if (box.value) apply()
  }

  // ---- the live strip: one number, every ten seconds ------------------------------------
  const strip = screen.querySelector<HTMLElement>('[data-live]')
  if (strip) {
    const words = JSON.parse(strip.dataset.liveWords ?? '{}') as { reading?: string; quiet?: string }
    const lampOn = strip.querySelector<HTMLElement>('[data-live-lamp="on"]')
    const lampOff = strip.querySelector<HTMLElement>('[data-live-lamp="off"]')
    const countTag = strip.querySelector<HTMLElement>('[data-live-count]')
    const pages = strip.querySelector<HTMLElement>('[data-live-pages]')
    const quiet = strip.querySelector<HTMLElement>('[data-live-quiet]')

    /**
     * A live path's own name, read off the piece index below — which already prints every path
     * with its title, so nothing has to be sent twice. A path with no row there keeps its own
     * address, which is what the React face did for a path it had no title for.
     */
    const names = new Map<string, string>()
    for (const row of screen.querySelectorAll<HTMLAnchorElement>('[data-piece-row]')) {
      const path = row.getAttribute('title')
      if (path) names.set(path, row.textContent?.trim() || path)
    }

    /**
     * ⚠️ `textContent`, NEVER `innerHTML`, and this is the one place on the screen where that
     * is a security rule rather than a preference: a path in `analytics_events` is whatever URL
     * somebody requested, so it is a stranger's string. The server escapes it on the way into
     * the markup; here the DOM does the escaping by construction.
     */
    const draw = (now: RightNow): void => {
      const live = now.visitors > 0
      const reading = (words.reading ?? '').replace('{n}', formatCount(now.visitors, lang))
      if (lampOn) {
        // The hook is ON the lamp, not on a wrapper around it — a wrapper became a flex item
        // and opened the strip by 8px. So the name goes on this element itself.
        lampOn.hidden = !live
        if (live) {
          lampOn.setAttribute('title', reading)
          lampOn.setAttribute('aria-label', reading)
        }
      }
      if (lampOff) lampOff.hidden = live
      if (countTag) {
        countTag.hidden = !live
        countTag.textContent = reading
      }
      if (quiet) quiet.hidden = live
      if (!pages) return
      pages.hidden = !live
      pages.replaceChildren()
      now.pages.slice(0, 3).forEach((p, i) => {
        if (i > 0) pages.append(' · ')
        const span = document.createElement('span')
        span.dataset.livePage = ''
        span.dataset.path = p.path
        span.textContent = names.get(p.path) ?? p.path
        if (p.visitors > 1) {
          const n = document.createElement('span')
          // The one class this island writes. `tabular-nums` is a utility rather than a kit
          // signature, and `check:admin-css` still proves the rule exists in the built sheet.
          n.className = 'tabular-nums'
          n.textContent = ` (${formatCount(p.visitors, lang)})`
          span.append(n)
        }
        pages.append(span)
      })
    }

    /**
     * Polling, not a socket, and it stops dead when the tab is hidden.
     *
     * The number is one indexed five-minute scan; a poll that sleeps while nobody is looking
     * costs less than holding a connection open for a page the owner reads a few times a day.
     * A failed poll keeps the last value rather than blanking the strip — the last count is
     * still the best thing known, and an empty strip would read as "nobody", which is a
     * different claim from "we could not ask".
     */
    setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void fetch('/api/admin/view/analytics-now', { headers: { accept: 'application/json' } })
        .then((r) => (r.ok ? r.json() : null))
        .then((body: { data?: RightNow } | null) => {
          if (body?.data) draw(body.data)
        })
        .catch(() => undefined)
    }, 10_000)
  }
}
