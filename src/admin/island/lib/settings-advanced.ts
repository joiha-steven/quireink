// THE ADVANCED BAND: open or shut, why it opened, and what it is hiding.
//
// The server draws every card in the band and ships its body `hidden` (`advancedBand` in
// `web/admin/screens/settings-shell.ts`), because it cannot read the one thing that decides it:
// whether this device asked for it open. Nothing here builds markup; it moves `hidden` and
// `aria-expanded`, and writes one number.
//
// ⚠️ A SHUT BAND IS STILL IN THE FORM. The sheet's Save reads every `data-k` under the panels
// whether or not it is on screen (`settings-form.ts`), so a key edited inside the band and then
// folded away is still counted on the Save key and still stored. Folding is presentation only.
import { LAMP_HUES } from '@/admin-shared/kit'
import { plural } from '@/i18n/plural'
import type { SiteLang } from '@/types'
import { changedCount, fieldsIn } from './settings-form'

/**
 * A DEVICE preference, like the explanations switch beside it: how one person likes this screen
 * on one machine, not a fact about the blog, so it never reaches the settings record.
 */
export const ADVANCED_KEY = 'quireink-admin-settings-advanced'

export type AdvancedBands = {
  /**
   * Open the band holding `el`, if it is shut, WITHOUT remembering it: a search hit or a refused
   * field is a reason to look once, not the owner changing their mind about the screen.
   * Returns whether it opened one.
   */
  reveal: (el: Element | null | undefined) => boolean
  /** Count again what needs attention inside each band. Cheap; batched to the next frame. */
  recount: () => void
}

/**
 * Whether one card in a band is something the owner should look at: a test that FAILED, or an
 * edit nobody has stored.
 *
 * ⚠️ NOT "NOT SET UP YET". That amber is the lamp the SERVER drew (`data-lamp-rest`), and in a
 * band of optional cards it is the normal state of a fresh blog: counting it put "1 needs
 * attention" on every install with no Cloudflare account, which teaches the owner to ignore the
 * count. The server cannot draw the other two ambers — no test result is stored, and nothing is
 * unsaved in a page just written — so an amber lamp still wearing the title it was drawn with is
 * the resting one, and an amber lamp with any other title (`connectionFailed`,
 * `connectionUnsaved`) was painted by the island for a reason. A hidden lamp is off. A card with
 * NO lamp has nobody to say it holds an edit, so its own unsaved keys are asked directly.
 */
export function needsAttention(card: Element): boolean {
  const lamp = card.querySelector<HTMLElement>('[data-card-lamp]')
  if (lamp) {
    if (lamp.hidden || !lamp.className.split(' ').includes(LAMP_HUES.attention)) return false
    const resting = lamp.dataset.lampRest === 'attention'
      && (lamp.getAttribute('aria-label') ?? '') === (lamp.dataset.lampRestTitle ?? '')
    return !resting
  }
  return changedCount(fieldsIn(card)) > 0
}

/** The cards of one band: each column's children, which is what `advancedBand` draws. */
const cardsOf = (body: Element): Element[] =>
  [...body.querySelectorAll(':scope > div > div > *')]

function readStored(): boolean {
  try {
    return localStorage.getItem(ADVANCED_KEY) === '1'
  } catch {
    // A browser with storage refused: the band opens shut, and the key still works this visit.
    return false
  }
}

export function wireAdvanced(screen: HTMLElement): AdvancedBands {
  const lang = (screen.dataset.lang ?? 'en') as SiteLang
  const bands = [...screen.querySelectorAll<HTMLElement>('[data-advanced]')]

  const parts = (band: HTMLElement) => ({
    key: band.querySelector<HTMLElement>('[data-advanced-toggle]'),
    body: band.querySelector<HTMLElement>('[data-advanced-body]'),
  })

  function paint(band: HTMLElement, open: boolean): void {
    const { key, body } = parts(band)
    if (body) body.hidden = !open
    key?.setAttribute('aria-expanded', String(open))
  }

  const stored = readStored()
  for (const band of bands) paint(band, stored)

  screen.addEventListener('click', (e) => {
    const key = (e.target as HTMLElement).closest<HTMLElement>('[data-advanced-toggle]')
    if (!key) return
    const open = key.getAttribute('aria-expanded') !== 'true'
    // ONE preference for every band, so the screen answers the question the same way wherever
    // it is asked.
    for (const band of bands) paint(band, open)
    try { localStorage.setItem(ADVANCED_KEY, open ? '1' : '0') } catch { /* nothing to remember with */ }
  })

  function reveal(el: Element | null | undefined): boolean {
    const band = el?.closest<HTMLElement>('[data-advanced]')
    const body = band ? parts(band).body : null
    if (!band || !body || !body.hidden || !body.contains(el ?? null)) return false
    paint(band, true)
    return true
  }

  function count(): void {
    for (const band of bands) {
      const { body } = parts(band)
      const badge = band.querySelector<HTMLElement>('[data-advanced-count]')
      const text = badge?.querySelector<HTMLElement>('[data-advanced-count-text]')
      if (!body || !badge || !text) continue
      const n = cardsOf(body).filter(needsAttention).length
      badge.hidden = n === 0
      const said = plural(badge.dataset.template ?? '', n, lang)
      if (text.textContent !== said) text.textContent = said
    }
  }

  // BATCHED TO THE NEXT FRAME, so it runs after every other handler for the same event: the
  // cards' own lamps are repainted by listeners on this same screen (`settings-cards.ts`), and
  // counting before they have run would count the lamp as it was.
  let queued = false
  function recount(): void {
    if (queued) return
    queued = true
    requestAnimationFrame(() => { queued = false; count() })
  }
  for (const type of ['input', 'change', 'click']) screen.addEventListener(type, recount)
  // A card's own Save answers LATER, after a request, and repaints its lamp with no event to
  // hear; the lamp's own class is the thing to watch.
  const watch = new MutationObserver(recount)
  for (const band of bands) {
    for (const lamp of band.querySelectorAll('[data-card-lamp]')) {
      watch.observe(lamp, { attributes: true, attributeFilter: ['class', 'hidden'] })
    }
  }
  count()
  return { reveal, recount }
}
