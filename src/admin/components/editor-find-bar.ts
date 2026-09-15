// The find-and-replace bar: one strip at the top of the sheet, under the action line.
//
// IN THE SHEET'S OWN STACK rather than floating over the paper. The editor's contract already
// settled that question once for the toolbar (`docs/admin-editor.md`): a band hovering over a
// crack of page was rejected, and the reason applies twice over here, because a floating find
// box covers the very text the writer is looking at. This one pushes the writing down while it
// is open and takes the room back when it closes.
//
// IT KNOWS NOTHING ABOUT THE DOCUMENT. The two views underneath it have nothing in common — one
// is a ProseMirror document with positions, the other a textarea with a string — so this takes a
// TARGET: how many hits there are, which one is current, and four things to do. Both views can
// then be searched by the same strip with the same keys, which is the whole reason a writer can
// press the chord without first noticing which view they are in.
//
// ⚠️ PLAIN TYPESCRIPT (ADR 0054 step 5): the editor is a client-side application and builds its
// own chrome.
import type { SheetWords } from '@/admin-shared/sheet-wire'
import { buttonClass, CONTROL_CHROME } from '@/admin-shared/kit'
import { ICONS } from '@/icons'
import { el, svgGlyph } from './node-dom'

/** The five things the strip can ask for, and nothing about what it is searching. */
export type FindActions = {
  onQuery: (query: string, caseSensitive: boolean) => void
  onStep: (by: 1 | -1) => void
  onReplace: (replacement: string) => void
  onReplaceAll: (replacement: string) => void
  /** Put the caret back where the writer was. Called when the strip closes. */
  onClose: () => void
}

/**
 * The actions plus where the search has got to. The two counts arrive through `setCount` rather
 * than through this, because they change on every keystroke and the actions do not.
 */
export type FindTarget = FindActions & {
  /** How many hits the current query has. */
  count: number
  /** Which hit is current, 0-based. Meaningless when `count` is 0. */
  index: number
}

const className = {
  /**
   * A GRID, not two flex rows, and the reason is the one thing a reader notices first: two
   * stacked fields have to be the same width. Laid out as rows they are not — the controls after
   * them differ in width, so each input takes whatever is left and the two right edges land 18px
   * apart (measured at 1440). Three columns — the disclosure, the field, the controls — make
   * both fields exactly as wide as each other and both control groups start on the same line.
   * One column below `sm`, where there is no room.
   */
  strip: 'grid grid-cols-1 items-center gap-x-2 gap-y-1.5 border-b border-neutral-200/70'
    + ' bg-neutral-50/80 px-4 py-2 backdrop-blur-xl sm:grid-cols-[auto_1fr_auto]'
    + ' dark:border-neutral-800 dark:bg-neutral-950/60',
  /**
   * ONE BOX FOR EVERY CONTROL IN THE ROW, 32 square, and the count wears it too.
   *
   * It did not, and the row read as crooked: `Aa` was the row's inherited 14px against a 12px
   * count, the count sat in a 64px slot with its text ranged left so the space before the arrows
   * was twice the space after them, and three different heights met at `items-center` with
   * nothing to line up on. Same box, same type size, one gap.
   */
  iconKey: 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-neutral-600'
    + ' transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40'
    + ' dark:text-neutral-300 dark:hover:bg-neutral-800',
  head: 'justify-self-start',
  caseOn: 'bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100',
  caseSize: 'text-xs font-semibold',
  field: 'h-8 w-full min-w-0 px-2.5 py-1 text-sm',
  keys: 'flex items-center justify-end gap-1',
  // `tabular-nums` so "9 of 12" does not shuffle its own width into "10 of 12" while the writer
  // steps through.
  count: 'inline-flex h-8 min-w-20 shrink-0 items-center justify-center px-1 text-xs'
    + ' tabular-nums whitespace-nowrap text-neutral-500 dark:text-neutral-400',
  chevron: 'h-5 w-5',
  glyph: 'h-[var(--admin-glyph,1.25rem)] w-[var(--admin-glyph,1.25rem)] shrink-0',
  // An empty cell under the disclosure, so the replace field starts in the same column as the
  // find field above it.
  spacer: 'hidden sm:block',
}

export type FindBar = {
  /** The counts come from whichever view is being searched, and change as it is typed into. */
  setCount: (count: number, index: number) => void
  destroy: () => void
}

export type FindBarHooks = {
  t: SheetWords
  target: FindActions
  /**
   * Whether the replace row starts open.
   *
   * TWO CHORDS, one strip: `Mod-f` is looking for something and `Mod-Shift-f` is changing it,
   * and most of the time it is the first. A replace field that is always there is a field that
   * is usually in the way — and, worse, a second empty box under the cursor while somebody is
   * only reading is an invitation to type into the wrong one.
   */
  withReplace: boolean
  /**
   * How tall the strip is, so the toolbar under it can stick BELOW rather than behind.
   *
   * Reported rather than assumed: this strip wraps to three rows in the locales with the longest
   * labels and on a phone, and the toolbar's sticky offset is already a measured number for
   * exactly that reason. A constant here would be right on English at 1440 and wrong everywhere
   * else. Reported as 0 on the way out, so the toolbar takes its room back at once.
   */
  onHeight: (px: number) => void
}

