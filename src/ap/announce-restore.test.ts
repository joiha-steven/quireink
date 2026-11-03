// A POST THAT COMES BACK FROM THE TRASH REACHES ITS FOLLOWERS AGAIN (2026-11-04).
//
// Trash said `Delete` and restore said `Create` with the same object id. Mastodon keeps a
// `Tombstone` for every object id it is told is deleted, for good, and `Create#create_status`
// refuses any object whose id has one (`tombstone_exists?`); an `Update` finds no status and
// falls through to that same `Create`. So the post never showed again, and the activity ids
// (`#create`, `#delete`) repeated exactly on every round, which servers that drop a repeated
// activity id also discard. Each return now gets an id of its own, `<url>?r=<n>`, and the
// ledger keeps one row per address however many times the round is made.
import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import { dropDatabase, freshDatabase } from '@/test/db'
import { getSettings, saveSettings } from '@/content/settings'
import { savePost } from '@/content/posts'
import { deletePost, restorePost } from '@/content/posts-trash'
import { all, run } from '@/store/query'
import { addFollower } from '@/ap/store'
import { sweepAnnounce } from '@/ap/announce'

const DIR = './.tmp/test-ap-announce-restore'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const SITE = 'https://blog.example'
const URL = `${SITE}/comes-back`

const sweep = async () => sweepAnnounce({
  settings: { ...(await getSettings()), siteUrl: SITE, activitypub: { enabled: true, handle: 'quire' } },
  site: SITE, since: 0,
})

type Activity = { id: string; type: string; object: { id: string; type: string; url?: string } }
/** What the queue holds for the one follower, oldest first. */
const said = (): Activity[] =>
  all<{ body: string }>(`select body from ap_queue order by id`).map((r) => JSON.parse(r.body) as Activity)

beforeEach(async () => {
  for (const t of ['ap_sent', 'ap_queue', 'ap_followers', 'posts']) run(`delete from ${t}`)
  await saveSettings({ siteUrl: SITE, title: 'A Blog' })
  addFollower({ actor: 'https://m.test/u/1', inbox: 'https://m.test/u/1/inbox', sharedInbox: 'https://m.test/inbox' })
  await savePost({
    title: 'Comes back', slug: 'comes-back', content: 'Body.', status: 'published',
    date: new Date(Date.now() - 3600_000).toISOString(), categories: [], tags: [],
  } as Parameters<typeof savePost>[0])
})

describe('a post trashed and restored', () => {
  it('comes back under an id of its own, the page address kept as its url', async () => {
    await sweep()
    await deletePost('comes-back')
    await sweep()
    await restorePost('comes-back')
    expect((await sweep()).map((a) => [a.kind, a.objectId])).toEqual([['Create', `${URL}?r=1`]])

    const [create, del, back] = said()
    expect([create!.type, create!.object.id]).toEqual(['Create', URL])
    expect([del!.type, del!.object.id]).toEqual(['Delete', URL])
    expect(back!.type).toBe('Create')
    expect(back!.object.id).toBe(`${URL}?r=1`)
    expect(back!.object.url).toBe(URL)
    // Said once: the next pass has nothing to add.
    expect(await sweep()).toEqual([])
  })

  it('makes the round three times with one ledger row and no activity id said twice', async () => {
    await sweep()
    for (let i = 0; i < 3; i++) {
      await deletePost('comes-back')
      await sweep()
      await restorePost('comes-back')
      await sweep()
    }
    const ids = said().map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(said().map((a) => [a.type, a.object.id])).toEqual([
      ['Create', URL],
      ['Delete', URL], ['Create', `${URL}?r=1`],
      ['Delete', `${URL}?r=1`], ['Create', `${URL}?r=2`],
      ['Delete', `${URL}?r=2`], ['Create', `${URL}?r=3`],
    ])
    expect(all(`select object_id from ap_sent`)).toEqual([{ object_id: `${URL}?r=3` }])
    expect(await sweep()).toEqual([])
  })

  it('says Delete once for a post left in the Trash, and keeps its row to know the next id', async () => {
    await sweep()
    await deletePost('comes-back')
    expect((await sweep()).map((a) => a.kind)).toEqual(['Delete'])
    expect(await sweep()).toEqual([])
    expect(all<{ object_id: string }>(`select object_id from ap_sent`)).toEqual([{ object_id: URL }])
  })

  it('edits a returned post as an Update of its new id', async () => {
    await sweep()
    await deletePost('comes-back')
    await sweep()
    await restorePost('comes-back')
    await sweep()
    await savePost({
      title: 'Comes back, corrected', slug: 'comes-back', content: 'Body.', status: 'published',
      date: new Date(Date.now() - 3600_000).toISOString(), categories: [], tags: [],
    } as Parameters<typeof savePost>[0], 'comes-back')
    expect((await sweep()).map((a) => [a.kind, a.objectId])).toEqual([['Update', `${URL}?r=1`]])
  })
})
