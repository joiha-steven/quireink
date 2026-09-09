// The reader's pen: select a sentence, and mark it the way the writer can.
//
// The highlighter, the underline and the ring were the writer's alone. This gives the same
// three gestures — and a note — to whoever is reading, on the page they are reading, with no
// account and nothing sent: a mark lives in the reader's browser (`pen-store.ts`), anchored
// to the words it sits on (`pen-anchor.ts`), and is drawn again on the next visit by the
// same two sheets the writer's marks use.
//
// Those sheets only board a page that already carries a mark (ADR 0027), so on a page with
// none this island links them itself — the moment they are needed and not before, which is
// the one exception to "a late stylesheet flickers": the mark it paints is one the reader
// just made, or one they made last week, and either can arrive a beat after the words.
//
// Its own bundle, fetched only where the owner's switch is on, and the owner of the
// selection menu while it is: `quote.ts` stands down when this island is present and its
// copy gesture rides along here instead.

import { el, label } from './dom'
import { flatten, locate, rangeFrom, selectorFor, unwrap, wrap } from './pen-anchor'
import { fragment } from './quote'
import { load, newId, save, type Ann, type Kind } from './pen-store'

/** Below this, a selection is a click that slipped rather than a mark. */
const MIN_CHARS = 2
const INKS = ['yellow', 'green', 'pink', 'blue', 'orange'] as const
/** The same deal the renderer makes (`pen/grammar.ts`): the short hand for a word or two. */
const SHORT_CHARS = 28, SHORT_FROM = 40

function penSeed(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193)
  return (text.length <= SHORT_CHARS ? SHORT_FROM : 0) + (h >>> 0) % SHORT_FROM
}

function element(a: Ann): HTMLElement {
  const attrs: Record<string, string> = { 'data-pen': String(penSeed(a.exact)), 'data-reader': a.id }
  if (a.ink) attrs['data-ink'] = a.ink
  if (a.kind === 'o') attrs['data-form'] = 'o'
  return el(a.kind === 'u' ? 'u' : 'mark', attrs)
}

const BLOCK = 'p,li,blockquote,h1,h2,h3,h4,h5,h6,figure,pre,table,dd,dt'

