// The dashboard's one piece of behaviour (ADR 0054).
//
// THE WHOLE SCREEN IS READING except this. 1,276 lines of React across seven files, and one of
// them held state: whether the first-run band is open. Everything else — the greeting, the
// traffic card and its sparkline, the four widgets, the activity feed, the number strip, the
// system line — is drawn once and never changes, which is why this island is thirty lines and
// the screen it serves was the admin's slowest.
//
// Both states are in the markup, so opening the band again is an attribute rather than a fetch.
const root = document.querySelector<HTMLElement>('[data-screen="dashboard"]')
const band = root?.querySelector<HTMLElement>('[data-first-run-progress]')
const reopen = root?.querySelector<HTMLElement>('[data-first-run-reopen]')?.parentElement

if (root && band && reopen) {
  const show = (open: boolean): void => {
    band.hidden = !open
    reopen.hidden = open
  }

  /**
   * Dismissing writes ONE setting and leaves the link on the dashboard permanently.
   *
   * Fire and forget, and merged server-side like every other settings PUT: failing to record a
   * dismissal is not worth a toast, and the steps simply come back next time. RE-OPENING writes
   * nothing at all — looking at the steps again is not un-finishing setup.
   */
  root.querySelector('[data-first-run-dismiss]')?.addEventListener('click', () => {
    show(false)
    void fetch('/api/settings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ firstRunDone: true }),
    }).catch(() => undefined)
  })
  root.querySelector('[data-first-run-reopen]')?.addEventListener('click', () => show(true))
}
