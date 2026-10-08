// The log prints a piece's title where it stored the slug (2026-10-08): the editor shows the
// title, and the ledger said `Wrote 'the-golden-canon-and-its-arithmetic'`.
import { afterAll, describe, expect, it } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { DEFAULT_SETTINGS } from '@/content/settings'
import { savePost } from '@/content/posts'
import { logActivity, getActivity } from '@/server/activity'
import { logScreen, namedDetails } from '@/web/admin/screens/log'
import { all } from '@/store/query'

const DIR = './.tmp/test-log-title'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const settings = { ...DEFAULT_SETTINGS, features: { ...DEFAULT_SETTINGS.features, activityLog: true } }

describe('the log names a piece by its title', () => {
  it('swaps a stored slug for the title, keeps the slug findable, and rewrites nothing stored', async () => {
    await savePost({ title: 'The golden canon', slug: 'the-golden-canon', date: new Date().toISOString(), status: 'published', content: 'Body.' })
    await logActivity('post.delete', 'the-golden-canon')
    await logActivity('post.delete', 'a-slug-with-no-piece')
    const html = await logScreen(settings)
    expect(html).toContain('Moved “The golden canon” to the trash')
    // The slug still finds the row.
    expect(html).toMatch(/data-find="[^"]*the-golden-canon/)
    // A slug with no piece behind it prints as stored.
    expect(html).toContain('Moved “a-slug-with-no-piece” to the trash')
    // Stored data is untouched.
    expect(all<{ detail: string }>(`select detail from activity_log where action = 'post.delete' order by id`).map((r) => r.detail))
      .toEqual(['the-golden-canon', 'a-slug-with-no-piece'])
  })

  it('leaves entries alone when no title is known', async () => {
    const entries = await getActivity()
    expect(namedDetails(entries, new Map())).toEqual(entries)
  })

  it('does not give an old row to whatever took its slug since', () => {
    const at = '2026-10-01T00:00:00.000Z'
    const row = (action: string, detail: string, when = at) => ({ id: 1, at: when, action, detail }) as never
    const created = Date.parse('2026-10-05T00:00:00.000Z')
    const holders = new Map([['post:foo', { title: 'B, the newer piece', created }]])
    // Written before B existed: it was about the previous holder of `foo`.
    expect(namedDetails([row('post.delete', 'foo')], holders)[0]?.detail).toBe('foo')
    // Written after B existed: it is B's.
    expect(namedDetails([row('post.delete', 'foo', '2026-10-06T00:00:00.000Z')], holders)[0]?.detail).toBe('B, the newer piece')
  })

  it('leaves a create row alone when its text is also a title', () => {
    const holders = new Map([['post:foo', { title: 'Another piece', created: 0 }]])
    const e = [{ id: 1, at: '2026-10-06T00:00:00.000Z', action: 'post.create', detail: 'foo' }] as never
    expect(namedDetails(e, holders, new Set(['post:foo']))[0]?.detail).toBe('foo')
    expect(namedDetails(e, holders)[0]?.detail).toBe('Another piece')
  })
})
