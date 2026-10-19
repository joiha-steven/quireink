// The toolbar's "More" key: what keeps the button row to ONE row on a desktop.
//
// Split from `editor-toolbar.ts`, which draws the keys; this decides which of them stay on the
// row and lists the rest in a menu. The decision itself is `fitRow` (`toolbar-fit.ts`), a pure
// function of widths; this file measures, applies the answer, and runs the menu.
//
// ONE DOM (`docs/admin-one-dom.md`): every key is drawn once, by the bar. The keys that do not
// fit are the bar's own, `hidden`; the menu's rows are drawn from the same key definitions when
// it opens and dropped when it shuts, so there is no second copy of the row to drift.
import { OVERLAY } from '@/admin-shared/kit'
import { el } from './node-dom'
import { withTip } from './editor-tooltip'
import { printedChord } from './editorKeys'
import { fitRow } from './toolbar-fit'

/**
 * EVERY CLASS THIS FILE WRITES (`check:admin-css` reads the expression after `className`).
 */
const className = {
  /**
   * WHAT DID NOT FIT, AS A MENU UNDER MORE. A child of the BAR rather than of the strip, and
   * that is not tidiness: the strip wears `scroll-fade-x`, a mask, and a mask clips everything
   * outside the box it is on, so a menu hung from the strip would be drawn and invisible. `top`
   * and `right` are set when it opens, from where the More key is. `w-72` and not the "/"
   * menu's `w-64`: at 1640 with the panel docked the lists go behind More too, and at 256px the
   * Russian "numbered list" beside its chord was cut off.
   */
  menu: `absolute z-20 w-72 overflow-y-auto p-1 ${OVERLAY}`,
  // A row is the kit's 36px, the same tap size as a key on the bar.
  item: 'flex h-9 w-full items-center gap-2.5 rounded-md px-2 text-left text-sm text-neutral-700'
    + ' hover:bg-neutral-100 focus:bg-neutral-100 dark:text-neutral-200'
    + ' dark:hover:bg-neutral-800 dark:focus:bg-neutral-800',
  // The key's own face in a smaller box, pressed the way the key would be.
  face: 'grid h-7 w-7 shrink-0 place-items-center rounded-md',
  name: 'min-w-0 flex-1 truncate',
  hint: 'shrink-0 font-mono text-xs text-neutral-500 dark:text-neutral-400',
}

/** What the menu needs to know about a key of the bar. */
export type MoreKey = {
  name: string
  /** The key's id in the shortcut table, when it has a chord. */
  chord?: string
  /** Present when the key can be pressed in; `isOn` answers whether it is. */
  on?: unknown
  run: () => void
  face: () => Node
}

/** A cluster on the row: its box, and each key's box (the tooltip's wrapper) in order. */
export type RowCluster<K> = { box: HTMLElement; keys: { key: K; box: HTMLElement }[] }

export type MoreHooks<K extends MoreKey> = {
  /** The sticky bar: the menu's containing block. */
  bar: HTMLElement
  /** The strip. Its width is the room; its `overflow-x` says whether it scrolls instead. */
  line: HTMLElement
  /** The run of clusters, which More ends. */
  run: HTMLElement
  clusters: RowCluster<K>[]
  /** The More key's name. */
  word: string
  /** The bar's key classes, so More and the menu's faces look like keys, pressed or not. */
  key: { base: string; on: string; off: string }
  /** The strip's centring class, dropped while anything is behind More. */
  middle: string
  glyph: Node
  isOn: (key: K) => boolean
}

export type More = {
  /** The More key (its tooltip's wrapper), for the end of the run. */
  box: HTMLElement
  /** The menu, for the bar. */
  menu: HTMLElement
  /** Measure and keep measuring; call once the bar is in the document. */
  start: () => void
  /** A transaction landed: repaint the pressed state of an open menu's rows. */
  repaint: () => void
  destroy: () => void
}

/** Each bar's menu needs an id of its own for `aria-controls`. */
let menus = 0

