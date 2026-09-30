// The Send list (2026-09-30): an untitled post showed as a bare date, the date was the UTC day,
// and at 390px the list ran 95px off the page.
import { describe, expect, it } from 'bun:test'
import { adminT } from '@/i18n/admin-i18n'
import { sendPanel } from './newsletter-send'
import type { Post } from '@/types'

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
