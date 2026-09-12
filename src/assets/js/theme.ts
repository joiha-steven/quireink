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

/**
 * What the page opens in when the reader has never chosen: the OWNER's default, off
 * `<body data-default-scheme>` — 'system', 'light' or 'dark'.
 *
 * The stylesheet has already painted this same answer (`content/themes.ts` emits the
 * matching rule), so reading it here is what keeps the island from overruling the paint it
 * just inherited: without it a blog set to dark flashed dark and then snapped to light the
 * moment this module ran, because the island's own fallback was hardcoded 'system'.
 *
 * A reader's saved pick still wins — it is checked first, and nothing about it changed.
 */
const houseDefault = (): Mode => {
  const v = document.body.dataset.defaultScheme
  return v === 'light' || v === 'dark' ? v : 'system'
}

const read = (): Mode => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return MODES.includes(saved as Mode) ? (saved as Mode) : houseDefault()
  } catch {
    return houseDefault() // storage can be denied; the choice is then simply not remembered
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

const MOON = 'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z'
/**
 * The sun, KEPT rather than redrawn: whatever the server put in the button is captured on
 * the first pass and put back when the reader returns to light.
 *
 * This file used to carry its own copy of the sun's path, which made two drawings of one
 * icon in two files, and they had already drifted — the set's sun (`src/icons.ts`) carried
 * an eight-ray disc and an echo stroke, this one an eight-ray disc and no echo, so the glyph
 * changed under the reader the moment the bundle ran. Keeping the server's markup means the
 * icon set is the single place a shape is drawn, which is that file's whole premise, and it
 * takes fewer bytes out of a budget measured in bytes than the duplicate path did.
 */
let sun = ''

/** Repaint the button's glyph to match what the reader is actually looking at. */
function drawIcon(button: HTMLElement, dark: boolean): void {
  const svg = button.querySelector('svg')
  if (!svg) return
  if (!sun) sun = svg.innerHTML
  svg.innerHTML = dark ? `<path d="${MOON}"/>` : sun
}

/**
 * A header button that opens a menu of choices, one of which is current.
 *
 * Shared by the theme and palette controls, which are the same widget twice: a button, a list
 * of rows, a tick on the current one, one attribute on `<html>`. Written once because the
 * reader's bundle is budgeted in bytes and a second copy of the open/close/mark/dismiss logic
 * costs about as much as the palette feature itself. Returns `mark`, so a caller whose current
 * value can change from outside the menu — `system` follows the OS — can re-tick the rows.
 *
 * ⚠️ A GROUP OF BUTTONS, not `role="menu"`. Current was marked by a class and the tick drawn in
 * CSS, so a screen-reader user heard identical buttons with no way to tell which. `aria-pressed`
 * is the honest fix: these are toggle buttons and behave like them. `role="menu"` would promise
 * arrow-key navigation this widget does not implement, which is worse than plain buttons.
 */
/**
 * Every dropdown's `close`, so opening one shuts the others. Found by clicking the header, not
 * by a test: both controls sit at the same corner of the same row and each stopped its click
 * from reaching the document handler, so both menus could be open at once, overlapping.
 * Neither was wrong on its own — the bug only exists once there are two.
 */
const closers: (() => void)[] = []

function dropdown(
  button: HTMLElement,
  name: string,
  rows: { id: string; text: string }[],
  currentId: () => string,
  pick: (id: string) => void,
): () => void {
  // `.theme-menu` and `.theme-wrap` for both, deliberately: the palette menu is the same
  // object at the same corner of the same button, and a second set of rules would be two
  // definitions of one look. Nothing about those class names is theme-specific but the word.
  const menu = el('div', { class: 'theme-menu', role: 'group', 'aria-label': label(name), hidden: '' })
  const mark = () => {
    for (const row of menu.querySelectorAll<HTMLElement>('button')) {
      const current = row.dataset.id === currentId()
      row.classList.toggle('is-current', current)
      row.setAttribute('aria-pressed', String(current))
    }
  }
  for (const r of rows) {
    const row = el('button', { type: 'button', 'data-id': r.id, 'aria-pressed': 'false' }, r.text)
    row.addEventListener('click', () => {
      pick(r.id)
      mark()
      close()
    })
    menu.append(row)
  }
  mark()

  const wrap = el('div', { class: 'theme-wrap' })
  button.replaceWith(wrap)
  wrap.append(button, menu)

  // Closing puts focus back on the button that opened it, and only when it was inside the
  // menu: picking a row or pressing Escape used to leave focus on an element about to become
  // `hidden`, so it fell to `<body>` and the next Tab started again from the top of the page.
  // The `contains` check is what keeps the document-level closers from stealing focus off
  // whatever the reader is actually on.
  const close = () => {
    const inside = menu.contains(document.activeElement)
    menu.hidden = true
    button.setAttribute('aria-expanded', 'false')
    if (inside) button.focus()
  }
  closers.push(close)
  // `aria-haspopup="true"` and the initial `aria-expanded="false"` are in the markup
  // (`web/chrome.ts`): they never change, and the reader's bundle is budgeted in bytes.
  button.addEventListener('click', (e) => {
    e.stopPropagation() // otherwise the document handler below shuts it in the same tick
    const opening = menu.hidden
    // Shut everything, including this one, then open this one. Cheaper in bytes than tracking
    // which menu is open, and it makes "only one at a time" true by construction.
    for (const shut of closers) shut()
    if (opening) {
      menu.hidden = false
      button.setAttribute('aria-expanded', 'true')
    }
  })
  document.addEventListener('click', close)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close()
  })
  return mark
}