function readerPen(): void {
  const prose = document.querySelector<HTMLElement>('.prose')
  const sheets = label('penSheets')
  if (!prose || !sheets) return
  const path = location.pathname
  let items = load(path)

  /* ---- the two sheets, linked once and only when a mark needs them ---------------- */
  let ready: Promise<void> | null = null
  const ensureSheets = () => (ready ??= Promise.all(sheets.split(' ').map((href) =>
    new Promise<void>((done) => {
      if (document.querySelector(`link[href="${href}"]`)) return done()
      const link = el('link', { rel: 'stylesheet', href })
      link.addEventListener('load', () => done(), { once: true })
      link.addEventListener('error', () => done(), { once: true })
      document.head.appendChild(link)
    }))).then(() => undefined))

  /* ---- notes: a card under the block the mark begins in ---------------------------- */
  const noteCard = (a: Ann): HTMLElement | null => {
    const first = prose.querySelector(`[data-reader="${a.id}"]`)
    const block = first?.closest(BLOCK)
    if (!block) return null
    let card = prose.querySelector<HTMLElement>(`.pen-note[data-for="${a.id}"]`)
    if (!a.note.trim()) {
      card?.remove()
      return null
    }
    if (!card) {
      card = el('aside', { class: 'pen-note', 'data-for': a.id, 'data-pen-skip': '' })
      block.after(card)
    }
    card.textContent = a.note
    return card
  }

  /* ---- drawing a mark from its anchor ---------------------------------------------- */
  const draw = (a: Ann): boolean => {
    const flat = flatten(prose)
    const hit = locate(flat, a)
    const range = hit && rangeFrom(flat, hit.start, hit.end)
    if (!range) return false
    wrap(range, () => element(a))
    noteCard(a)
    return true
  }

  const persist = () => save(path, items)

  const remove = (id: string) => {
    unwrap(prose.querySelectorAll(`[data-reader="${id}"]`))
    prose.querySelector(`.pen-note[data-for="${id}"]`)?.remove()
    items = items.filter((a) => a.id !== id)
    persist()
  }

  if (items.length) void ensureSheets().then(() => { for (const a of items) draw(a) })

  /* ---- the bar over a selection ------------------------------------------------------ */
  const inks = label('penInks').split(',')
  const bar = el('div', { class: 'pen-bar', hidden: '', role: 'toolbar' })
  const swatch = (ink: string, i: number) => {
    const b = el('button', { type: 'button', class: 'pen-swatch', 'data-ink': ink,
      'aria-label': `${label('readerPenHighlight')} · ${ink}` })
    b.style.background = `#${inks[i] ?? ''}`
    return b
  }
  const word = (cls: string, text: string) => el('button', { type: 'button', class: cls }, text)
  const sep = () => el('span', { class: 'pen-sep' })
  bar.append(...INKS.map(swatch), sep(),
    word('pen-u', label('readerPenUnderline')), word('pen-o', label('readerPenRing')),
    word('pen-n', label('readerPenNote')), sep(), word('pen-q', label('quoteCopy')))
  document.body.appendChild(bar)

  let range: Range | null = null
  let timer = 0
  const hideBar = () => { bar.hidden = true }

  const place = (box: DOMRect, node: HTMLElement, below: boolean) => {
    const w = node.offsetWidth
    const x = Math.min(Math.max(8, box.left + box.width / 2 - w / 2),
      document.documentElement.clientWidth - w - 8)
    node.style.left = `${x + scrollX}px`
    node.style.top = `${(below ? box.bottom + 8 : box.top - node.offsetHeight - 8) + scrollY}px`
  }

  const update = () => {
    const sel = getSelection()
    const r = sel && !sel.isCollapsed && sel.rangeCount ? sel.getRangeAt(0) : null
    if (!r || !prose.contains(r.commonAncestorContainer) || r.toString().trim().length < MIN_CHARS) {
      range = null
      return hideBar()
    }
    range = r.cloneRange()
    bar.hidden = false
    // Below on a touch screen, where the platform's own callout sits above; above otherwise.
    place(r.getBoundingClientRect(), bar, matchMedia('(hover: none)').matches)
  }
  document.addEventListener('selectionchange', () => {
    clearTimeout(timer)
    timer = window.setTimeout(update, 150)
  })
  document.addEventListener('scroll', hideBar, { passive: true })
  bar.addEventListener('mousedown', (e) => e.preventDefault())

  const make = (kind: Kind, ink: string, thenNote: boolean) => {
    if (!range) return
    const sel = selectorFor(flatten(prose), range)
    if (!sel) return
    const a: Ann = { ...sel, id: newId(), kind, ink, note: '', t: Date.now() }
    const r = range
    hideBar()
    getSelection()?.removeAllRanges()
    void ensureSheets().then(() => {
      wrap(r, () => element(a))
      items.push(a)
      persist()
      if (thenNote) openPop(a)
    })
  }

  bar.addEventListener('click', (e) => {
    const b = (e.target as Element).closest('button')
    if (!b) return
    if (b.classList.contains('pen-swatch')) return make('hl', b.dataset.ink === 'yellow' ? '' : b.dataset.ink!, false)
    if (b.classList.contains('pen-u')) return make('u', '', false)
    if (b.classList.contains('pen-o')) return make('o', '', false)
    if (b.classList.contains('pen-n')) return make('hl', '', true)
    if (b.classList.contains('pen-q') && range && navigator.clipboard?.writeText) {
      const picked = range.toString().replace(/\s+/g, ' ').trim()
      void navigator.clipboard.writeText(`“${picked}”\n${location.href.split('#')[0]}#${fragment(picked)}`)
      hideBar()
    }
  })

  /* ---- the card over a mark: its note, and the way to take it back ------------------ */
  const pop = el('div', { class: 'pen-pop', hidden: '' })
  const area = el('textarea', { rows: '3', placeholder: label('readerPenNoteHint') })
  const del = el('button', { type: 'button', class: 'pen-del' }, label('readerPenDelete'))
  pop.append(area, del)
  document.body.appendChild(pop)
  let open: Ann | null = null
  let noteTimer = 0

  const openPop = (a: Ann) => {
    const first = prose.querySelector<HTMLElement>(`[data-reader="${a.id}"]`)
    if (!first) return
    open = a
    area.value = a.note
    pop.hidden = false
    place(first.getBoundingClientRect(), pop, true)
    area.focus()
  }
  const closePop = () => { pop.hidden = true; open = null }

  area.addEventListener('input', () => {
    if (!open) return
    open.note = area.value
    clearTimeout(noteTimer)
    noteTimer = window.setTimeout(() => { noteCard(open!); persist() }, 300)
  })
  del.addEventListener('click', () => {
    if (open) remove(open.id)
    closePop()
  })
  document.addEventListener('click', (e) => {
    const t = e.target as Element
    if (pop.contains(t) || bar.contains(t)) return
    const mark = t.closest<HTMLElement>('.prose [data-reader]')
    if (mark) {
      const a = items.find((x) => x.id === mark.dataset.reader)
      if (a) return openPop(a)
    }
    if (!pop.hidden) closePop()
  })
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePop() })
}

readerPen()
