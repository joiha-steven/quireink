// The admin rail's behaviour, in plain TypeScript (ADR 0054).
//
// The rail's MARKUP arrives with the page (`web/admin/rail.ts`). This is everything that
// happens to it afterwards, and it is deliberately small: the rail is one DOM whatever state
// it is in, so almost every control here sets an attribute on `<html>` and lets CSS do the
// work. Nothing is rebuilt, which is why nothing here can rebuild it wrongly.
//
// The one exception is arrange mode, which really does add elements, and it is in its own
// file: `rail-arrange.ts`, loaded the moment somebody enters the mode and never before.
//
// WHY NOT REACT. It was 803 lines across three components and six more they pulled in, and it
// could not draw until a bundle had been fetched, parsed and run. The rail is the frame the
// owner navigates by; it should be there in the first frame, and now it is.
//
// WHAT THIS FILE MAY NOT DO: know what a row looks like. Every class, every label and every
// glyph is the server's, and a style written here would be a second opinion about the rail
// that only one of the two could win.
import { NARROW, RAIL_KEYS, RAIL_WIDTH } from '@/admin-shared/rail'
import type { NavOrder } from '@/types'

/**
 * What the server told the rail, in one tag.
 *
 * The WORDS are here rather than in eleven shipped dictionaries: the server already knows the
 * language, so it sends the fourteen strings this file can need — the other half of each
 * control's label pair, and the four sentences arrange mode says. That is ADR 0054's second
 * decision applied to the smallest surface it has.
 */
export type RailWords = {
  navCollapse: string; navExpand: string
  navIconsHide: string; navIconsShow: string
  cacheCleared: string; clearCacheFailed: string
  navArrange: string; navArrangeDone: string; navArrangeReset: string; navArrangeFailed: string
  navMoveUp: string; navMoveDown: string
  navShowLogo: string; navShowSearch: string
}

export type RailData = {
  words: RailWords
  /** The order as DRAWN — already reconciled against the rail this build has. */
  order: NavOrder
  /** What Reset means, and what a row added by an upgrade is measured against. */
  defaults: NavOrder
}

const html = document.documentElement

/** A preference, read with its default. Absent means on for icons; off for the other two. */
const flag = (key: string, whenAbsent: boolean): boolean => {
  try {
    const v = localStorage.getItem(key)
    return v === null ? whenAbsent : v === '1'
  } catch {
    // Private mode, or storage switched off. A rail with no memory is still a rail.
    return whenAbsent
  }
}

const remember = (key: string, on: boolean): void => {
  try { localStorage.setItem(key, on ? '1' : '0') } catch { /* see `flag` */ }
}

const attr = (name: string, on: boolean): void => html.setAttribute(`data-rail-${name}`, on ? '1' : '0')
const isOn = (name: string): boolean => html.getAttribute(`data-rail-${name}`) === '1'

/**
 * The rail's width, published as `--admin-nav-w` so fixed chrome can offset past it.
 *
 * The settings screen's save bar is positioned off this number, so a rail that is 16rem wide
 * while the variable still says 13 puts that bar 48px into the rail it is supposed to clear.
 */
function publishWidth(): void {
  const w = isOn('collapsed') ? RAIL_WIDTH.shut : isOn('arranging') ? RAIL_WIDTH.arranging : RAIL_WIDTH.open
  html.style.setProperty('--admin-nav-w', w)
}

/**
 * Every row's tooltip, which exists only while the rail is shut.
 *
 * A collapsed row is a glyph, so the word has to be somewhere; an OPEN row already shows its
 * label and a tooltip repeating it is noise under the cursor. Read off the label that is in
 * the markup rather than from a second copy in an attribute — one string, one place.
 */
function syncTooltips(): void {
  const shut = isOn('collapsed')
  for (const row of document.querySelectorAll<HTMLElement>('#admin-rail .rail-row')) {
    const label = row.querySelector('.rail-label')?.textContent?.trim()
    if (!label) continue
    if (shut) row.setAttribute('title', label)
    else row.removeAttribute('title')
  }
}

