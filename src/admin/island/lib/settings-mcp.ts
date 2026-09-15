// THE MCP TOKENS: the table, and the five keys around it.
//
// ⚠️ THE KEYS WERE MARKUP AND NOTHING ELSE UNTIL 2026-09-15. ADR 0054 drew this card as HTML
// with a hook on every control, the table's filler was written, and Generate, Refresh, Copy,
// Delete and the once-only box never were. Every one of them was a key on the screen that did
// nothing when pressed: no request, no error, no sentence. `docs/spec/07-parity-admin.md` §13
// says tokens are "minted there, shown once, stored hashed", and on a fresh install none of
// that was reachable — the card could only list tokens that arrived through the consent flow,
// and it could not revoke one, which is the authority `docs/mcp.md` says the admin holds.
//
// The card's own header comment said the table had no server read. That stopped being true
// when `fillTokens` landed, and the stale sentence is a large part of why the rest was not
// missed: a file that says a control is inert reads as intended rather than unfinished.
//
// ⚠️ A TOKEN'S PLAINTEXT EXISTS ONLY IN THE REPLY THAT MINTS IT. The table holds a prefix and a
// hash; nothing on the server can show a token again. So the box below is the one chance, and
// it is drawn by the SERVER with its warning already in it — the island only fills the code and
// unhides it. A token assembled into markup here would be a credential this file had to be
// trusted not to leave lying in the DOM of a screen with seven other tabs on it.
import type { McpTokenWire } from '@/admin-shared/wire'
import { formatDateTimeShort } from '@/admin-shared/when'
import { say } from './media-bridge'
import { broke, copy, put, read, row, show, type ListWords } from './list-dom'

/** The scope the two boxes ask for. Neither ticked is `full`, which is what a token used to be. */
function scope(screen: HTMLElement): 'read' | 'admin' | 'full' {
  const ticked = (hook: string): boolean =>
    screen.querySelector<HTMLInputElement>(`[${hook}]`)?.checked === true
  if (ticked('data-mcp-scope-read')) return 'read'
  return ticked('data-mcp-scope-code') ? 'admin' : 'full'
}

/**
 * The name, asked for in the product's own dialog.
 *
 * ⚠️ AN UNHEARD ASK RESOLVES NULL, not a token named "". `overlay-confirm.ts` is wired once by
 * the rail island; a page whose rail failed to mount must not leave this awaiting a promise
 * that never settles, and must certainly not mint something nobody asked for.
 */
function askName(w: ListWords): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    const heard = !window.dispatchEvent(new CustomEvent('quire:confirm', {
      cancelable: true,
      detail: {
        request: {
          title: w.mcpGenerate ?? '',
          input: { label: w.mcpNamePrompt ?? '', placeholder: 'Claude desktop' },
          confirmLabel: w.mcpGenerate ?? '',
          cancelLabel: w.no ?? '',
        },
        respond: (answer: string, value: string) =>
          resolve(answer === 'confirm' ? (value ?? '').trim() : null),
      },
    }))
    if (!heard) resolve(null)
  })
}

async function mint(screen: HTMLElement, w: ListWords): Promise<void> {
  const name = await askName(w)
  // ⚠️ AN EMPTY NAME IS A REFUSAL HERE, unlike the link box where it is the gesture that
  // removes a link. The route answers 400 to a nameless token, and asking again is a worse
  // answer than doing nothing to a dialog somebody dismissed with the keyboard.
  if (!name) return
  const res = await fetch('/api/mcp/tokens', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, scope: scope(screen) }),
  }).catch(() => null)
  const json = await res?.json().catch(() => null) as
    { success?: boolean; error?: string; data?: { token?: string } } | null
  if (!json?.success || !json.data?.token) {
    say(json?.error === 'token_limit' ? (w.mcpLimit ?? '') : (w.mcpCreateFailed ?? ''), 'error')
    return
  }
  const box = screen.querySelector<HTMLElement>('[data-mcp-created]')
  put(box ?? screen, 'data-mcp-token', json.data.token)
  show(box, true)
  await fillTokens(screen)
}

async function revoke(screen: HTMLElement, id: string, name: string, w: ListWords): Promise<void> {
  // ⚠️ IT ASKS, because a revoked token cannot be un-revoked: the plaintext is gone and every
  // client signed in with it stops at once. The dialog names the token, which is the whole
  // reason the question is worth asking on a card that can hold five of them.
  const heard = await new Promise<boolean>((resolve) => {
    const unheard = window.dispatchEvent(new CustomEvent('quire:confirm', {
      cancelable: true,
      detail: {
        request: {
          title: (w.askTokenTitle ?? '').replace('{name}', name),
          body: w.askTokenBody ?? '',
          confirmLabel: w.yes ?? '', cancelLabel: w.no ?? '', danger: true,
        },
        respond: (answer: string) => resolve(answer === 'confirm'),
      },
    }))
    if (unheard) resolve(false)
  })
  if (!heard) return
  const res = await fetch(`/api/mcp/tokens/${id}`, { method: 'DELETE' }).catch(() => null)
  if (!res?.ok) { say(w.deleteFailed ?? '', 'error'); return }
  say(w.mcpTokenDeleted ?? '')
  await fillTokens(screen)
}

