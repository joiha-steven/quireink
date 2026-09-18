// THE TWO LISTS THAT GROW WITHOUT ANYBODY DECIDING TO GROW THEM.
//
// The library was paged first, and these are the same shape: a Trash that a single bulk delete
// fills with thousands, and a subscriber list that one sign-up at a time turns into twenty
// thousand rows (forty, counting the phone layout's second copy of each).
//
// Both slice in the screen rather than in SQL, and the two numbers that must NOT follow the
// slice are what this pins: the count beside each Trash tab, and the three totals above the
// people table. An owner comes to those for "how many", and a figure that changed as they
// turned pages would answer a question nobody asked.
import { describe, it, expect, afterAll, beforeEach } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { run } from '@/store/query'
import { getSettings } from '@/content/settings'
import { trashScreen } from './trash'
import { newsletterScreen } from './newsletter'
import { PEOPLE_PAGE } from '@/web/admin/views-news'

const DIR = './.tmp/test-screen-pager'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))
beforeEach(() => {
  db().run(`delete from posts`)
  db().run(`delete from subscribers`)
})

const TRASH_PAGE = 100
const now = Date.now()

/** A post already in the Trash, written straight in: this file is about the drawing. */
const trashed = (n: number) => {
  for (let i = 0; i < n; i++) {
    run(
      `insert into posts (slug, title, date, status, content, created_at, updated_at, deleted_at)
       values (?, ?, ?, 'draft', '', ?, ?, ?)`,
      `gone-${String(i).padStart(4, '0')}`, `Gone ${i}`, now - i, now - i, now - i, now - i,
    )
  }
}

const people = (n: number) => {
  for (let i = 0; i < n; i++) {
    run(
      `insert into subscribers (email, status, token, created_at, confirmed_at)
       values (?, 'confirmed', ?, ?, ?)`,
      `reader${String(i).padStart(4, '0')}@example.com`, `tok${i}`, now - i, now - i,
    )
  }
}

const rows = (html: string, mark: string) => (html.match(new RegExp(mark, 'g')) ?? []).length

describe('the Trash draws one page of a kind', () => {
  it('pages the rows and still counts the whole kind on the tab', async () => {
    trashed(TRASH_PAGE + 18)
    const html = await trashScreen(await getSettings(), new URLSearchParams())
    expect(rows(html, 'data-trash-row')).toBe(TRASH_PAGE)
    // The tab label carries the count, and it is the whole kind rather than the page.
    expect(html).toContain(`(${TRASH_PAGE + 18})`)
    expect(html).toContain('/admin/trash?tab=posts&amp;page=2')
  })

  it('turns to the rest, and offers no pager for a kind that fits', async () => {
    trashed(TRASH_PAGE + 18)
    const two = await trashScreen(await getSettings(), new URLSearchParams('tab=posts&page=2'))
    expect(rows(two, 'data-trash-row')).toBe(18)
    db().run(`delete from posts`)
    trashed(3)
    const small = await trashScreen(await getSettings(), new URLSearchParams())
    expect(small).not.toContain('data-pager')
  })
})

describe('the subscriber list draws one page', () => {
  it('pages the table and keeps the three totals whole', async () => {
    people(PEOPLE_PAGE + 40)
    const html = await newsletterScreen(await getSettings(), new URLSearchParams('tab=people'))
    // The table body and the phone list each draw the same page, so the row mark appears twice
    // per person: what matters is that it is the PAGE and not the list.
    expect(rows(html, 'reader0000@example.com')).toBeGreaterThan(0)
    expect(rows(html, 'reader0239@example.com')).toBe(0)
    expect(html).toContain(String(PEOPLE_PAGE + 40))
    expect(html).toContain('/admin/newsletter?tab=people&amp;page=2')
  })

  it('reaches the rest on page two', async () => {
    people(PEOPLE_PAGE + 40)
    const two = await newsletterScreen(await getSettings(), new URLSearchParams('tab=people&page=2'))
    expect(rows(two, 'reader0239@example.com')).toBeGreaterThan(0)
    expect(rows(two, 'reader0000@example.com')).toBe(0)
  })
})