/**
 * The collapse control, and the band that overrides it.
 *
 * ONE place decides the rail's width, so the stored value and the media query cannot race.
 *
 * The band FORCES, it does not save: the stored value is the owner saying what they want, and
 * a window that happens to be 1100px wide is not them saying anything. Leaving the band puts
 * their own choice back. Clicking the control inside the band still persists, because that IS
 * them changing their mind.
 */
function wireCollapse(words: RailWords): void {
  const band = matchMedia(NARROW)
  const apply = (): void => {
    attr('collapsed', band.matches || flag(RAIL_KEYS.collapsed, false))
    publishWidth()
    syncTooltips()
    label()
  }
  const key = document.querySelector<HTMLElement>('[data-rail-key="collapse"]')
  const label = (): void => {
    if (!key) return
    const word = isOn('collapsed') ? words.navExpand : words.navCollapse
    key.setAttribute('aria-label', word)
    key.setAttribute('title', word)
  }
  band.addEventListener('change', apply)
  key?.addEventListener('click', () => {
    const next = !isOn('collapsed')
    remember(RAIL_KEYS.collapsed, next)
    attr('collapsed', next)
    publishWidth()
    syncTooltips()
    label()
  })
  apply()
}

/** The glyphs beside the labels, and the group that folds the rest of the rail out. */
function wireSwitches(): void {
  document.querySelector('[data-rail-key="icons"]')?.addEventListener('click', () => {
    const next = !isOn('icons')
    remember(RAIL_KEYS.icons, next)
    attr('icons', next)
  })
  // BOTH copies: the sticky column and the phone's drawer draw the same group row, and the
  // preference is one preference. A listener bound to the first match left the drawer's copy
  // dead, which is the shape of bug that only shows up on a phone.
  for (const row of document.querySelectorAll<HTMLElement>('[data-rail-id="more"]')) {
    row.addEventListener('click', () => {
      const next = !isOn('more')
      remember(RAIL_KEYS.more, next)
      attr('more', next)
      for (const r of document.querySelectorAll('[data-rail-id="more"]')) r.setAttribute('aria-expanded', String(next))
    })
  }
}

/**
 * Arriving inside the group opens it, for this visit only.
 *
 * A rail that hides the page you are on tells you nothing about where you are. It is never
 * WRITTEN, though: only the owner's own click on the row records a preference, so a visit to
 * Settings does not decide what the rail looks like tomorrow.
 */
function openGroupIfHere(): void {
  if (document.querySelector('.rail-group [aria-current="page"]')) {
    attr('more', true)
    for (const r of document.querySelectorAll('[data-rail-id="more"]')) r.setAttribute('aria-expanded', 'true')
  }
}

/** A popover: the owner's menu, or the theme list. One open at a time, Escape closes. */
function wireMenus(): void {
  const close = (): void => {
    for (const m of document.querySelectorAll<HTMLElement>('[data-rail-menu]')) m.hidden = true
    for (const b of document.querySelectorAll('[data-nav-owner], [data-rail-key="theme"]')) b.setAttribute('aria-expanded', 'false')
  }
  const open = (name: string, trigger: Element): void => {
    const menu = trigger.parentElement?.querySelector<HTMLElement>(`[data-rail-menu="${name}"]`)
    if (!menu) return
    const was = !menu.hidden
    close()
    menu.hidden = was
    trigger.setAttribute('aria-expanded', String(!was))
  }
  for (const b of document.querySelectorAll('[data-nav-owner]')) b.addEventListener('click', (e) => { e.stopPropagation(); open('owner', b) })
  for (const b of document.querySelectorAll('[data-rail-key="theme"]')) b.addEventListener('click', (e) => { e.stopPropagation(); open('theme', b) })
  // On the DOCUMENT, not on a scrim element: a scrim that covers the page to catch one click
  // is a thing in the tab order and in the accessibility tree, and it was `aria-hidden` and
  // focusable at the same time — the shape axe calls `aria-hidden-focus`.
  document.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement | null)?.closest('[data-rail-menu]')) close()
  })
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close() })
}

