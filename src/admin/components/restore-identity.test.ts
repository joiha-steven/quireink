// The rule that a crash snapshot may not rename or re-date a piece that already exists.
//
// It had no test and three implementations, and they disagreed: the note's kept the slug and
// let the date through. The fault could not be seen from any one file — only from the three at
// once — which is exactly the shape a test is for.
import { describe, expect, it } from 'bun:test'
import { withLiveIdentity } from './restore-identity'

const live = { title: 'As published', slug: 'the-published-one', date: '2026-01-02T09:00', content: 'live' }
const snap = { title: 'As typed', slug: 'an-older-name', date: '2025-08-08T22:15', content: 'typed' }

describe('a restored snapshot', () => {
  it('gives back the words', () => {
    const got = withLiveIdentity(snap, live, true)
    expect(got.title).toBe('As typed')
    expect(got.content).toBe('typed')
  })

  it('does not rename a piece that already has a row', () => {
    // A snapshot taken before a rename carries the old slug, and the slug is the published URL.
    expect(withLiveIdentity(snap, live, true).slug).toBe('the-published-one')
  })

  it('does not move the date of a piece that already has a row', () => {
    // The note editor let this one through while its own comment said otherwise, so a recovered
    // paragraph moved the note in the archive. This is that bug, pinned.
    expect(withLiveIdentity(snap, live, true).date).toBe('2026-01-02T09:00')
  })

  it('keeps the snapshot whole on a piece that has never been saved', () => {
    // There is no identity to protect yet: the snapshot's own slug is the only one there is.
    expect(withLiveIdentity(snap, { ...live, slug: '', date: '' }, false)).toEqual(snap)
  })

  it('adds no date to a kind that has none', () => {
    // A page has no date field. Writing `date: undefined` would put a key on its draft that its
    // type does not carry, and `Object.keys` is how a payload is built.
    const pageLive = { title: 'About', slug: 'about', content: 'live' }
    const pageSnap = { title: 'About, edited', slug: 'about-old', content: 'typed' }
    const got = withLiveIdentity(pageSnap, pageLive, true)
    expect(Object.keys(got).sort()).toEqual(['content', 'slug', 'title'])
    expect(got.slug).toBe('about')
  })

  it('leaves the snapshot object alone', () => {
    // The caller keeps using it; a rule that mutates its input is one that cannot be reused.
    const before = { ...snap }
    withLiveIdentity(snap, live, true)
    expect(snap).toEqual(before)
  })
})
