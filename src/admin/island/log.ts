// The log screen's three controls, over rows the server already sent (ADR 0054, step 1).
//
// It filters and it pages. It does not BUILD anything, and it does not know what a row looks
// like: every line of the ledger is in the markup, carrying the three facts a filter asks about
// (`data-kind`, `data-at`, `data-find`), and this hides the ones that do not match.
//
// WHY THE HAYSTACK IS PRE-FOLDED. `data-find` is the sentence, the detail and the machine code
// with accents already stripped, written once by the server. A keystroke is then one
// `includes` per row instead of folding two hundred strings — which matters because somebody
// looking for a post types its title, and the search has to answer while they are still typing.
//
// The same shape as the rail: the DOM does not change, an attribute does.
import { fold } from '@/admin-shared/fold'

const root = document.querySelector<HTMLElement>('[data-screen="log"]')

if (root) {
  const PAGE = Number(root.dataset.logPage ?? 50)
  const rows = [...root.querySelectorAll<HTMLElement>('[data-log-row]')]
  const kind = root.querySelector<HTMLSelectElement>('[data-log-kind]')
  const days = root.querySelector<HTMLSelectElement>('[data-log-days]')
  const search = root.querySelector<HTMLInputElement>('[data-log-search]')
  const count = root.querySelector<HTMLElement>('[data-log-count]')
  const more = root.querySelector<HTMLElement>('[data-log-more]')
  const noMatch = root.querySelector<HTMLElement>('[data-log-nomatch]')
  const noun = count?.textContent?.replace(/^\d+\s*·\s*/, '') ?? ''

  /** How many rows are on screen. Reset by any control, raised by "show more". */
  let shown = PAGE

  function apply(): void {
    const q = fold(search?.value.trim() ?? '')
    const want = kind?.value ?? 'all'
    const back = Number(days?.value ?? 0)
    const since = back > 0 ? Date.now() - back * 86400000 : 0

    let matched = 0
    for (const row of rows) {
      const ok = (want === 'all' || row.dataset.kind === want)
        && (!since || Number(row.dataset.at) >= since)
        && (!q || (row.dataset.find ?? '').includes(q))
      // MATCHING AND SHOWN ARE TWO QUESTIONS. A row past the page is hidden and still counted,
      // or "show more" would have nothing to say and the count would report the page rather
      // than the search.
      if (ok) matched++
      row.hidden = !ok || matched > shown
    }
    if (count) count.textContent = `${matched} · ${noun}`
    if (more) more.hidden = matched <= shown
    // The lens, not the blank page: "nothing matched what you typed" and "nothing has happened
    // yet" are different facts, and the server draws the second one instead of a list at all.
    if (noMatch) noMatch.hidden = matched > 0
  }

  /** Any control moves the page back to the top of its own results. */
  const reset = (): void => { shown = PAGE; apply() }
  kind?.addEventListener('change', reset)
  days?.addEventListener('change', reset)
  search?.addEventListener('input', reset)
  more?.querySelector('button')?.addEventListener('click', () => { shown += PAGE; apply() })

  /**
   * Clearing the log, which is the one thing on this screen that writes.
   *
   * The question is asked in the product's own grammar rather than the browser's, through one
   * event: `ConfirmProvider` is still React and still mounted beside this page, and an island
   * that imported it would pull React in behind it. The payload IS a `ConfirmRequest`, so the
   * bridge passes it straight through and there is nothing to keep in step.
   *
   * If nothing answers, NOTHING HAPPENS. The browser's own `confirm()` is not the floor here
   * and `check:admin-kit` says so: it draws a box wearing none of this product's grammar and
   * naming nothing. So an unheard question is a refusal — the only outcome that cannot be
   * regretted, since the log is the one thing on this screen that cannot be brought back.
   */
  const words = JSON.parse(root.dataset.logAsk ?? '{}') as Record<string, string>
  root.querySelector<HTMLButtonElement>('[data-log-clear]')?.addEventListener('click', async (e) => {
    const button = e.currentTarget as HTMLButtonElement
    if (button.disabled) return
    const said = await new Promise<boolean>((resolve) => {
      const unheard = window.dispatchEvent(new CustomEvent('quire:confirm', {
        cancelable: true,
        detail: {
          request: {
            title: words.title, body: words.body,
            confirmLabel: words.yes, cancelLabel: words.no, danger: true,
          },
          respond: (answer: string) => resolve(answer === 'confirm'),
        },
      }))
      if (unheard) resolve(false)
    })
    if (!said) return
    button.disabled = true
    try {
      const res = await fetch('/api/activity', { method: 'DELETE' })
      const json = await res.json() as { success?: boolean }
      if (!json.success) throw new Error('refused')
      // A page, so the answer is a page. `router.refresh()` was the React face of this.
      location.reload()
    } catch {
      window.dispatchEvent(new CustomEvent('quire:toast', { detail: { message: words.failed, kind: 'error' } }))
      button.disabled = false
    }
  })

  apply()
}
