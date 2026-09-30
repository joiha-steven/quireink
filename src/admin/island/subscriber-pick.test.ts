// "Select every match" ticks the subscribers the filter matches on EVERY page (2026-09-30):
// the CSV export takes ticked rows only, and 500 subscribers was 500 boxes.
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { adminT } from '@/i18n/admin-i18n'
import { peoplePanel } from '@/web/admin/screens/newsletter-people'
import { wireSubscribers } from './lib/subscriber-list'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

const t = adminT('en')
const subscribers = Array.from({ length: 60 }, (_, i) => ({
  id: i + 1, email: `r${i + 1}@example.com`, status: i % 3 === 0 ? 'pending' : 'confirmed',
  createdAt: '2026-09-01T00:00:00Z', stats: { sent: 0, failed: 0, opened: 0 },
}))

function mount(): HTMLElement {
  document.body.innerHTML = ''
  const screen = document.createElement('div')
  screen.innerHTML = peoplePanel(t, 'en', {
    subscribers, counts: { confirmed: 40, pending: 20, unsubscribed: 0 },
  } as unknown as Parameters<typeof peoplePanel>[2], true)
  document.body.append(screen)
  wireSubscribers(screen, { lang: 'en', words: {}, say: () => {} })
  return screen
}

const count = (screen: HTMLElement): string => screen.querySelector('[data-pick-count]')?.textContent ?? ''

describe('select every match', () => {
  it('ticks all sixty, past the first page of fifty', () => {
    const screen = mount()
    const all = screen.querySelector<HTMLInputElement>('[data-sub-all]')!
    all.checked = true
    all.dispatchEvent(new Event('change', { bubbles: true }))
    expect(count(screen)).toBe('60')
  })

  it('follows the filter: pending only is twenty, and one unticked leaves it half-ticked', () => {
    const screen = mount()
    screen.querySelector<HTMLElement>('[data-sub-scope] [data-tab="pending"]')!.click()
    const all = screen.querySelector<HTMLInputElement>('[data-sub-all]')!
    all.checked = true
    all.dispatchEvent(new Event('change', { bubbles: true }))
    expect(count(screen)).toBe('20')
    const one = screen.querySelector<HTMLInputElement>('[data-sub-pick][data-id="1"]')!
    one.checked = false
    one.dispatchEvent(new Event('change', { bubbles: true }))
    expect(count(screen)).toBe('19')
    expect(all.checked).toBe(false)
    expect(all.indeterminate).toBe(true)
  })
})