export function mountFindBar(host: HTMLElement, hooks: FindBarHooks): FindBar {
  const { t, target } = hooks
  let query = ''
  let caseSensitive = false
  let count = 0
  let index = 0

  const strip = el('div', { className: className.strip, role: 'search', 'aria-label': t.findFind, 'data-find-bar': '' })

  const iconKey = (label: string, body: string, act: () => void, cls = ''): HTMLButtonElement => {
    const button = el('button', {
      className: `${className.iconKey} ${cls}`.trim(), type: 'button', title: label, 'aria-label': label,
    })
    button.appendChild(svgGlyph(body, className.glyph))
    button.addEventListener('click', act)
    return button
  }

  // At the HEAD of the strip, which is where this control lives in every editor that has one,
  // and where it reads as "there is more of this" rather than as an action.
  let replacing = hooks.withReplace
  const disclose = el('button', {
    className: `${className.iconKey} ${className.head}`, type: 'button',
    title: t.findReplace, 'aria-label': t.findReplace,
  })
  const chevron = svgGlyph(ICONS.next, className.chevron)
  chevron.style.transition = 'transform 140ms'
  disclose.appendChild(chevron)

  const find = el('input', { className: `${CONTROL_CHROME} ${className.field}`, 'aria-label': t.findFind, placeholder: t.findFind })
  const keys = el('div', { className: className.keys })

  // `aria-pressed` rather than a checkbox: it is a switch on a toolbar, and a checkbox here
  // would want a label beside it and take the row to two lines on a phone.
  const matchCase = el('button', {
    className: `${className.iconKey} ${className.caseSize}`, type: 'button',
    title: t.findMatchCase, 'aria-label': t.findMatchCase,
  })
  matchCase.textContent = 'Aa'
  // `aria-live`, because the count is the only answer a screen reader gets to the question that
  // was just typed.
  const counted = el('span', { className: className.count, 'aria-live': 'polite' })
  const prev = iconKey(t.findPrevious, ICONS.prev, () => target.onStep(-1))
  const next = iconKey(t.findNext, ICONS.next, () => target.onStep(1))
  // On the FIRST row, because the second one is optional and the way out must not be.
  const shut = iconKey(t.close, ICONS.close, () => target.onClose())
  keys.append(matchCase, counted, prev, next, shut)

  const spacer = el('span', { className: className.spacer, 'aria-hidden': 'true' })
  const swap = el('input', { className: `${CONTROL_CHROME} ${className.field}`, 'aria-label': t.findReplaceWith, placeholder: t.findReplaceWith })
  const swapKeys = el('div', { className: className.keys })
  const one = el('button', { className: buttonClass('ghost', 'sm'), type: 'button' })
  one.textContent = t.findReplace
  const all = el('button', { className: buttonClass('ghost', 'sm'), type: 'button' })
  all.textContent = t.findReplaceAll
  swapKeys.append(one, all)

  strip.append(disclose, find, keys, spacer, swap, swapKeys)
  host.appendChild(strip)

  // The document is searched from HERE rather than from a watcher on the value, so a keystroke
  // and its search are one event. A frame later, on a long piece, typing feels like it is being
  // transcribed rather than typed.
  const ask = (next_: string, sensitive: boolean): void => {
    query = next_
    caseSensitive = sensitive
    find.value = next_
    paint()
    target.onQuery(next_, sensitive)
  }

  function paint(): void {
    counted.textContent = count === 0
      ? (query ? t.findNoMatch : '')
      : t.findCount.replace('{n}', String(index + 1)).replace('{total}', String(count))
    matchCase.setAttribute('aria-pressed', String(caseSensitive))
    matchCase.className = `${className.iconKey} ${className.caseSize} ${caseSensitive ? className.caseOn : ''}`.trim()
    for (const button of [prev, next, one, all]) button.disabled = count === 0
    disclose.setAttribute('aria-expanded', String(replacing))
    chevron.style.transform = replacing ? 'rotate(90deg)' : 'none'
    // The replace half is drawn always and hidden, which in a grid means it claims no track.
    for (const node of [spacer, swap, swapKeys]) node.hidden = !replacing
  }

  // Opened by the chord, and by the chevron for a hand that came in through `Mod-f` and then
  // changed its mind. It never closes itself: a writer who opened it is mid-task.
  disclose.addEventListener('click', () => { replacing = !replacing; paint() })
  find.addEventListener('input', () => ask(find.value, caseSensitive))
  matchCase.addEventListener('click', () => ask(query, !caseSensitive))
  find.addEventListener('keydown', (e) => {
    // Enter walks the hits, which is the one key every find box in existence answers to.
    if (e.key === 'Enter') { e.preventDefault(); target.onStep(e.shiftKey ? -1 : 1) }
    if (e.key === 'Escape') { e.preventDefault(); target.onClose() }
  })
  swap.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); target.onReplace(swap.value) }
    if (e.key === 'Escape') { e.preventDefault(); target.onClose() }
  })
  one.addEventListener('click', () => target.onReplace(swap.value))
  all.addEventListener('click', () => target.onReplaceAll(swap.value))
  paint()

  const report = (): void => hooks.onHeight(Math.ceil(strip.getBoundingClientRect().height))
  const watcher = new ResizeObserver(report)
  watcher.observe(strip)
  report()

  // The strip is mounted by the chord, so the field it opens for is the field the chord is
  // asking for. `select()` rather than plain focus: reopening with a query already in it should
  // let the next thing typed replace it, which is what every find box does.
  find.focus()
  find.select()

  return {
    setCount: (n: number, at: number) => { count = n; index = at; paint() },
    destroy: () => {
      watcher.disconnect()
      hooks.onHeight(0)
      strip.remove()
    },
  }
}