export function mountMore<K extends MoreKey>(h: MoreHooks<K>): More {
  const { bar, line, run, clusters } = h

  /**
   * MORE: one key at the END of the row, holding whatever `fit` took off it. Drawn always and
   * hidden while everything fits, so a row that fits is the row it was, to the pixel.
   */
  const menuId = `toolbar-more-${++menus}`
  const moreKey = el('button', {
    className: h.key.base, type: 'button', title: h.word, 'aria-label': h.word,
    'aria-haspopup': 'menu', 'aria-expanded': 'false', 'aria-controls': menuId, 'data-toolbar-more': '',
  })
  moreKey.appendChild(h.glyph)
  const box = withTip(moreKey, h.word)
  box.hidden = true

  const menu = el('div', { className: className.menu, role: 'menu', id: menuId, 'aria-label': h.word })
  menu.hidden = true

  /** The keys `fit` took off the row, in row order: what the menu lists. */
  let away: K[] = []
  /** The menu's rows while it is open, so a transaction can repaint their pressed state. */
  let rows: { key: K; item: HTMLButtonElement; face: HTMLElement }[] = []

  const paintRow = ({ key, item, face }: (typeof rows)[number]): void => {
    if (!key.on) return
    const on = h.isOn(key)
    item.setAttribute('aria-checked', String(on))
    face.className = `${className.face} ${on ? h.key.on : h.key.off}`
  }

  const outside = (e: PointerEvent): void => {
    const target = e.target as Node
    if (!menu.contains(target) && !moreKey.contains(target)) close()
  }
  const close = (): void => {
    if (menu.hidden) return
    menu.hidden = true
    menu.replaceChildren()
    rows = []
    moreKey.setAttribute('aria-expanded', 'false')
    moreKey.className = h.key.base
    document.removeEventListener('pointerdown', outside, true)
  }

  /**
   * Under the More key, its right edge on the key's right edge, and never past the window's
   * foot: a long menu scrolls inside itself rather than taking the page with it. Run on open
   * AND on every fit while open, because a wider window moves More without changing what is
   * behind it, and a menu placed once was left hanging where the key used to be.
   */
  const place = (): void => {
    const barBox = bar.getBoundingClientRect()
    const keyBox = moreKey.getBoundingClientRect()
    menu.style.top = `${Math.round(keyBox.bottom - barBox.top + 4)}px`
    menu.style.right = `${Math.round(barBox.right - keyBox.right)}px`
    menu.style.maxHeight = `${Math.max(144, Math.floor(innerHeight - keyBox.bottom - 16))}px`
  }

  /**
   * Open the menu, its rows drawn from the SAME key definitions the row draws, and put the
   * focus on one of them. A menu button's contract (WAI-ARIA APG): arrows walk, Home and End
   * jump, Enter or Space chooses, Escape gives the focus back to More, Tab leaves.
   */
  const open = (focus: 'first' | 'last'): void => {
    if (away.length === 0) return
    rows = away.map((key) => {
      const item = el('button', {
        className: className.item, type: 'button', tabindex: '-1',
        role: key.on ? 'menuitemcheckbox' : 'menuitem',
      })
      const face = el('span', { className: className.face, 'aria-hidden': 'true' })
      face.appendChild(key.face())
      const name = el('span', { className: className.name })
      name.textContent = key.name
      item.append(face, name)
      const chord = key.chord ? printedChord(key.chord) : ''
      if (chord) {
        const hint = el('span', { className: className.hint })
        hint.textContent = chord
        item.appendChild(hint)
      }
      item.addEventListener('click', () => { close(); key.run() })
      return { key, item, face }
    })
    for (const row of rows) paintRow(row)
    menu.replaceChildren(...rows.map((r) => r.item))
    menu.hidden = false
    place()
    moreKey.setAttribute('aria-expanded', 'true')
    moreKey.className = `${h.key.base} ${h.key.on}`
    document.addEventListener('pointerdown', outside, true)
    rows[focus === 'first' ? 0 : rows.length - 1]?.item.focus()
  }

  moreKey.addEventListener('click', () => (menu.hidden ? open('first') : close()))
  moreKey.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    open(e.key === 'ArrowDown' ? 'first' : 'last')
  })
  menu.addEventListener('keydown', (e) => {
    const items = rows.map((r) => r.item)
    const at = items.indexOf(document.activeElement as HTMLButtonElement)
    const go = (i: number): void => { e.preventDefault(); items[(i + items.length) % items.length]?.focus() }
    if (e.key === 'ArrowDown') go(at + 1)
    else if (e.key === 'ArrowUp') go(at - 1)
    else if (e.key === 'Home') go(0)
    else if (e.key === 'End') go(items.length - 1)
    else if (e.key === 'Escape') {
      // Stopped here: the attributes panel closes on an Escape that reaches the window, and
      // this one was spent closing the menu.
      e.preventDefault()
      e.stopPropagation()
      close()
      moreKey.focus()
    } else if (e.key === 'Tab') {
      // Back on More first, so the Tab carries on from the row rather than from a menu that is
      // about to be gone.
      close()
      moreKey.focus()
    }
  })

  /**
   * THE ONE PLACE THAT DECIDES WHAT IS ON THE ROW. Everything is put back, measured, and then
   * `fitRow` says how many clusters stay; the rest are `hidden` and listed by More. Nothing is
   * painted between the putting back and the hiding, because nothing yields to the browser.
   *
   * A strip that SCROLLS (below `lg`, the phone's answer) is left whole: there every key is one
   * swipe away at the kit's size, where a menu would hold eighteen rows behind a keyboard. The
   * strip's own `overflow-x` says which it is, so this and the stylesheet cannot disagree.
   *
   * ⚠️ THE ROOM IS READ BEFORE ANYTHING IS PUT BACK. Putting every key back makes the run wider
   * than the strip for a moment, and an overflow that reaches the page can raise a classic
   * scrollbar that narrows the strip by its 17px while it is being measured, which would put a
   * cluster away that fits. The strip also clips sideways on a desktop (`lg:overflow-x-clip`
   * in `toolbar-shape.ts`), so its run is never anybody's overflow; reading first is the
   * second lock on the same door.
   */
  const fit = (): void => {
    const before = away
    const focused = document.activeElement
    const lineStyle = getComputedStyle(line)
    const scrolls = /auto|scroll/.test(lineStyle.overflowX)
    const px = (value: string): number => parseFloat(value) || 0
    const room = line.clientWidth - px(lineStyle.paddingLeft) - px(lineStyle.paddingRight)
    for (const c of clusters) {
      c.box.hidden = false
      for (const k of c.keys) k.box.hidden = false
    }
    box.hidden = false
    line.classList.add(h.middle)
    let kept = { whole: clusters.length, part: 0 }
    if (!scrolls && clusters.length > 0) {
      const width = (node: HTMLElement): number => node.getBoundingClientRect().width
      kept = fitRow(
        clusters.map((c) => c.keys.map((k) => width(k.box))),
        room,
        width(box),
        px(getComputedStyle(run).columnGap),
        px(getComputedStyle(clusters[0]!.box).columnGap),
      )
    }
    away = []
    clusters.forEach((c, i) => {
      if (i < kept.whole) return
      const keep = i === kept.whole ? kept.part : 0
      if (keep === 0) c.box.hidden = true
      c.keys.forEach((k, j) => {
        if (j < keep) return
        k.box.hidden = true
        away.push(k.key)
      })
    })
    box.hidden = away.length === 0
    // A short row starts where the action line starts; only a full one is centred.
    line.classList.toggle(h.middle, away.length === 0)
    line.dataset.toolbarAway = String(away.length)
    // A menu listing yesterday's keys is a menu that lies: a change of fit takes it down. The
    // same keys behind a More that has moved: the menu follows it.
    const changed = away.length !== before.length || away.some((key, i) => key !== before[i])
    if (changed) close()
    else if (!menu.hidden) place()
    keepFocus(focused, before)
  }

  /**
   * THE FOCUS DOES NOT FALL OUT OF THE BAR. A focused key that `fit` hides (tab to Table, then
   * dock the attributes by their chord) would drop the focus on the body, and the next Tab
   * would start from the top of the page. It goes to More, which now holds that key; a focused
   * More that has nothing left to hold hands it to the first key that came back.
   */
  const keepFocus = (focused: Element | null, before: K[]): void => {
    if (!(focused instanceof HTMLElement) || focused === document.body) return
    const hidden = (node: HTMLElement): boolean => node.hidden && node.contains(focused)
    const lost = clusters.some((c) => hidden(c.box) || c.keys.some((k) => hidden(k.box)))
      || (menu.hidden && menu.contains(focused))
      || !focused.isConnected
    if (lost && !box.hidden) { moreKey.focus(); return }
    if (box.hidden && box.contains(focused)) {
      const back = clusters.flatMap((c) => c.keys).find((k) => k.key === before[0])
      back?.box.querySelector('button')?.focus()
    }
  }

  // The strip's width is the room: a resize, the attributes panel docking beside the sheet,
  // the write pane arriving. Only a change of WIDTH refits, so hiding keys inside the strip
  // cannot wake this up again. Focus mode takes the whole bar away and mounts a new one.
  let seenWidth = -1
  const watch = new ResizeObserver(() => {
    if (line.clientWidth === seenWidth) return
    seenWidth = line.clientWidth
    fit()
  })
  // A face arriving late can change a key's width without changing the strip's. Optional,
  // because a test's DOM may have no font set at all.
  const fonts = document.fonts as FontFaceSet | undefined

  return {
    box,
    menu,
    start: () => {
      watch.observe(line)
      fonts?.addEventListener('loadingdone', fit)
      fit()
    },
    repaint: () => { for (const row of rows) paintRow(row) },
    destroy: () => {
      watch.disconnect()
      fonts?.removeEventListener('loadingdone', fit)
      close()
    },
  }
}