export async function fillTokens(screen: HTMLElement): Promise<void> {
  const rows = screen.querySelector<HTMLElement>('[data-mcp-rows]')
  if (!rows) return
  const tokens = await read<McpTokenWire[]>('/api/mcp/tokens')
  if (!tokens) {
    broke(rows.closest('section'), 'data-mcp-failed', ['data-mcp-none', 'data-mcp-table'])
    return
  }
  show(rows.closest('section')?.querySelector('[data-mcp-failed]') ?? null, false)
  paintTokens(rows, tokens)
}

function paintTokens(rows: HTMLElement, tokens: McpTokenWire[]): void {
  const made = tokens.map((tk) => row(rows, (el) => {
    el.dataset.mcpTokenRow = String(tk.id)
    put(el, 'data-mcp-name', tk.name)
    put(el, 'data-mcp-prefix', tk.prefix)
    // The admin's own stamp in all three columns, which is what the React table printed. Cut
    // to ten characters they were a different format from every other date on this screen.
    put(el, 'data-mcp-made', formatDateTimeShort(tk.createdAt))
    // NEVER-USED IS A DRAWN SPAN, not a word this file holds. The template ships both halves
    // and the island shows one; a string here would be an untranslated twelfth locale.
    put(el, 'data-mcp-used', tk.lastUsedAt ? formatDateTimeShort(tk.lastUsedAt) : '')
    show(el.querySelector('[data-mcp-used]'), tk.lastUsedAt != null)
    show(el.querySelector('[data-mcp-never]'), tk.lastUsedAt == null)
    // The expiry column, and the word that replaces it once the date has passed. `expired` is
    // the SERVER's answer against the server's clock: a browser with a wrong clock must not be
    // what decides whether a token still works, because it is not what the route asks.
    put(el, 'data-mcp-expires', formatDateTimeShort(tk.expiresAt))
    show(el.querySelector('[data-mcp-expires]'), !tk.expired)
    show(el.querySelector('[data-mcp-expired]'), tk.expired)
    // A BADGE ONLY WHEN THE GRANT IS NARROWER THAN FULL. `full` is what every token was before
    // scopes existed and what an unaware client still expects, so it is the unremarkable case
    // and labelling it would make the two that matter harder to pick out of the table.
    show(el.querySelector('[data-mcp-scope]'), tk.scope !== 'full')
    show(el.querySelector('[data-mcp-badge-read]'), tk.scope === 'read')
    show(el.querySelector('[data-mcp-badge-code]'), tk.scope !== 'read')
  })).filter((el): el is HTMLElement => el !== null)
  rows.replaceChildren(...made)
  const card = rows.closest('section')
  show(card?.querySelector('[data-mcp-table]') ?? null, made.length > 0)
  show(card?.querySelector('[data-mcp-none]') ?? null, made.length === 0)
}

export function wireMcp(screen: HTMLElement, w: ListWords): void {
  void fillTokens(screen)

  // ⚠️ THE TWO SCOPES ARE MUTUALLY EXCLUSIVE and nothing on the server enforces it, because
  // neither box stores anything: they describe the NEXT token, not a setting. "Reads nothing
  // but may set the custom head HTML" is not a grant anybody means to ask for.
  const readBox = screen.querySelector<HTMLInputElement>('[data-mcp-scope-read]')
  const codeBox = screen.querySelector<HTMLInputElement>('[data-mcp-scope-code]')
  readBox?.addEventListener('change', () => { if (readBox.checked && codeBox) codeBox.checked = false })
  codeBox?.addEventListener('change', () => { if (codeBox.checked && readBox) readBox.checked = false })

  screen.addEventListener('click', (e) => {
    const target = e.target as HTMLElement

    if (target.closest('[data-mcp-generate]')) { void mint(screen, w); return }
    if (target.closest('[data-mcp-refresh]')) { void fillTokens(screen); return }

    // The endpoint beside the Copy key, read off the element the server printed it into —
    // this island does not know the origin and must not guess at one.
    if (target.closest('[data-mcp-copy]')) {
      const url = screen.querySelector<HTMLElement>('[data-mcp-url]')?.textContent?.trim()
      if (url) void copy(url, w.mcpUrlCopied ?? '')
      return
    }

    if (target.closest('[data-mcp-copy-token]')) {
      const token = screen.querySelector<HTMLElement>('[data-mcp-token]')?.textContent?.trim()
      if (token) void copy(token, w.mcpCopied ?? '')
      return
    }

    // Shutting the box is the only way the plaintext leaves the page short of a reload, so it
    // is cleared rather than merely hidden.
    if (target.closest('[data-mcp-close]')) {
      const box = screen.querySelector<HTMLElement>('[data-mcp-created]')
      put(box ?? screen, 'data-mcp-token', '')
      show(box, false)
      return
    }

    const gone = target.closest<HTMLElement>('[data-mcp-delete]')
    const line = gone?.closest<HTMLElement>('[data-mcp-token-row]')
    const id = line?.dataset.mcpTokenRow
    if (gone && id) {
      const name = line?.querySelector<HTMLElement>('[data-mcp-name]')?.textContent ?? ''
      void revoke(screen, id, name, w)
    }
  })
}