/** Light / Dark / System / By time. Four modes, and the resolved answer is a class on <html>. */
function wireTheme(): void {
  const KEY = 'theme'
  const read = (): string => { try { return localStorage.getItem(KEY) ?? 'system' } catch { return 'system' } }
  const night = (): boolean => { const h = new Date().getHours(); return h >= 18 || h < 6 }
  const resolve = (mode: string): boolean =>
    mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
    || (mode === 'time' && night())
  const paint = (): void => {
    const mode = read()
    html.classList.toggle('dark', resolve(mode))
    for (const b of document.querySelectorAll<HTMLElement>('[data-rail-theme]')) {
      const on = b.dataset.railTheme === mode
      b.querySelector<HTMLElement>('[data-rail-tick]')?.toggleAttribute('hidden', !on)
      b.classList.toggle('font-semibold', on)
      b.classList.toggle('text-neutral-900', on)
      b.classList.toggle('dark:text-white', on)
    }
  }
  for (const b of document.querySelectorAll<HTMLElement>('[data-rail-theme]')) {
    b.addEventListener('click', () => {
      try { localStorage.setItem(KEY, b.dataset.railTheme ?? 'system') } catch { /* see `flag` */ }
      paint()
    })
  }
  // The two modes that change on their own: the OS switching, and the clock crossing 18:00.
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (read() === 'system') paint() })
  setInterval(() => { if (read() === 'time') paint() }, 60_000)
  paint()
}

/** A message in the admin's own toast. An EVENT, so this file need not know React exists. */
const say = (message: string, kind: 'success' | 'error' = 'success'): void => {
  window.dispatchEvent(new CustomEvent('quire:toast', { detail: { message, kind } }))
}

/** The two footer controls that talk to the server. */
function wireActions(words: RailWords): void {
  const cache = document.querySelectorAll<HTMLButtonElement>('[data-rail-key="cache"]')
  for (const b of cache) {
    b.addEventListener('click', async () => {
      if (b.disabled) return
      for (const other of cache) other.disabled = true
      try {
        const res = await fetch('/api/cache/clear', { method: 'POST' })
        const json = await res.json() as { success?: boolean }
        say(json.success ? words.cacheCleared : words.clearCacheFailed, json.success ? 'success' : 'error')
      } catch {
        say(words.clearCacheFailed, 'error')
      } finally {
        for (const other of cache) other.disabled = false
      }
    })
  }
  for (const b of document.querySelectorAll('[data-rail-key="signout"]')) {
    b.addEventListener('click', async () => {
      await fetch('/api/auth/logout', { method: 'POST' })
      location.href = '/'
    })
  }
  // The palette is still React's, and it already opened on a window event before this file
  // existed (`CommandPalette.tsx` › PALETTE_EVENT) — so this is not a bridge, it is the door
  // that was always there. The name is written out rather than imported: importing it would
  // pull the palette, and everything it imports, into an island that has to be small.
  for (const b of document.querySelectorAll('[data-nav-search]')) {
    b.addEventListener('click', () => { closeDrawer(); window.dispatchEvent(new Event('quireink:palette')) })
  }
}

/** The phone's drawer: a sheet under the top bar, and the scrim behind it. */
function closeDrawer(): void {
  html.removeAttribute('data-rail-open')
  for (const el of document.querySelectorAll<HTMLElement>('[data-rail-drawer], [data-rail-scrim]')) el.hidden = true
  document.querySelector('[data-rail-key="drawer"]')?.setAttribute('aria-expanded', 'false')
}

function wireDrawer(): void {
  const button = document.querySelector<HTMLElement>('[data-rail-key="drawer"]')
  button?.addEventListener('click', () => {
    const open = !html.hasAttribute('data-rail-open')
    html.toggleAttribute('data-rail-open', open)
    for (const el of document.querySelectorAll<HTMLElement>('[data-rail-drawer], [data-rail-scrim]')) el.hidden = !open
    button.setAttribute('aria-expanded', String(open))
  })
  document.querySelector('[data-rail-scrim]')?.addEventListener('click', closeDrawer)
  // Picking a destination closes it: a drawer left open over the page you just asked for is
  // the page you asked for, hidden.
  for (const a of document.querySelectorAll('[data-rail-drawer] a')) a.addEventListener('click', closeDrawer)
}

