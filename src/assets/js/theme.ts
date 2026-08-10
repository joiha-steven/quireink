// Light / dark / system / by-time, and the drawer that holds the sidebar on a phone.
//
// Two controls, one file, because both do the same thing: flip one attribute on `<html>`
// and let CSS do the rest. Neither re-renders anything.
//
// THE FIRST PAINT IS THE STYLESHEET'S, NOT THIS FILE'S. The frozen tree applied the saved
// mode in a pre-paint inline script; 2.0 has no inline script anywhere — that property is
// tested, and the article page's script count is a number in an assertion — so for the
// length of one paint the page is whatever CSS alone can decide. A cookie would let the
// server decide instead, but the page cache is keyed by URL alone (Invariant 1), so a
// cached page would carry whichever mode the first visitor happened to have.
//
// So CSS decides it, with a `prefers-color-scheme` block that applies only while `<html>`
// has no `data-scheme` (`content/themes.ts`), and this file's job is to set that attribute —
// which both hands over from the media query and records the reader's actual choice. A
// system-dark reader on the default mode now opens dark on the first frame; it was a white
// flash on every navigation.
//
// `data-scheme` is the RESOLVED light/dark, never the mode: 'system' and 'time' are questions,
// and the attribute has to be an answer or the CSS cannot use it.

import { el, label } from './dom'

const STORAGE_KEY = 'theme'

type Mode = 'light' | 'dark' | 'system' | 'time'

const MODES: Mode[] = ['light', 'dark', 'system', 'time']
const LABEL: Record<Mode, string> = {
  light: 'themeLight', dark: 'themeDark', system: 'themeSystem', time: 'themeTime',
}

const read = (): Mode => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return MODES.includes(saved as Mode) ? (saved as Mode) : 'system'
  } catch {
    return 'system' // storage can be denied; the choice is then simply not remembered
  }
}

/** Resolve a mode to an actual light or dark. "Time" is dark from 18:00 to 06:00. */
function resolve(mode: Mode): 'light' | 'dark' {
  if (mode === 'light' || mode === 'dark') return mode
  if (mode === 'system') {
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  const h = new Date().getHours()
  return h >= 18 || h < 6 ? 'dark' : 'light'
}

const SUN = 'M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2'
  + 'M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4'
const MOON = 'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z'

/** Repaint the button's glyph to match what the reader is actually looking at. */
function drawIcon(button: HTMLElement, dark: boolean): void {
  const svg = button.querySelector('svg')
  if (!svg) return
  svg.innerHTML = dark
    ? `<path d="${MOON}"/>`
    : `<circle cx="12" cy="12" r="4"/><path d="${SUN}"/>`
}

export function theme(): void {
  const button = document.querySelector<HTMLButtonElement>('[data-theme-toggle]')
  if (!button) return

  let mode = read()
  let watching: (() => void) | undefined

  const apply = () => {
    const dark = resolve(mode) === 'dark'
    const html = document.documentElement
    html.classList.toggle('dark', dark)
    // Setting this is what takes the `prefers-color-scheme` block out of the cascade, so it
    // has to happen on the FIRST apply and not only when the reader picks something — until
    // it exists the sheet is still answering the question on its own.
    html.dataset.scheme = dark ? 'dark' : 'light'
    drawIcon(button, dark)
  }

  // The dynamic modes have to keep watching: the OS can flip under "system", and the
  // clock crosses 18:00 under "time" while the page is still open.
  const track = () => {
    watching?.()
    watching = undefined
    if (mode === 'system') {
      const mq = matchMedia('(prefers-color-scheme: dark)')
      const onChange = () => apply()
      mq.addEventListener('change', onChange)
      watching = () => mq.removeEventListener('change', onChange)
    } else if (mode === 'time') {
      const id = setInterval(apply, 60_000)
      watching = () => clearInterval(id)
    }
  }

  apply()
  track()

  // The menu is built once and shown on demand. Its rows carry the same server-translated
  // labels as everything else, so this file holds no language of its own.
  //
  // A GROUP OF BUTTONS, not `role="menu"`. Which mode is current was marked by a class, and
  // the tick beside it is drawn by CSS — so a reader using a screen reader heard four
  // identical buttons and no way to tell which one they were already on. `aria-pressed` is
  // the honest fix: these are toggle buttons and they behave like toggle buttons. Declaring
  // `role="menu"` would promise arrow-key navigation that this widget does not implement,
  // which is worse than plain buttons rather than better.
  const menu = el('div', { class: 'theme-menu', role: 'group', 'aria-label': label('theme'), hidden: '' })
  for (const m of MODES) {
    const row = el('button', { type: 'button', 'data-mode': m, 'aria-pressed': 'false' }, label(LABEL[m]))
    row.addEventListener('click', () => {
      mode = m
      try {
        localStorage.setItem(STORAGE_KEY, m)
      } catch {
        /* ignore */
      }
      apply()
      track()
      mark()
      close()
    })
    menu.append(row)
  }
  const mark = () => {
    for (const row of menu.querySelectorAll<HTMLElement>('button')) {
      const current = row.dataset.mode === mode
      row.classList.toggle('is-current', current)
      // The class draws the tick; this is the half a screen reader can hear.
      row.setAttribute('aria-pressed', String(current))
    }
  }
  mark()

  const wrap = el('div', { class: 'theme-wrap' })
  button.replaceWith(wrap)
  wrap.append(button, menu)

  const close = () => {
    menu.hidden = true
    button.setAttribute('aria-expanded', 'false')
  }
  // `aria-haspopup="true"` and the initial `aria-expanded="false"` are in the markup
  // (`web/chrome.ts`): they never change, and the reader's bundle is budgeted in bytes.
  button.addEventListener('click', (e) => {
    e.stopPropagation() // otherwise the document handler below shuts it in the same tick
    menu.hidden = !menu.hidden
    button.setAttribute('aria-expanded', String(!menu.hidden))
  })
  document.addEventListener('click', close)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close()
  })
}

/**
 * The mobile opener for the sidebar drawer. Open state lives on `<html data-rail>`, so the
 * drawer and its scrim react in pure CSS.
 */
export function rail(): void {
  const button = document.querySelector<HTMLButtonElement>('[data-rail-toggle]')
  if (!button) return
  // A page with no rail — an article with no table of contents, /search, a 404 — would
  // open nothing, so the button removes itself rather than sitting there dead.
  if (!document.querySelector('.rail')) {
    button.hidden = true
    return
  }

  const html = document.documentElement
  const set = (open: boolean) => {
    if (open) html.dataset.rail = 'open'
    else delete html.dataset.rail
    button.setAttribute('aria-expanded', String(open))
    scrim.hidden = !open
  }

  const scrim = el('div', { class: 'rail-scrim', hidden: '', 'aria-hidden': 'true' })
  document.body.append(scrim)
  scrim.addEventListener('click', () => set(false))
  button.addEventListener('click', () => set(html.dataset.rail !== 'open'))
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') set(false)
  })
}
