// THE ONE THING THE CONTENT API CARD DOES IN THE BROWSER: put its address on the clipboard.
//
// ADR 0057. The switch itself needs nothing here — it is an ordinary `data-k` settings key, so
// the generic form collector reads it and the card's own Save sends it — and the address block
// is opened and shut by `data-gate-live`, which `settings-controls.ts` already applies. What is
// left is one key, and a key with no handler is exactly the fault `check:admin-wired` exists for
// (eight of them shipped that way on 2026-09-15).
//
// Its own file rather than a branch inside `settings-mcp.ts`: the two cards look alike and are
// not the same thing, and a hook named for one card living in the other's file is how a rename
// in either takes the other's control down with it.
import { copy } from './list-dom'
import type { ListWords } from './list-dom'

export function wireApi(screen: HTMLElement, w: ListWords): void {
  screen.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    if (!target.closest('[data-api-copy]')) return
    // Read off the element the SERVER printed it into. This island does not know the site's
    // address — `resolveSiteUrl` falls back to an environment variable no page can see — and
    // guessing at `location.origin` is how a copied URL points at the admin's own hostname on
    // an install that is reached through a proxy under a different name.
    const url = screen.querySelector<HTMLElement>('[data-api-url]')?.textContent?.trim()
    if (url) void copy(url, w.apiUrlCopied ?? '')
  })
}
