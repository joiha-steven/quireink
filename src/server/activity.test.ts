// The activity log has one rule that is easy to break and invisible when broken: it must
// never throw. It sits inside the action being logged, so a failure here would take down
// a save. The owner's off switch is the second rule.
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { one } from '@/store/query'
import { logActivity, logActivityError, getActivity, clearActivity } from '@/server/activity'
import { saveSettings, DEFAULT_SETTINGS } from '@/content/settings'

const DIR = './.tmp/test-activity'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

beforeEach(() => {
  db().run(`delete from activity_log`)
  db().run(`delete from settings`)
})

describe('logActivity', () => {
  it('records an action and reads it back newest first', async () => {
    await logActivity('post.create', 'hello-world')
    await logActivity('settings.save')
    const log = await getActivity()
    expect(log.map((e) => e.action)).toEqual(['settings.save', 'post.create'])
    expect(log[1]).toMatchObject({ action: 'post.create', detail: 'hello-world' })
    expect(log[0]!.at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('writes nothing when the owner turns the log off', async () => {
    await saveSettings({ features: { ...DEFAULT_SETTINGS.features, activityLog: false } })
    await logActivity('post.create', 'x')
    await logActivityError('POST /api/posts', 'boom')
    expect(await getActivity()).toEqual([])
  })

  it('truncates a long detail rather than rejecting the write', async () => {
    await logActivity('error', 'x'.repeat(900))
    expect((await getActivity())[0]!.detail).toHaveLength(500)
  })

  it('never throws, even with the table gone', async () => {
    db().run(`drop table activity_log`)
    expect(await logActivity('post.create', 'x')).toBeUndefined()
    expect(await getActivity()).toEqual([])
    db().run(`create table activity_log (
      id integer primary key autoincrement, at integer not null,
      action text not null, detail text not null default '')`)
  })

  it('records a server error with its context', async () => {
    await logActivityError('POST /api/posts/foo', 'boom')
    const entry = (await getActivity())[0]!
    expect(entry.action).toBe('error')
    expect(entry.detail).toContain('POST /api/posts/foo')
    expect(entry.detail).toContain('boom')
  })
})

describe('reads', () => {
  it('honours the limit', async () => {
    for (let i = 0; i < 5; i++) await logActivity('post.update', `p${i}`)
    expect(await getActivity(2)).toHaveLength(2)
  })

  it('orders a same-millisecond burst by id, not arbitrarily', async () => {
    for (const slug of ['a', 'b', 'c']) await logActivity('post.update', slug)
    db().run(`update activity_log set at = 1000`) // force the tie
    expect((await getActivity()).map((e) => e.detail)).toEqual(['c', 'b', 'a'])
  })

  it('clears the whole log', async () => {
    await logActivity('post.create', 'x')
    await clearActivity()
    expect(one<{ n: number }>(`select count(*) n from activity_log`)!.n).toBe(0)
  })
})
