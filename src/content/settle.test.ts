// Reading time recounted once after migration 021 (2026-09-30): Chinese and Japanese were
// counted by spaces they do not write, and every stored count is recounted at boot.
import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { one } from '@/store/query'
import { savePost } from '@/content/posts'
import { settleReadingMinutes } from '@/content/settle'

const DIR = './.tmp/test-settle'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))
beforeEach(() => db().run(`delete from posts`))

describe('settleReadingMinutes', () => {
  it('recounts the rows the migration marked, and only those', async () => {
    await savePost({ title: '中文', content: '字'.repeat(800), status: 'published', date: '2020-01-01T00:00:00.000Z' })
    await savePost({ title: 'English', content: 'word '.repeat(600), status: 'published', date: '2020-01-01T00:00:00.000Z' })
    // As the migration leaves an existing blog: every count unknown.
    db().run(`update posts set reading_minutes = -1 where slug = 'zhong-wen' or title = '中文'`)
    const minutes = (title: string) => one<{ m: number }>(`select reading_minutes as m from posts where title = ?`, title)!.m
    expect(minutes('中文')).toBe(-1)
    expect(settleReadingMinutes()).toBe(1)
    expect(minutes('中文')).toBe(2)
    expect(minutes('English')).toBe(3)
    // A boot with nothing marked reads nothing.
    expect(settleReadingMinutes()).toBe(0)
  })
})