/**
 * The reader's palette, when the owner has enabled more than one.
 *
 * The ids and their translated names arrive on the button as `id:Name|id:Name`, so this file
 * carries no locale table and no list of palettes — the same rule as every other string a
 * script shows. The owner's own default is named separately, because `enabledPalettes` keeps
 * the picker's display order and the default is not necessarily first in it.
 *
 * Setting `data-palette` unconditionally is safe because of what `content/themes.ts` emits:
 * per-palette rules exist exactly when two or more are enabled, which is exactly when this
 * control renders — including a block for the default's own id, so a reader who switches away
 * and back has something to come back to.
 *
 * NOT server-rendered, and it cannot be: the page cache is keyed by URL alone (Invariant 1),
 * so a palette baked into the HTML would be whichever one the first visitor had chosen.
 */
export function palette(): void {
  const button = document.querySelector<HTMLButtonElement>('[data-palettes]')
  if (!button) return
  const rows = (button.dataset.palettes ?? '').split('|').filter(Boolean).map((pair) => {
    const at = pair.indexOf(':')
    return { id: pair.slice(0, at), text: pair.slice(at + 1) }
  })
  // The server only renders the button above two, but a reader is not the only caller of a
  // page and a one-row menu is a dead control.
  if (rows.length < 2) return

  const fallback = button.dataset.paletteDefault ?? rows[0]!.id
  let current = fallback
  try {
    const saved = localStorage.getItem('palette')
    if (saved && rows.some((r) => r.id === saved)) current = saved
  } catch {
    /* storage can be denied; the choice is then simply not remembered */
  }

  const apply = () => {
    document.documentElement.dataset.palette = current
  }
  apply()

  dropdown(button, 'palette', rows, () => current, (id) => {
    current = id
    try {
      localStorage.setItem('palette', id)
    } catch {
      /* ignore */
    }
    apply()
  })
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

  // The rows carry the same server-translated labels as everything else, so this file holds
  // no language of its own.
  dropdown(button, 'theme', MODES.map((m) => ({ id: m, text: label(LABEL[m]) })), () => mode, (id) => {
    mode = id as Mode
    try {
      localStorage.setItem(STORAGE_KEY, id)
    } catch {
      /* ignore */
    }
    apply()
    track()
  })
}

/**
 * The mobile opener for the sidebar drawer. Open state lives on `<html data-rail>`, so the
 * drawer and its scrim react in pure CSS.
 */
export function rail(): void {
  const button = document.querySelector<HTMLButtonElement>('[data-rail-toggle]')
  if (!button) return
  // The drawer is the LAST rail, not the first. A two-rail listing renders `.rail-left`
  // (the discovery blocks) before `.rail-right`, and below the breakpoint the left one is
  // `display:none` while the right one is the drawer. Taking the first match sent focus
  // into a hidden subtree, where `focus()` does nothing: on a two-rail site the drawer
  // opened and the keyboard stayed behind it, and Escape restored nothing.
  //
  // A page with no rail — an article with no table of contents, /search, a 404 — would open
  // nothing, so the button removes itself rather than sitting there dead.
  const rails = document.querySelectorAll<HTMLElement>('.rail')
  const rail = rails[rails.length - 1]
  if (!rail) {
    button.hidden = true
    return
  }

  const html = document.documentElement
  // A dialog, said out loud: without this the drawer was an `<aside>` that happened to be
  // on top, and a screen reader walked straight past it into the page behind.
  rail.setAttribute('role', 'dialog')
  rail.setAttribute('aria-modal', 'true')
  rail.id ||= 'site-rail'
  button.setAttribute('aria-controls', rail.id)
  const set = (open: boolean) => {
    const was = html.dataset.rail === 'open'
    if (open) html.dataset.rail = 'open'
    else delete html.dataset.rail
    button.setAttribute('aria-expanded', String(open))
    scrim.hidden = !open
    // Focus goes where the drawer goes. Opening it left focus on the menu button, so the
    // next Tab landed on the palette control behind the drawer rather than on the first
    // link inside it; closing it with Escape while a link was focused dropped focus on the
    // body, because the closed drawer is visibility:hidden and a hidden element cannot keep
    // it. The button is the place a keyboard user was before the drawer opened.
    if (open) rail.querySelector<HTMLElement>('a[href],button')?.focus()
    else if (was && rail.contains(document.activeElement)) button.focus()
  }

  const scrim = el('div', { class: 'rail-scrim', hidden: '', 'aria-hidden': 'true' })
  document.body.append(scrim)
  scrim.addEventListener('click', () => set(false))
  button.addEventListener('click', () => set(html.dataset.rail !== 'open'))
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && html.dataset.rail === 'open') set(false)
  })
}
