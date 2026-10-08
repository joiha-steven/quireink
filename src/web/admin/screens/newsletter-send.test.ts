// The Send list (2026-09-30): an untitled post showed as a bare date, the date was the UTC day,
// and at 390px the list ran 95px off the page.
import { describe, expect, it } from 'bun:test'
import { adminT } from '@/i18n/admin-i18n'
import { sendPanel } from './newsletter-send'
import type { Post } from '@/types'
import { plural } from '@/i18n/plural'

const t = adminT('en')
const post = (over: Partial<Post>): Post => ({
  title: '', slug: 'x', date: '2026-09-29T23:30:00.000Z', status: 'published', categories: [], tags: [],
  excerpt: 'Just a quick thought about reed pens again', ...over,
} as Post)

describe('the send list', () => {
  it('names an untitled post by its words, dates it on the site clock, and cannot widen the page', () => {
    const html = sendPanel(t, 'en', [{ ...post({}), stats: null }] as never, true, 'Asia/Ho_Chi_Minh')
    expect(html).toContain('Just a quick thought')
    // 23:30 UTC on the 29th is the 30th in Hanoi.
    expect(html).toContain('9/30/26')
    expect(html).toContain('grid grid-cols-1')
  })
})

describe('what the send list ticks first', () => {
  // `sent` counts rows (a resend doubles it); `reached` is who got it, once each.
  const sent = (slug: string, n: number, reached: number[] = []) => ({ ...post({ slug, title: slug }), stats: n ? { sent: n } : null, reached })
  const ticked = (html: string): string[] =>
    [...html.matchAll(/<input type="checkbox" data-nl-post value="([^"]*)"[^>]* checked /g)].map((m) => m[1] ?? '')

  it('never pre-ticks a post that already went out: the newest UNSENT one, or nothing', () => {
    const newestSent = sendPanel(t, 'en', [sent('a', 6, [0, 1, 2]), sent('b', 0), sent('c', 0)] as never, true, '')
    expect(ticked(newestSent)).toEqual(['b'])
    // Six rows, three people: a resend is not three more addresses.
    expect(newestSent).toContain('data-sent="3" data-reached="0,1,2"')
    const allSent = sendPanel(t, 'en', [sent('a', 3), sent('b', 1)] as never, true, '')
    expect(ticked(allSent)).toEqual([])
    // Nothing ticked means the button is off in the first response.
    expect(allSent).toMatch(/data-nl-send class="[^"]*" disabled/)
  })

  it('counts addresses with the language’s plural', () => {
    expect(plural(t.nlAlreadySent, 1, 'en')).toBe('Already sent to 1 address.')
    expect(plural(t.nlAlreadySent, 2, 'en')).toBe('Already sent to 2 addresses.')
    expect(plural(adminT('ru').nlAlreadySent, 3, 'ru')).toBe('Уже отправлено на 3 адреса.')
    expect(plural(adminT('ru').nlAlreadySent, 5, 'ru')).toBe('Уже отправлено на 5 адресов.')
  })
})