/**
 * A rail link, handed to whoever is rendering the page.
 *
 * ⚠️ TEMPORARY, and it has an end date: it exists only while some of the admin's SCREENS are
 * still a React application behind a client router. Measured on 2026-09-14, a click that
 * reloads the page costs 341ms against 4ms for a client navigation, because a reload re-boots
 * React, its route chunk, the shell call and the screen's own fetch. Once every screen is a
 * page that cost is gone — a server-rendered admin page reaches its heading in 17ms — and so is
 * this function; deleting the listener in `router.tsx` is the whole removal.
 *
 * ⚠️ THE RAIL'S LINKS ONLY, and widening it to every `/admin` anchor was tried and reverted on
 * 2026-09-14. The dashboard is made of links — five number tiles, four card links, the pick-up
 * chips, the needs-attention rows — and as plain anchors every one is a full reload where
 * React's `Link` was instant. Widening the selector buys nothing: `router.tsx` declines any
 * navigation FROM a server-drawn page, because React renders no route on one and so has nothing
 * to swap. That cost is inherent to the half-converted state and leaves with the last screen,
 * which is the same end date this whole function has.
 *
 * A CANCELABLE EVENT rather than a global, so there is nothing to clean up and nothing to
 * check: if the router is mounted it calls `preventDefault`, and if it is not, the browser
 * does what it was always going to do.
 */
function wireNavigation(): void {
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    const link = (e.target as HTMLElement | null)?.closest<HTMLAnchorElement>('#admin-rail a, [data-rail-drawer] a')
    const href = link?.getAttribute('href')
    if (!link || !href || link.target === '_blank' || !href.startsWith('/admin')) return
    const taken = !window.dispatchEvent(new CustomEvent('quire:navigate', { detail: { href }, cancelable: true }))
    if (taken) e.preventDefault()
  })
}

/** Arrange mode, fetched on the way in. ~9 KB nobody downloads unless they open it. */
function wireArrange(data: RailData): void {
  for (const b of document.querySelectorAll('[data-nav-arrange="off"]')) {
    b.addEventListener('click', async () => {
      for (const m of document.querySelectorAll<HTMLElement>('[data-rail-menu]')) m.hidden = true
      const { enterArrangeMode } = await import('./rail-arrange')
      enterArrangeMode(data, publishWidth)
    })
  }
}

function read(): RailData | null {
  const tag = document.getElementById('admin-rail-data')?.textContent
  if (!tag) return null
  try { return JSON.parse(tag) as RailData } catch { return null }
}

/**
 * THE FOURTH BRIDGE, and the first that answers back.
 *
 * `quire:pick-media` asks for a picture. Whatever is asking — a React editor, a React settings
 * card, and later a server-drawn screen — dispatches it with the words it wants the overlay to
 * say and a callback to answer on; the overlay is `island/lib/media-picker.ts`.
 *
 * It listens HERE because this island is the one that loads on every admin page, and it imports
 * the overlay only when the event arrives: a page that never opens a picker never downloads one.
 * The listener is registered whether or not the picker has been loaded, so the first ask is not
 * the one that gets lost.
 */
function wirePicker(): void {
  window.addEventListener('quire:pick-media', (e) => {
    const detail = (e as CustomEvent).detail as { respond?: (answer: unknown) => void } | undefined
    if (typeof detail?.respond !== 'function') return
    // Says "heard", the way the navigate bridge does: the asker resolves `null` if nothing
    // cancels, so a page whose island failed to load never awaits a promise that cannot settle.
    e.preventDefault()
    void import('./lib/media-picker')
      .then((mod) => mod.openPicker(detail as never))
      // A chunk that will not load must not leave the screen waiting on a callback that never
      // comes: answering `null` is the same thing as the owner closing it.
      .catch(() => detail.respond?.(null))
  })
}

export function startRail(): void {
  // Before the early return: the picker is asked for by screens that have nothing to do with
  // the rail, and a page without rail data still has editors on it.
  wirePicker()
  const data = read()
  if (!data || !document.getElementById('admin-rail')) return
  attr('icons', flag(RAIL_KEYS.icons, true))
  attr('more', flag(RAIL_KEYS.more, false))
  openGroupIfHere()
  wireCollapse(data.words)
  wireSwitches()
  wireMenus()
  wireTheme()
  wireActions(data.words)
  wireDrawer()
  wireNavigation()
  wireArrange(data)
}

startRail()
