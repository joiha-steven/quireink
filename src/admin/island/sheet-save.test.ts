// What each kind sends, and what an emptied field means on the wire.
//
// The three React forms built this payload three times, each inline in its own save, and the
// three had to be read side by side to see what they had in common. One function now, and this
// file is the list of what it does differently per kind.
import { describe, expect, it } from 'bun:test'
import { emptyDraft, type SheetDraft } from '@/admin-shared/sheet-wire'
import { nameEnough, payloadOf, worthSaving } from './lib/sheet-save'

const draft = (over: Partial<SheetDraft> = {}): SheetDraft => ({ ...emptyDraft(), ...over })
const UTC = 'UTC'

describe('what every kind sends', () => {
  for (const kind of ['post', 'page', 'note'] as const) {
    it(`gives a ${kind} its title, slug, status and body`, () => {
      const out = payloadOf(kind, draft({ title: 'A piece', slug: 'a-piece' }), 'Words.', UTC)
      expect(out).toMatchObject({ title: 'A piece', slug: 'a-piece', status: 'draft', content: 'Words.' })
    })
  }

  it('always has a slug, so a body with no name is still storable', () => {
    expect(payloadOf('post', draft({ title: 'A Piece, Titled' }), 'x', UTC).slug).toBe('a-piece-titled')
    // Nothing to make one from: a stamp rather than a refusal, because the words matter more
    // than the address and the address can be fixed afterwards.
    expect(String(payloadOf('post', draft(), '', UTC).slug)).toMatch(/^post-\d+$/)
    expect(String(payloadOf('post', draft(), '日本語', UTC).slug)).toMatch(/^post-\d+$/)
  })

  it('addresses a post with no title by its first words (ADR 0064)', () => {
    const out = payloadOf('post', draft(), 'Hôm nay **tôi** đọc lại [một bài](https://e.com) cũ, và nó vẫn đúng.', UTC)
    expect(out.slug).toBe('hom-nay-toi-doc-lai-mot')
    // A slug already there — typed, or pinned by the first save — is never re-derived.
    expect(payloadOf('post', draft({ slug: 'kept' }), 'Other words entirely', UTC).slug).toBe('kept')
  })

  it('names a note by its source when it has no title of its own', () => {
    expect(payloadOf('note', draft({ sourceTitle: 'On Reed Pens' }), 'x', UTC).slug).toBe('on-reed-pens')
  })
})

describe('the date is a wall clock on the SITE', () => {
  it('turns it into an instant with the site zone, not this machine', () => {
    // A post scheduled from a laptop on UTC went out seven hours late in Hanoi, and the line
    // under the field agreed with the laptop.
    const at = payloadOf('post', draft({ date: '2027-03-04T09:30' }), 'x', 'Asia/Bangkok').date
    expect(at).toBe('2027-03-04T02:30:00.000Z')
    expect(payloadOf('post', draft({ date: '2027-03-04T09:30' }), 'x', UTC).date)
      .toBe('2027-03-04T09:30:00.000Z')
  })

  it('gives a page no date at all', () => {
    expect(payloadOf('page', draft({ date: '2027-03-04T09:30' }), 'x', UTC)).not.toHaveProperty('date')
  })
})

describe('what only one kind sends', () => {
  it('sends the post its terms, series, pictures, excerpt and SEO pair', () => {
    const out = payloadOf('post', draft({
      categories: ['Type'], tags: ['ink'], series: 'A history', seriesOrder: 2,
      featuredImage: '/a.jpg', coverImage: '/b.jpg', metaTitle: 'M', metaDescription: 'D', excerpt: 'E',
    }), 'x', UTC)
    expect(out).toMatchObject({
      categories: ['Type'], tags: ['ink'], series: 'A history', seriesOrder: 2,
      featuredImage: '/a.jpg', coverImage: '/b.jpg', metaTitle: 'M', metaDescription: 'D', excerpt: 'E',
    })
  })

  it('sends the note its three source fields and nothing of the post', () => {
    const out = payloadOf('note', draft({ sourceUrl: 'https://x', sourceTitle: 'S', quote: 'Q' }), 'x', UTC)
    expect(out).toMatchObject({ sourceUrl: 'https://x', sourceTitle: 'S', quote: 'Q' })
    expect(out).not.toHaveProperty('categories')
    expect(out).not.toHaveProperty('excerpt')
  })

  it('sends the page its featured picture and nothing else', () => {
    const out = payloadOf('page', draft({ featuredImage: '/a.jpg', excerpt: 'ignored' }), 'x', UTC)
    expect(out.featuredImage).toBe('/a.jpg')
    expect(out).not.toHaveProperty('excerpt')
  })
})

describe('an emptied field arrives as nothing', () => {
  it('sends undefined rather than leaving the key out', () => {
    // ⚠️ THE ROW IS WRITTEN WHOLE ON EVERY SAVE, so a field cleared on screen has to arrive as
    // `undefined` to clear the column. Left out entirely it would read as "no opinion" and the
    // old value would stay — which is how a meta title becomes impossible to remove.
    const out = payloadOf('post', draft({ metaTitle: '   ', series: '', coverImage: '' }), 'x', UTC)
    expect('metaTitle' in out).toBe(true)
    expect(out.metaTitle).toBeUndefined()
    expect(out.series).toBeUndefined()
    expect(out.seriesOrder).toBeUndefined()
    expect(out.coverImage).toBeUndefined()
  })

  it('keeps an empty excerpt as an empty STRING, which is not the same thing', () => {
    // An excerpt is generated from the body when it is absent; an empty one is a decision.
    expect(payloadOf('post', draft({ excerpt: '' }), 'x', UTC).excerpt).toBe('')
  })

  it('drops the series order with the series', () => {
    const out = payloadOf('post', draft({ series: '', seriesOrder: 5 }), 'x', UTC)
    expect(out.seriesOrder).toBeUndefined()
  })
})

describe('whether there is anything to do', () => {
  it('will not store a piece with no words and no name', () => {
    expect(worthSaving('post', draft(), '')).toBe(false)
    expect(worthSaving('post', draft({ title: 'A' }), '')).toBe(true)
    expect(worthSaving('post', draft(), 'Words.')).toBe(true)
  })

  it('counts a note named only by its source', () => {
    expect(worthSaving('note', draft({ sourceTitle: 'S' }), '')).toBe(true)
    expect(worthSaving('post', draft({ sourceTitle: 'S' }), '')).toBe(false)
  })

  it('will not publish a page or a note nobody has named', () => {
    expect(nameEnough('post', draft({ title: 'A' }), '')).toBe(true)
    expect(nameEnough('note', draft({ sourceTitle: 'S' }), '')).toBe(true)
    expect(nameEnough('page', draft({ sourceTitle: 'S' }), 'Words.')).toBe(false)
    expect(nameEnough('note', draft(), 'Words.')).toBe(false)
  })

  it('publishes a post with words and no name — a short post (ADR 0064)', () => {
    expect(nameEnough('post', draft(), 'Just shipped the thing.')).toBe(true)
    expect(nameEnough('post', draft(), '   ')).toBe(false)
  })
})
