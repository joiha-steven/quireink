// THE MODEL CARD: a provider, a key, and the one request that proves both.
//
// ⚠️ DRAWN AND WIRED TO NOTHING UNTIL 2026-09-15. Every hook on this card — the provider menu,
// Load models, the model menu, the four refusal sentences, the two notes that appear once a key
// is stored — was rendered by ADR 0054 and read by no island. The card's own comment describes
// behaviour that never ran: "the island removes `disabled` and fills it once the provider has
// replied". Nothing did.
//
// ⚠️ LISTING THE MODELS IS THE TEST. `POST /api/integrations/ai/models` is the cheapest request
// that still has to authenticate, so it answers four different failures rather than one — a
// rejected key (fix the key), a throttle (wait), an unreachable provider (check the network),
// and a provider that answered something else. One sentence for all four produced a card that
// said "check the key" when the real answer was an office firewall.
//
// ⚠️ IT TRIES THE TYPED KEY BEFORE IT IS STORED. That is the whole point of the button: the
// owner pastes a key, sees the menu appear, and knows it works before committing it. So the
// request carries whatever is in the box, and the route falls back to the stored one when the
// box is empty.
import { show, type ListWords } from './list-dom'

type Listing =
  | { ok: true; models: { id: string; label: string }[] }
  | { ok: false; code: 'bad_key' | 'rate_limited' | 'refused' | 'unreachable'; status: number; detail: string }

/**
 * A refusal's code, and the attribute carrying its sentence.
 *
 * ⚠️ WRITTEN OUT, NOT DERIVED. `rate_limited` is drawn as `data-say-limited`, so a rule that
 * turned the code into the attribute would miss it — and miss it silently, leaving the owner
 * with a blank line where the reason should be.
 */
const SAID: Record<string, string> = {
  bad_key: 'data-say-bad-key',
  rate_limited: 'data-say-limited',
  refused: 'data-say-refused',
  unreachable: 'data-say-unreachable',
}

export function wireAi(screen: HTMLElement, _w: ListWords): void {
  const card = screen.querySelector<HTMLElement>('[data-ai-said]')?.closest<HTMLElement>('[data-card]')
  if (!card) return
  const provider = card.querySelector<HTMLSelectElement>('[data-ai-provider]')
  const keyBox = card.querySelector<HTMLInputElement>('[data-ai-key]')
  const load = card.querySelector<HTMLButtonElement>('[data-ai-models-load]')
  const said = card.querySelector<HTMLElement>('[data-ai-said]')
  const menu = card.querySelector<HTMLSelectElement>('[data-ai-model]')
  const menuBox = card.querySelector<HTMLElement>('[data-ai-model-box]')

  const sentence = (hook: string): string =>
    said?.getAttribute(hook) ?? ''

  /** Three lines, one at a time: reading, the verdict, or the reason it did not work. */
  const say = (state: 'loading' | 'ok' | 'bad' | 'none', text = ''): void => {
    show(card.querySelector('[data-ai-loading]'), state === 'loading')
    const ok = card.querySelector<HTMLElement>('[data-ai-ok]')
    const bad = card.querySelector<HTMLElement>('[data-ai-bad]')
    if (ok) { ok.textContent = state === 'ok' ? text : ''; ok.hidden = state !== 'ok' }
    if (bad) { bad.textContent = state === 'bad' ? text : ''; bad.hidden = state !== 'bad' }
  }

  /** Everything below the provider is a question ABOUT a provider, so it goes when none is picked. */
  const settle = (): void => {
    const on = (provider?.value ?? '') !== ''
    show(card.querySelector('[data-ai-when-on]'), on)
    if (load) load.disabled = !on
  }
  provider?.addEventListener('change', () => { settle(); say('none') })
  settle()

  load?.addEventListener('click', () => {
    void (async () => {
      const which = provider?.value ?? ''
      if (!which) return
      const label = load.textContent
      load.disabled = true
      say('loading')
      try {
        const res = await fetch('/api/integrations/ai/models', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ provider: which, apiKey: keyBox?.value ?? '' }),
        })
        if (res.status === 401) {
          location.href = `/login?next=${encodeURIComponent(location.pathname + location.search)}`
          return
        }
        const json = await res.json().catch(() => null) as
          { success?: boolean; data?: Listing } | null
        // ⚠️ THE ENVELOPE AND THE VERDICT ARE DIFFERENT QUESTIONS. A refused key is a 200
        // carrying `ok: false`, because "the provider rejected it" is an ANSWER; only a broken
        // request reaches the outer failure, and the two must not be reported the same way.
        if (!json?.success || !json.data) { say('bad', sentence('data-say-failed')); return }
        const listing = json.data
        if (!listing.ok) {
          const text = listing.code === 'refused'
            ? sentence('data-say-refused').replace('{status}', String(listing.status))
            : sentence(SAID[listing.code] ?? 'data-say-failed')
          say('bad', text || sentence('data-say-failed'))
          return
        }
        fill(listing.models)
        say('ok', sentence('data-tpl-ok').replace('{n}', String(listing.models.length)))
      } catch {
        say('bad', sentence('data-say-failed'))
      } finally {
        load.disabled = (provider?.value ?? '') === ''
        load.textContent = label
      }
    })()
  })

  /**
   * ⚠️ THE MENU IS FILLED, AND THE CHOICE KEPT. The card ships holding the ONE model the server
   * knows it is using, disabled — obviously not a menu, still an answer — and this is the moment
   * it becomes one. An `<option>` built here carries no class and no translated word: it is the
   * provider's own data, which is the one kind of markup an island is the right place for.
   */
  function fill(models: { id: string; label: string }[]): void {
    if (!menu) return
    const chosen = menu.value
    menu.replaceChildren(...models.map((m) => {
      const option = document.createElement('option')
      option.value = m.id
      option.textContent = m.label
      return option
    }))
    // A model that is stored but no longer offered stays selectable rather than vanishing: the
    // blog is using it, and a menu that quietly drops it would change the model on the next save.
    if (chosen && !models.some((m) => m.id === chosen)) {
      const keep = document.createElement('option')
      keep.value = chosen
      keep.textContent = chosen
      menu.prepend(keep)
    }
    menu.value = chosen || models[0]?.id || ''
    menu.disabled = models.length === 0
    show(menuBox, true)
  }
}
