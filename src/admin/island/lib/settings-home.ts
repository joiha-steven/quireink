// THE FOUR THINGS ON THE HOME TAB THAT ARE LISTS, and the footer's little toolbar.
//
// ⚠️ ALL OF IT WAS MARKUP AND NOTHING ELSE UNTIL 2026-09-15. ADR 0054 drew the header menu's
// rows and its Add key, the featured list with its move and remove keys, the front page's
// category strips, and the footer's B/I/U/link row — and no island was written for any of them.
// Add, remove and reorder did nothing at all on this tab.
//
// ⚠️ EACH LIST IS ONE VALUE, WRITTEN HERE. The rows used to carry `data-k="menu.0.label"`, and
// the screen's Save sends a deep partial: editing one field sent an array full of holes, which
// cost the whole menu (repaired in `content/settings-sanitize.ts`), and REMOVING a row could not
// be expressed at all — the survivors renumbered back onto their own stored values, nothing was
// dirty, and the row returned on the next load. So `settings-home.ts` now ships one hidden
// `data-k-json` field per list and this file owns the array. Same shape as `customFont`.
//
// ⚠️ NOTHING HERE BUILDS MARKUP. A row is cloned from the `<template>` the server drew, and an
// option that has been used is HIDDEN rather than removed, so putting it back is a flag rather
// than a `<option>` assembled in JavaScript with none of the server's words in it.
import { renderInlineMarkdown } from '@/render/inline-md'
import { show, type ListWords } from './list-dom'

/** Write a list back and let the Save key count it. The event has to bubble to the panels box. */
function store(field: HTMLInputElement | null, value: unknown): void {
  if (!field) return
  field.value = JSON.stringify(value)
  field.dispatchEvent(new Event('input', { bubbles: true }))
}

const field = (screen: HTMLElement, k: string): HTMLInputElement | null =>
  screen.querySelector<HTMLInputElement>(`[data-k="${k}"]`)

/** One row out of a list's own template. The server wrote every class and every word in it. */
function clone(box: HTMLElement, hook: string): HTMLElement | null {
  const made = box.querySelector<HTMLTemplateElement>(`[${hook}]`)?.content.firstElementChild?.cloneNode(true)
  return made instanceof HTMLElement ? made : null
}

// ---- the header menu -------------------------------------------------------------------------

function wireMenu(screen: HTMLElement): void {
  const box = screen.querySelector<HTMLElement>('[data-menu]')
  const rows = screen.querySelector<HTMLElement>('[data-menu-rows]')
  if (!box || !rows) return
  const held = field(screen, 'menu')

  const sync = (): void => {
    store(held, [...rows.querySelectorAll<HTMLElement>('[data-menu-row]')].map((row) => ({
      label: row.querySelector<HTMLInputElement>('[data-menu-label]')?.value ?? '',
      href: row.querySelector<HTMLInputElement>('[data-menu-href]')?.value ?? '',
    })))
  }

  box.addEventListener('input', (e) => {
    const target = e.target as HTMLElement
    if (target.matches('[data-menu-label], [data-menu-href]')) sync()
  })

  box.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    if (target.closest('[data-menu-add]')) {
      // ⚠️ A ROW WITH AN EMPTY LABEL OR LINK IS DROPPED BY THE SANITISER, so an added row that
      // is never filled in simply never saves. That was the React card's behaviour too, and it
      // is why Add does not touch the Save count on its own.
      const made = clone(box, 'data-menu-tpl')
      if (made) { rows.append(made); made.querySelector<HTMLInputElement>('[data-menu-label]')?.focus() }
      sync()
      return
    }
    const gone = target.closest('[data-menu-remove]')?.closest('[data-menu-row]')
    if (gone) { gone.remove(); sync() }
  })
}

// ---- the featured posts ----------------------------------------------------------------------

function wireFeatured(screen: HTMLElement): void {
  const box = screen.querySelector<HTMLElement>('[data-featured]')
  const rows = screen.querySelector<HTMLElement>('[data-featured-rows]')
  if (!box || !rows) return
  const held = field(screen, 'featured')
  const pick = box.querySelector<HTMLSelectElement>('[data-featured-add]')

  const each = (): HTMLElement[] => [...rows.querySelectorAll<HTMLElement>('[data-featured-row]')]

  const repaint = (): void => {
    const all = each()
    all.forEach((row, i) => {
      const up = row.querySelector<HTMLButtonElement>('[data-featured-up]')
      const down = row.querySelector<HTMLButtonElement>('[data-featured-down]')
      if (up) up.disabled = i === 0
      if (down) down.disabled = i === all.length - 1
    })
    show(box.querySelector('[data-featured-none]'), all.length === 0)
    // The add box goes when every post is already on the list. `hidden` on the option rather
    // than a removed one: an option put back is a flag, an option rebuilt is markup.
    const free = [...pick?.options ?? []].filter((o) => o.value && !o.hidden).length
    show(box.querySelector('[data-featured-add-box]'), free > 0)
    store(held, all.map((row) => row.dataset.featuredRow ?? ''))
  }

  const option = (slug: string): HTMLOptionElement | undefined =>
    [...pick?.options ?? []].find((o) => o.value === slug)

  pick?.addEventListener('change', () => {
    const slug = pick.value
    const chosen = option(slug)
    if (!slug || !chosen) return
    const made = clone(box, 'data-featured-tpl')
    if (made) {
      made.dataset.featuredRow = slug
      const title = made.querySelector<HTMLElement>('[data-featured-title]')
      if (title) title.textContent = chosen.textContent
      rows.append(made)
    }
    chosen.hidden = true
    pick.value = ''
    repaint()
  })

  box.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    const row = target.closest<HTMLElement>('[data-featured-row]')
    if (!row) return

    if (target.closest('[data-featured-up]')) {
      row.previousElementSibling?.before(row)
      repaint()
      return
    }
    if (target.closest('[data-featured-down]')) {
      row.nextElementSibling?.after(row)
      repaint()
      return
    }
    if (target.closest('[data-featured-remove]')) {
      const back = option(row.dataset.featuredRow ?? '')
      if (back) back.hidden = false
      row.remove()
      repaint()
    }
  })
}

