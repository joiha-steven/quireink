// Register the service worker — or take it back off the reader's device.
//
// The second half is the half that matters. A service worker outlives the page that
// installed it: switching the feature off in Settings does nothing at all for anyone who
// has already visited, unless something on the next page they load says so. So this runs on
// EVERY public page, and the absence of `data-sw` is an instruction, not a no-op.
//
// ADR 0039 for why the feature exists and what it may cache.

import { label } from './dom'

/** Everything this product ever puts in the reader's cache storage is named `quire-*`. */
async function forget(): Promise<void> {
  for (const name of await caches.keys()) if (name.startsWith('quire-')) await caches.delete(name)
}

export function offline(): void {
  // Not supported, or not a secure context: `serviceWorker` is simply absent, and there is
  // nothing to register and nothing left behind to clean up.
  if (!('serviceWorker' in navigator)) return
  const src = label('sw')

  if (!src) {
    void navigator.serviceWorker.getRegistrations()
      .then(async (regs) => {
        // Nothing to do on the overwhelming majority of loads, and `getRegistrations`
        // resolving empty is what makes this free rather than merely cheap.
        if (!regs.length) return
        await Promise.all(regs.map((r) => r.unregister()))
        await forget()
      })
      .catch(() => {})
    return
  }

  // After load, not during it. Registration competes with the page's own requests for the
  // connection, and nothing on the screen is waiting for it — the worker's whole job starts
  // on the NEXT visit.
  addEventListener('load', () => {
    void navigator.serviceWorker.register(src).catch(() => {})
  })
}
