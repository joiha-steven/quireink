// WHAT THE BLOG DECIDES TO SAY, and the one decision that cannot be taken back.
//
// The sweep is a comparison rather than a hook, so its whole behaviour is a function of two
// lists — the public posts, and what has already been announced. That makes it testable whole,
// which matters: every mistake here lands in a stranger's timeline and stays there.
import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import { dropDatabase, freshDatabase } from '@/test/db'
import { getSettings, saveSettings } from '@/content/settings'
import { savePost, deletePost } from '@/content/posts'
import { run } from '@/store/query'
import { addFollower } from '@/ap/store'
import { pendingAnnouncements, sweepAnnounce } from '@/ap/announce'
import { getPublicPosts } from '@/content/posts'

const DIR = './.tmp/test-ap-announce'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const SITE = 'https://blog.example'
const AGO = (ms: number): string => new Date(Date.now() - ms).toISOString()

const settingsWith = async () => {
  const s = await getSettings()
  return { ...s, siteUrl: SITE, activitypub: { enabled: true, handle: 'quire' } }
}

const pending = async (since: number) =>
  pendingAnnouncements({
    settings: await settingsWith(), site: SITE, since, posts: await getPublicPosts(),
  })

beforeEach(async () => {
  run(`delete from ap_sent`)
  run(`delete from ap_queue`)
  run(`delete from ap_followers`)
  run(`delete from posts`)
  await saveSettings({ siteUrl: SITE, title: 'A Blog' })
})

describe('the cutoff', () => {
  it('never announces anything written before the feature was switched on', async () => {
    // ⚠️ THE WORST THING THIS FEATURE COULD DO, and the naive state comparison does it on its
    // first run: a blog with ten years of writing switches the switch, and every follower who
    // arrives that afternoon is handed a decade of posts in one timeline. It cannot be undone,
    // it cannot be apologised for, and nothing about it looks wrong from inside this codebase.
    await savePost({
      title: 'Old', slug: 'old', content: 'Years ago.', status: 'published',
      date: AGO(400 * 24 * 3600_000), categories: [], tags: [],
    } as Parameters<typeof savePost>[0])
    const since = Date.now() - 24 * 3600_000
    expect(await pending(since)).toEqual([])

    // The counter-test: something written after the switch IS announced, so the empty answer
    // above is a cutoff rather than a sweep that does nothing.
    await savePost({
      title: 'New', slug: 'new', content: 'Today.', status: 'published',
      date: AGO(3600_000), categories: [], tags: [],
    } as Parameters<typeof savePost>[0])
    const work = await pending(since)
    expect(work.map((w) => w.kind)).toEqual(['Create'])
    expect(work[0]!.objectId).toBe(`${SITE}/new`)
  })
})

describe('the comparison', () => {
  const since = 0

  it('says Create once, and nothing at all the second time', async () => {
    await savePost({
      title: 'A piece', slug: 'a-piece', content: 'Body.', status: 'published',
      date: AGO(3600_000), categories: [], tags: [],
    } as Parameters<typeof savePost>[0])
    expect((await sweepAnnounce({ settings: await settingsWith(), site: SITE, since }))
      .map((a) => a.kind)).toEqual(['Create'])
    // ⚠️ REMEMBERED WHEN QUEUED, NOT WHEN DELIVERED. With nobody following there is nothing to
    // deliver — and a ledger written on delivery would announce this post again every minute
    // until somebody followed, then deliver it once as though it were new.
    expect(await sweepAnnounce({ settings: await settingsWith(), site: SITE, since })).toEqual([])
  })

  it('says Update when the words change, and stays quiet when they do not', async () => {
    // `previousSlug` on every save after the first: without it a save naming a slug that
    // already has a row is a CREATE, and the store refuses the collision.
    const make = (over: Record<string, unknown>, again = true) => savePost({
      title: 'A piece', slug: 'a-piece', content: 'Body.', status: 'published',
      date: AGO(3600_000), categories: [], tags: [], ...over,
    } as Parameters<typeof savePost>[0], again ? 'a-piece' : undefined)
    await make({}, false)
    await sweepAnnounce({ settings: await settingsWith(), site: SITE, since })

    // A category is not something a follower can see, and an Update that says nothing new is
    // noise in somebody else's timeline.
    await make({ categories: ['Typography'] })
    expect(await sweepAnnounce({ settings: await settingsWith(), site: SITE, since })).toEqual([])

    // The title is.
    await make({ title: 'A piece, corrected' })
    expect((await sweepAnnounce({ settings: await settingsWith(), site: SITE, since }))
      .map((a) => a.kind)).toEqual(['Update'])
  })

  it('says Delete when a post stops being public, whichever way it stopped', async () => {
    for (const [slug, stop] of [
      ['trashed', async () => { await deletePost('trashed') }],
      ['drafted', async () => {
        await savePost({
          title: 'D', slug: 'drafted', content: 'B.', status: 'draft',
          date: AGO(3600_000), categories: [], tags: [],
        } as Parameters<typeof savePost>[0], 'drafted')
      }],
    ] as [string, () => Promise<void>][]) {
      await savePost({
        title: 'D', slug, content: 'B.', status: 'published',
        date: AGO(3600_000), categories: [], tags: [],
      } as Parameters<typeof savePost>[0])
      await sweepAnnounce({ settings: await settingsWith(), site: SITE, since })
      await stop()
      const work = await sweepAnnounce({ settings: await settingsWith(), site: SITE, since })
      expect(work.map((a) => a.kind)).toEqual(['Delete'])
      expect(work[0]!.objectId).toBe(`${SITE}/${slug}`)
      // ...and it is said once. The ledger row is gone, so there is nothing left to compare.
      expect(await sweepAnnounce({ settings: await settingsWith(), site: SITE, since })).toEqual([])
    }
  })

  it('queues one delivery per address, sharing a server’s inbox', async () => {
    // Two followers on one server is ONE delivery when they share an inbox. The far end reads
    // the difference between one and two hundred as a neighbour or as an attack.
    addFollower({ actor: 'https://a.test/u/1', inbox: 'https://a.test/u/1/inbox', sharedInbox: 'https://a.test/inbox' })
    addFollower({ actor: 'https://a.test/u/2', inbox: 'https://a.test/u/2/inbox', sharedInbox: 'https://a.test/inbox' })
    addFollower({ actor: 'https://b.test/u/3', inbox: 'https://b.test/u/3/inbox', sharedInbox: null })
    await savePost({
      title: 'A piece', slug: 'shared', content: 'Body.', status: 'published',
      date: AGO(3600_000), categories: [], tags: [],
    } as Parameters<typeof savePost>[0])
    await sweepAnnounce({ settings: await settingsWith(), site: SITE, since })
    const { queueDepth } = await import('@/ap/store')
    expect(queueDepth()).toBe(2)
  })

  it('announces a few at a time, not a morning’s work at once', async () => {
    for (let i = 0; i < 6; i++) {
      await savePost({
        title: `P${i}`, slug: `p-${i}`, content: 'B.', status: 'published',
        date: AGO(3600_000 + i), categories: [], tags: [],
      } as Parameters<typeof savePost>[0])
    }
    const first = await sweepAnnounce({ settings: await settingsWith(), site: SITE, since })
    expect(first.length).toBe(3)
    const second = await sweepAnnounce({ settings: await settingsWith(), site: SITE, since })
    expect(second.length).toBe(3)
    expect(await sweepAnnounce({ settings: await settingsWith(), site: SITE, since })).toEqual([])
  })
})
