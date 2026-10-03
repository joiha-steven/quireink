// Run on Cloudflare (G5.3), in a real browser. The move itself needs a Cloudflare account and is
// proved against one by hand before a release; what is held here is the card a Bun owner sees: it
// is on the Server tab, its Move key is disabled until a check has said yes, and its two secrets —
// the token and the password — ship empty and are never settings (no `data-k`), so the sheet's
// Save can never carry a credential into the database.
import type { Tour } from './tour'

export function registerCloudFlows({ flow, expect }: Pick<Tour, 'flow' | 'expect'>): void {
  flow('admin: Run on Cloudflare asks before it moves, and its secrets are not settings', () => expect('/admin/settings?tab=server', `
    (() => {
      const card = document.querySelector('[data-cf-card]')
      if (!card) return 'no Run on Cloudflare card on the Server tab of a Bun install'
      const move = card.querySelector('[data-cf-move]')
      if (!move || !move.disabled) return 'the Move key is armed before any check'
      const secrets = [...card.querySelectorAll('[data-cf-token], [data-cf-current]')]
      if (secrets.length !== 2) return secrets.length + ' secret box(es), expected the token and the password'
      if (secrets.some((el) => el.type !== 'password' || el.value !== '' || el.hasAttribute('data-k'))) return 'a secret box is visible, filled, or a setting'
      if (card.querySelector('[data-cf-account]').hasAttribute('data-k')) return 'the account ID is a setting'
      if (!card.querySelector('[data-cf-steps]').hidden) return 'the steps show before a move'
      if (card.querySelectorAll('[data-cf-step]').length !== 6) return 'expected six steps drawn'
      const words = JSON.parse(card.dataset.cfWords || '{}')
      if (!words.done || !words.domainNote) return 'the card carries no words for the island'
      return 'ok (Move disabled, 2 empty secret boxes, 6 steps drawn and hidden)'
    })()`, 1500))
}
