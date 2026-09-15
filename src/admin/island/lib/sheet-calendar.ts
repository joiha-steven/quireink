// THE PUBLISH DATE: a box you type into, and a grid for when you would rather point.
//
// The box is drawn by the server (`screens/sheet-fields.ts`); the GRID is built here, and it is
// the one control on the attributes panel that is not in the markup. That is not an exception
// made for convenience: forty-two cells that change every month, for a popover most visits never
// open, is markup that would be wrong by the time anybody saw it.
//
// ⚠️ TYPING IS THE PRIMARY DOOR. It was a button that opened this grid and nothing else, and the
// grid's only way to another month was the pair of arrows at its top: nine clicks to next March,
// twelve to correct a year. `admin-shared/date-typing.ts` holds the reading of what is typed —
// and holds the reason the day/month order is ASKED of `Intl` rather than tabulated.
import type { SheetWords } from '@/admin-shared/sheet-wire'
import type { SiteLang } from '@/types'
import { dateLocale } from '@/i18n/format'
import { formatTyped, parseTyped, toValue } from '@/admin-shared/date-typing'
import { el } from '@/admin/components/node-dom'

const className = {
  pop: 'absolute z-30 mt-1 w-72 rounded-lg border border-neutral-200 bg-white p-3 shadow-lg'
    + ' dark:border-neutral-700 dark:bg-neutral-900',
  head: 'mb-2 flex items-center justify-between',
  month: 'px-1 text-sm font-medium',
  nav: 'grid h-8 w-8 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100'
    + ' hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white',
  week: 'grid grid-cols-7 text-center text-xs text-neutral-500 dark:text-neutral-400',
  initial: 'py-1',
  grid: 'grid grid-cols-7',
  day: 'grid h-8 place-items-center rounded-lg text-sm tabular-nums',
  dayPicked: 'bg-neutral-900 font-medium text-white dark:bg-white dark:text-neutral-900',
  dayIn: 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800',
  dayOut: 'text-neutral-300 hover:bg-neutral-100 dark:text-neutral-600 dark:hover:bg-neutral-800',
  today: 'ring-1 ring-inset ring-neutral-300 dark:ring-neutral-600',
  foot: 'mt-2 flex items-center justify-between gap-2 border-t border-neutral-100 pt-2.5'
    + ' dark:border-neutral-800',
  time: 'w-28 tabular-nums',
  quick: 'text-xs text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white',
  quicks: 'flex items-center gap-3',
}

const pad = (n: number): string => String(n).padStart(2, '0')

/** Monday-first weekday initials, from Intl rather than an i18n table of seven times eleven. */
function initials(lang: SiteLang): string[] {
  const fmt = new Intl.DateTimeFormat(dateLocale(lang), { weekday: 'narrow' })
  // 2024-01-01 is a Monday; six more days follow it.
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2024, 0, 1 + i)))
}

const sameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

export type DateField = {
  /** Push a value in from outside — a revision loaded, a draft restored. */
  setValue: (next: string) => void
  destroy: () => void
}

/**
 * Wire one date field.
 *
 * `onPick` is handed the stored shape (`YYYY-MM-DDTHH:mm`, a wall clock on the SITE's zone) and
 * is NOT called for half a date: the parser answers null until it is sure, and null means the
 * stored value is left alone, so typing over a good date never destroys it on the way to the
 * next one.
 */
