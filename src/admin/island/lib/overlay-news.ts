// THE WHAT'S-NEW PANEL, closed — and the one question it sometimes asks.
//
// The panel itself is markup, and whether it is on the page at all is a fact the SERVER holds:
// `settings.seenRelease` against the version this build is. What could not be drawn is the two
// writes — the dialect chosen, and the stamp that stops it coming back.
export function wireWhatsNew(): void {
  const scrim = document.querySelector<HTMLElement>('[data-news-scrim]')
  const done = document.querySelector<HTMLButtonElement>('[data-news-done]')
  if (!scrim || !done) return

  // ⚠️ THE PANEL TAKES FOCUS. It says `role="dialog" aria-modal="true" tabindex="-1"` and until
  // 2026-09-15 nothing moved the keyboard into it, so a screen reader stayed on the page behind
  // a panel that had declared itself modal — the reader is told the rest of the page is inert
  // and then left standing in it. The `tabindex` was drawn for this and had no caller.
  scrim.querySelector<HTMLElement>('[data-whats-new]')?.focus()

  const put = (body: Record<string, unknown>): Promise<unknown> =>
    fetch('/api/settings', {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    }).catch(() => null)

  // SAVED ON THE PRESS rather than on Done, so the choice survives a panel closed by the
  // Escape key or a reload — and so the blog is already wearing it when they go and look.
  for (const key of scrim.querySelectorAll<HTMLButtonElement>('[data-news-look]')) {
    key.addEventListener('click', () => {
      for (const other of scrim.querySelectorAll('[data-news-look]')) {
        other.setAttribute('aria-pressed', String(other === key))
      }
      void put({ look: key.dataset.newsLook })
    })
  }

  const shut = (): void => {
    scrim.remove()
    // ⚠️ WRITTEN LAST, and a failure here is the right failure: the panel is gone for this
    // page load and comes back on the next one. The news is worth showing twice; never
    // showing it is worse.
    void put({ seenRelease: done.dataset.newsVersion })
  }
  done.addEventListener('click', shut)
  scrim.addEventListener('mousedown', (e) => { if (e.target === scrim) shut() })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && scrim.isConnected) shut()
  })
}
