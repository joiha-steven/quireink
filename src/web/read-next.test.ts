// The pointer forward at the end of an article: next in the series when there is one,
// else the adjacent post — older first, newer only from the oldest post. Its own file
// (same harness as pages.test.ts, own database directory).
import { describe, expect, it, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { savePost } from '@/content/posts'
import { getSettings, saveSettings } from '@/content/settings'
import { clearCache } from '@/server/cache'
import { createApp } from '@/web/app'

const DIR = './.tmp/test-read-next'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
const html = async (path: string): Promise<string> => (await app.request(path)).text()

const DAY = (n: number) => `2020-01-0${n}T00:00:00.000Z`

beforeEach(() => {
  clearCache()
  for (const t of ['posts', 'post_terms', 'post_revisions', 'settings']) {
    db().run(`delete from ${t}`)
  }
})

const publish = (title: string, day: number, over: Record<string, unknown> = {}) =>
  savePost({ title, content: 'body text here', status: 'published', date: DAY(day), ...over })

describe('read next', () => {
  it('points a mid-archive post at its older neighbour', async () => {
    await publish('Oldest', 1)
    await publish('Middle', 2)
    await publish('Newest', 3)
    const page = await html('/middle')
    expect(page).toContain('class="read-next"')
    expect(page).toContain('href="/oldest"')
    expect(page).not.toContain('href="/newest">Newest</a></p></section>')
  })

  it('points the oldest post forward, because back is nothing', async () => {
    await publish('Oldest', 1)
    await publish('Newest', 2)
    const page = await html('/oldest')
    expect(page).toContain('class="read-next"')
    expect(page).toContain('href="/newest"')
  })

  it('prefers the next part of a series over the calendar', async () => {
    await publish('Part one', 1, { series: 'Letters', seriesOrder: 1 })
    await publish('Part two', 2, { series: 'Letters', seriesOrder: 2 })
    await publish('Unrelated, newest', 3)
    const page = await html('/part-one')
    // The series label, not the plain one — and the link goes to part two, not to the
    // chronological neighbour.
    expect(page).toContain('Next in the series')
    expect(page).toContain('class="read-next-title reading-font"><a class="link-accent" href="/part-two"')
  })

  it('is absent on the only post, and absent when the owner turns it off', async () => {
    await publish('Alone', 1)
    expect(await html('/alone')).not.toContain('class="read-next"')

    await publish('Another', 2)
    const { features } = await getSettings()
    await saveSettings({ features: { ...features, readNext: false } })
    clearCache()
    expect(await html('/alone')).not.toContain('class="read-next"')
  })
})
