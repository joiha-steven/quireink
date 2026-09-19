// WHAT LEAVES THIS BLOG FOR SOMEBODY ELSE'S TIMELINE.
//
// ⚠️ EVERY FAILURE THESE CATCH IS SILENT ON THE WIRE. A malformed activity is accepted with a
// 202 and dropped; an `Update` that reuses an id is deduped away; an `Accept` that does not
// carry the follow back leaves a follower's button spinning forever. None of it is an error on
// either end, so the shapes are asserted here whole rather than sampled.
import { describe, expect, it } from 'bun:test'
import type { Post } from '@/types'
import { acceptOf, createOf, deleteOf, noteOf, PUBLIC, updateOf, type Actor } from '@/ap/objects'

const SITE = 'https://blog.example'
const ACTOR: Actor = {
  id: `${SITE}/ap/actor`, followers: `${SITE}/ap/followers`, handle: 'quire',
}

const post = (over: Partial<Post> = {}): Post => ({
  title: 'On setting type', slug: 'on-setting-type', date: '2026-09-19T08:00:00.000Z',
  status: 'published', categories: ['Typography'], tags: ['giao diện', 'chữ'],
  excerpt: 'What a column of text owes the eye.', ...over,
})

const note = (over: Partial<Post> = {}, lang: 'en' | 'vi' = 'en') =>
  noteOf({ post: post(over), site: SITE, actor: ACTOR, lang })

describe('a post as a Note', () => {
  it('is addressed to the public and copied to the followers', () => {
    const n = note()
    expect(n.to).toEqual([PUBLIC])
    expect(n.cc).toEqual([`${SITE}/ap/followers`])
    // ⚠️ THE PUBLIC COLLECTION IS A URL, not the word "public". A post addressed to the string
    // is a post nobody outside the followers list ever sees.
    expect(PUBLIC).toBe('https://www.w3.org/ns/activitystreams#Public')
  })

  it('takes the page’s own URL as its id, so one address has two representations', () => {
    expect(note().id).toBe(`${SITE}/on-setting-type`)
    expect(note().url).toBe(`${SITE}/on-setting-type`)
  })

  it('carries the title, the standfirst and the link, all escaped', () => {
    const n = note({ title: 'Kerning & <spacing>', excerpt: 'A "quoted" line.' })
    expect(n.content).toContain('Kerning &amp; &lt;spacing&gt;')
    expect(n.content).toContain('&quot;quoted&quot;')
    expect(n.content).not.toContain('<spacing>')
    expect(n.content).toContain(`<a href="${SITE}/on-setting-type">`)
  })

  it('names the PIECE’s language, not the site’s', () => {
    // ADR 0056 reaches the fediverse here, and this is the one surface that machine-reads it: a
    // reader filtering their timeline by language gets a Vietnamese blog's one English essay
    // only because this line says which it is.
    expect(note({}, 'en').contentMap).toEqual({ en: note({}, 'en').content as string })
    expect(Object.keys(note({}, 'vi').contentMap as object)).toEqual(['vi'])
  })

  it('joins a tag’s words, because a hashtag with a space in it is not one', () => {
    const tags = note().tag as { name: string; href: string }[]
    expect(tags.map((t) => t.name)).toEqual(['#giaodiện', '#chữ'])
    // ...and the link still points at the tag page under its REAL name.
    expect(tags[0]!.href).toBe(`${SITE}/tag/giao%20di%E1%BB%87n`)
  })

  it('attaches a cover picture as an absolute URL, and nothing when there is none', () => {
    expect((note({ coverImage: '/uploads/media/a.jpg' }).attachment as unknown[])[0])
      .toMatchObject({ type: 'Document', url: `${SITE}/uploads/media/a.jpg` })
    expect(note().attachment).toEqual([])
    // A picture the owner hosts elsewhere is left where it is.
    expect((note({ coverImage: 'https://cdn.test/a.jpg' }).attachment as { url: string }[])[0]!.url)
      .toBe('https://cdn.test/a.jpg')
  })

  it('says it is not sensitive rather than leaving the question open', () => {
    // Absent, some servers hide the post behind a content warning by default.
    expect(note().sensitive).toBe(false)
  })

  it('omits `updated` until there has been an update', () => {
    expect('updated' in note()).toBe(false)
    expect(note({ updatedAt: '2026-09-20T00:00:00.000Z' }).updated).toBe('2026-09-20T00:00:00.000Z')
  })
})

describe('the activities that carry it', () => {
  it('gives Create a stable id and Update a different one every time', () => {
    // ⚠️ THE ONE THAT BITES. Receivers remember activity ids and drop a repeat, so an `Update`
    // reusing an id is delivered once and every later correction is discarded in silence — the
    // post in a follower's timeline stays at whatever it said the first time it was edited.
    const n = note()
    expect(createOf(n, ACTOR).id).toBe(`${SITE}/on-setting-type#create`)
    const first = updateOf(n, ACTOR, '2026-09-20T00:00:00.000Z').id
    const second = updateOf(n, ACTOR, '2026-09-21T00:00:00.000Z').id
    expect(first).not.toBe(second)
    expect(createOf(n, ACTOR).id).toBe(createOf(n, ACTOR).id)
  })

  it('wraps the whole note in Create, and names this blog as the actor', () => {
    const c = createOf(note(), ACTOR)
    expect(c.type).toBe('Create')
    expect(c.actor).toBe(ACTOR.id)
    expect((c.object as { id: string }).id).toBe(`${SITE}/on-setting-type`)
    expect(c['@context']).toContain('https://www.w3.org/ns/activitystreams')
  })

  it('deletes with a Tombstone rather than a bare id', () => {
    // Several implementations remove nothing for a bare string, and a delete that is ignored is
    // worse than one never sent: the owner believes the post is withdrawn.
    const d = deleteOf(`${SITE}/gone`, ACTOR, '2026-09-21T00:00:00.000Z')
    expect(d.type).toBe('Delete')
    expect(d.object).toEqual({ id: `${SITE}/gone`, type: 'Tombstone' })
    expect(d.to).toEqual([PUBLIC])
  })

  it('accepts a follow by handing the WHOLE follow back', () => {
    // The follower's server matches the Accept against what it sent; one that cannot match
    // leaves the follow pending forever — the owner sees a follower, the follower sees a
    // button still spinning.
    const follow = { id: 'https://elsewhere.test/abc', type: 'Follow', actor: 'https://elsewhere.test/u/a' }
    const a = acceptOf(follow, ACTOR)
    expect(a.type).toBe('Accept')
    expect(a.object).toEqual(follow)
    expect(a.actor).toBe(ACTOR.id)
    // Two different follows get two different Accept ids, so neither is deduped as the other.
    const other = acceptOf({ ...follow, id: 'https://elsewhere.test/xyz' }, ACTOR)
    expect(a.id).not.toBe(other.id)
  })
})