export function wireDate(
  root: HTMLElement, t: SheetWords, lang: SiteLang, value: string,
  onPick: (next: string) => void, control: string,
): DateField {
  const box = root.querySelector<HTMLInputElement>('[data-date-box]')
  const opener = root.querySelector<HTMLButtonElement>('[data-date-open]')
  if (!box || !opener) return { setValue: () => {}, destroy: () => {} }

  let held = value
  let pop: HTMLElement | null = null
  let view = new Date()

  const shownDate = (): Date => {
    const at = held ? new Date(held) : new Date()
    return Number.isNaN(at.getTime()) ? new Date() : at
  }

  /**
   * Store a value and tell the sheet about it.
   *
   * ⚠️ `redraw` IS NOT AN OPTIMISATION. `draw()` replaces every child of the popover, so
   * calling it from a control INSIDE the popover destroys the element the writer is typing
   * into and the keyboard lands on `<body>`. That is the exact fault this whole field was
   * rebuilt to fix, arriving from the other side: type one digit into the publish time and the
   * caret is gone, so setting a time takes three attempts.
   *
   * The time and the two shortcuts do not move the GRID — a time is not a day, and a shortcut
   * writes the month it is moving to before it calls this — so there is nothing to draw again.
   * Typing in the BOX does move it, and the keyboard is not in the popover then.
   */
  const take = (next: string, redraw = true): void => {
    held = next
    onPick(next)
    if (pop && redraw) draw()
  }

  function draw(): void {
    if (!pop) return
    pop.replaceChildren()
    const picked = shownDate()
    const today = new Date()

    const head = el('div', { className: className.head })
    const label = el('span', { className: className.month })
    label.textContent = new Intl.DateTimeFormat(dateLocale(lang), { month: 'long', year: 'numeric' }).format(view)
    const keys = el('div', { className: 'flex' })
    for (const [step, name, path] of [
      [-1, t.dateMonthPrev, 'm14 6-6 6 6 6'], [1, t.dateMonthNext, 'm10 6 6 6-6 6'],
    ] as const) {
      const key = el('button', { className: className.nav, type: 'button', 'aria-label': name })
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      for (const [k, v] of Object.entries({
        viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8',
        'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', class: 'h-4 w-4',
      })) svg.setAttribute(k, v)
      svg.innerHTML = `<path d="${path}"></path>`
      key.appendChild(svg)
      key.addEventListener('click', () => { view = new Date(view.getFullYear(), view.getMonth() + step, 1); draw() })
      keys.appendChild(key)
    }
    head.append(label, keys)

    const week = el('div', { className: className.week })
    for (const name of initials(lang)) {
      const cell = el('span', { className: className.initial })
      cell.textContent = name
      week.appendChild(cell)
    }

    // A six-week grid, always, so the popover's height never jumps between months.
    const lead = (new Date(view.getFullYear(), view.getMonth(), 1).getDay() + 6) % 7
    const grid = el('div', { className: className.grid })
    for (let i = 0; i < 42; i++) {
      const day = new Date(view.getFullYear(), view.getMonth(), 1 - lead + i)
      const isPicked = held !== '' && sameDay(day, picked)
      const inMonth = day.getMonth() === view.getMonth()
      const cell = el('button', {
        className: `${className.day} ${isPicked ? className.dayPicked : inMonth ? className.dayIn : className.dayOut}`
          + (!isPicked && sameDay(day, today) ? ` ${className.today}` : ''),
        type: 'button',
      })
      cell.textContent = String(day.getDate())
      cell.addEventListener('click', () => {
        // The TIME is read now rather than from the value this grid was drawn with: the time
        // field below can change it without redrawing (see `take`), so a captured one is a
        // clock from before the writer touched it.
        const now = shownDate()
        const next = new Date(day)
        next.setHours(now.getHours(), now.getMinutes())
        box!.value = formatTyped(toValue(next), lang)
        take(toValue(next))
      })
      grid.appendChild(cell)
    }

    const foot = el('div', { className: className.foot })
    // The NATIVE time input keeps its text half only — no popup, so nothing blue.
    const time = el('input', { className: `${control} ${className.time}`, type: 'time', 'aria-label': t.dateTime })
    time.value = `${pad(picked.getHours())}:${pad(picked.getMinutes())}`
    time.addEventListener('input', () => {
      const [hh, mm] = time.value.split(':').map(Number)
      if (hh === undefined || mm === undefined || Number.isNaN(hh) || Number.isNaN(mm)) return
      const next = shownDate()
      next.setHours(hh, mm)
      box!.value = formatTyped(toValue(next), lang)
      take(toValue(next), false)
    })
    // TWO SHORTCUTS, and the second is the one a scheduler actually reaches for. "Now" answers
    // "publish this" in one click; a piece being QUEUED is almost always queued for a morning,
    // and picking tomorrow 9:00 out of the grid is three moves.
    const quicks = el('span', { className: className.quicks })
    for (const [name, make] of [
      [t.dateTomorrow, () => { const at = new Date(); at.setDate(at.getDate() + 1); at.setHours(9, 0, 0, 0); return at }],
      [t.dateNow, () => new Date()],
    ] as const) {
      const key = el('button', { className: className.quick, type: 'button' })
      key.textContent = name
      key.addEventListener('click', () => {
        const at = make()
        view = new Date(at.getFullYear(), at.getMonth(), 1)
        box!.value = formatTyped(toValue(at), lang)
        // A shortcut DOES move the grid, so this one draws again — and it is a click rather
        // than a keystroke, so there is no caret in the popover to lose.
        take(toValue(at))
      })
      quicks.appendChild(key)
    }
    foot.append(time, quicks)
    pop.append(head, week, grid, foot)
  }

  const shut = (): void => {
    pop?.remove()
    pop = null
    opener.setAttribute('aria-expanded', 'false')
  }
  const away = (e: MouseEvent): void => { if (!root.contains(e.target as Node)) shut() }
  // ⚠️ AND IT STOPS THERE. The panel listens for Escape on `window` and this listens on
  // `document`, so an unstopped key shuts the calendar AND the panel behind it — one press
  // taking away two things, when the writer meant to dismiss the grid and go on typing the
  // date. Events reach `document` before `window`, so this one gets to decide.
  const escape = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape' || !pop) return
    e.stopPropagation()
    shut()
  }

  opener.addEventListener('click', () => {
    if (pop) { shut(); return }
    const at = shownDate()
    view = new Date(at.getFullYear(), at.getMonth(), 1)
    pop = el('div', { className: className.pop })
    root.appendChild(pop)
    opener.setAttribute('aria-expanded', 'true')
    draw()
  })
  document.addEventListener('mousedown', away)
  document.addEventListener('keydown', escape)

  box.addEventListener('input', () => {
    const read = parseTyped(box.value, lang, new Date())
    box.setAttribute('aria-invalid', String(box.value.trim() !== '' && read === null))
    if (!read) return
    const at = new Date(read)
    view = new Date(at.getFullYear(), at.getMonth(), 1)
    take(read)
  })
  // Tidied on the way out, so what is in the box is always what would be typed back in.
  box.addEventListener('blur', () => { box.value = formatTyped(held, lang) })

  return {
    setValue: (next: string) => { held = next; box.value = formatTyped(next, lang); if (pop) draw() },
    destroy: () => {
      shut()
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', escape)
    },
  }
}