// ---- the front page's category rows ------------------------------------------------------------

function wireStrips(screen: HTMLElement): void {
  const box = screen.querySelector<HTMLElement>('[data-strips]')
  const rows = screen.querySelector<HTMLElement>('[data-strip-rows]')
  if (!box || !rows) return
  const held = field(screen, 'home.front.strips')
  const pick = box.querySelector<HTMLSelectElement>('[data-strip-add]')

  const each = (): HTMLElement[] => [...rows.querySelectorAll<HTMLElement>('[data-strip]')]

  const repaint = (): void => {
    const all = each()
    all.forEach((row, i) => {
      const up = row.querySelector<HTMLButtonElement>('[data-strip-up]')
      if (up) up.disabled = i === 0
    })
    const free = [...pick?.options ?? []].filter((o) => o.value && !o.hidden).length
    // Eight is the renderer's cap: a front page that scrolls past every category is an archive
    // with extra steps, and the server refuses the ninth anyway.
    show(box.querySelector('[data-strip-add-box]'), all.length < 8 && free > 0)
    store(held, all.map((row) => ({
      category: row.dataset.strip ?? '',
      count: Number(row.querySelector<HTMLInputElement>('[data-strip-count]')?.value ?? 3),
      columns: Number(row.querySelector<HTMLSelectElement>('[data-strip-columns]')?.value ?? 3),
    })))
  }

  const option = (name: string): HTMLOptionElement | undefined =>
    [...pick?.options ?? []].find((o) => o.value === name)

  pick?.addEventListener('change', () => {
    const name = pick.value
    const chosen = option(name)
    if (!name || !chosen) return
    const made = clone(box, 'data-strip-tpl')
    if (made) {
      made.dataset.strip = name
      const title = made.querySelector<HTMLElement>('[data-strip-name]')
      if (title) title.textContent = name
      rows.append(made)
    }
    chosen.hidden = true
    pick.value = ''
    repaint()
  })

  box.addEventListener('input', (e) => {
    if ((e.target as HTMLElement).matches('[data-strip-count]')) repaint()
  })
  box.addEventListener('change', (e) => {
    if ((e.target as HTMLElement).matches('[data-strip-columns]')) repaint()
  })

  box.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    const row = target.closest<HTMLElement>('[data-strip]')
    if (!row) return
    if (target.closest('[data-strip-up]')) { row.previousElementSibling?.before(row); repaint(); return }
    if (target.closest('[data-strip-remove]')) {
      const back = option(row.dataset.strip ?? '')
      if (back) back.hidden = false
      row.remove()
      repaint()
    }
  })
}

// ---- the footer's four keys ---------------------------------------------------------------------

/**
 * ⚠️ THE SELECTION SURVIVES THE EDIT. Wrapping is done on the value and the caret put back
 * around what was wrapped, so pressing Bold three times bolds the same words three times rather
 * than walking the caret to the end of the field.
 */
function wrap(area: HTMLTextAreaElement, before: string, after: string): void {
  const { selectionStart: from, selectionEnd: to, value } = area
  area.value = value.slice(0, from) + before + value.slice(from, to) + after + value.slice(to)
  area.focus()
  area.setSelectionRange(from + before.length, to + before.length)
  area.dispatchEvent(new Event('input', { bubbles: true }))
}

function wireFooter(screen: HTMLElement, w: ListWords): void {
  const box = screen.querySelector<HTMLElement>('[data-footer]')
  const area = screen.querySelector<HTMLTextAreaElement>('[data-footer-field]')
  if (!box || !area) return
  const preview = box.querySelector<HTMLElement>('[data-footer-preview]')

  // The same renderer the server used for the first frame, so the preview cannot disagree with
  // the page. It reaches nothing but `escapeHtml`, which is what makes it safe to load here.
  const draw = (): void => {
    if (preview) preview.innerHTML = renderInlineMarkdown(area.value, { newTab: true })
  }
  area.addEventListener('input', draw)

  box.addEventListener('click', (e) => {
    const target = e.target as HTMLElement

    const marker = target.closest<HTMLElement>('[data-footer-wrap]')?.dataset.footerWrap
    // The markers are symmetric, which is why the markup carries one and not a pair.
    if (marker) { wrap(area, marker, marker); draw(); return }

    if (!target.closest('[data-footer-link]')) return
    const heard = !window.dispatchEvent(new CustomEvent('quire:confirm', {
      cancelable: true,
      detail: {
        request: {
          title: w.linkTitle ?? '',
          input: { label: w.promptLink ?? '', placeholder: 'https://' },
          confirmLabel: w.linkSave ?? '', cancelLabel: w.no ?? '',
        },
        // ⚠️ AN EMPTY ANSWER IS NOT A CANCEL. It inserts the placeholder as the href, which is
        // what the React card did: the owner meant to make a link and can type the address into
        // the field afterwards. Only backing out leaves the text alone.
        respond: (answer: string, value: string) => {
          if (answer !== 'confirm') return
          wrap(area, '[', `](${value.trim() || 'https://'})`)
          draw()
        },
      },
    }))
    if (!heard) return
  })
}

export function wireHome(screen: HTMLElement, w: ListWords): void {
  wireMenu(screen)
  wireFeatured(screen)
  wireStrips(screen)
  wireFooter(screen, w)
}
