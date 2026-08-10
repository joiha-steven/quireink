// Search without leaving the page.
//
// Pure enhancement. The trigger in the header is a link to `/search`, which renders the
// same results server-side; this intercepts the click and opens a `<dialog>` instead.
// Turn JavaScript off and search still works, one page load slower.
//
// A `<dialog>`, so Escape, focus trapping and the inert background are the browser's.

import { el, label, payload } from './dom'

type Result = { slug: string; title: string; date: string }

/** Wait for the reader to stop typing. One request per pause, not one per keystroke. */
function debounce(run: (value: string) => void, ms: number): (value: string) => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  return (value: string) => {
    clearTimeout(timer)
    timer = setTimeout(() => run(value), ms)
  }
}

export function search(): void {
  const trigger = document.querySelector<HTMLAnchorElement>('[data-search-open]')
  if (!trigger) return

  let dialog: HTMLDialogElement | null = null
  let latest = 0

  /**
   * A message where the results go.
   *
   * An `<li>`, not a `<p>`: the container is a `<ul>` and the only child a list may have is
   * a list item. It rendered `<ul><p class="empty">…</p></ul>`, which browsers draw fine and
   * a screen reader reports as a list of zero items — while a sentence sits on the screen
   * saying otherwise. `.empty` is a colour rule (`public.css.ts`) and does not care.
   */
  const message = (list: HTMLElement, key: 'searchHint' | 'searchEmpty') => {
    const row = el('li', { class: 'empty' })
    row.textContent = label(key)
    list.appendChild(row)
  }

  const show = (results: Result[], list: HTMLElement, query: string) => {
    list.replaceChildren()
    if (!query) {
      message(list, 'searchHint')
      return
    }
    if (!results.length) {
      message(list, 'searchEmpty')
      return
    }
    for (const r of results) {
      const link = el('a', { href: `/${r.slug}` })
      link.textContent = r.title
      list.appendChild(el('li', {}, link))
    }
  }

  function open(): void {
    if (dialog) {
      dialog.showModal()
      return
    }
    const input = el('input', {
      type: 'search', class: 'search-input', 'aria-label': label('search'),
      placeholder: label('search'), autocomplete: 'off',
    })
    // `aria-live`, because the results arrive without anything moving the focus: a reader
    // using a screen reader typed into a box and nothing announced that an answer had come
    // back, or that none had. `polite` waits for a pause in typing, which is what the
    // debounce above produces anyway.
    const list = el('ul', { class: 'search-results', 'aria-live': 'polite' })
    // `lightboxClose` rather than a new `close` key: it already says exactly this in six
    // languages, and a second key with the same meaning is how a locale table drifts.
    const close = el('button', { type: 'button', class: 'search-close', 'aria-label': label('lightboxClose') }, '✕')

    const run = debounce(async (query: string) => {
      // Every request carries a sequence number and only the newest one is allowed to
      // write. Without this, a slow response for "ti" can land after a fast one for
      // "timezone" and replace the right answer with a stale one.
      const seq = ++latest
      if (!query) {
        show([], list, '')
        return
      }
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        if (!res.ok) return
        const results = await payload<Result[]>(res)
        if (seq === latest) show(results, list, query)
      } catch {
        /* a failed search leaves the previous results alone */
      }
    }, 200)

    input.addEventListener('input', () => run(input.value.trim()))

    const next = document.createElement('dialog')
    next.className = 'overlay search-overlay'
    next.append(close, input, list)
    close.addEventListener('click', () => next.close())
    next.addEventListener('click', (e) => { if (e.target === next) next.close() })

    document.body.appendChild(next)
    dialog = next
    show([], list, '')
    next.showModal()
    input.focus()
  }

  trigger.addEventListener('click', (e) => {
    e.preventDefault() // the href stays a working fallback for a middle-click or no JS
    open()
  })

  // The conventional shortcut. Ignored while the reader is typing in something else.
  addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
    const active = document.activeElement
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return
    e.preventDefault()
    open()
  })
}
