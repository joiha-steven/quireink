// WHAT A SAVE ACTUALLY SENDS, which is a hand-written list and therefore goes stale.
//
// `payloadOf` names every field on the wire. A field added to the panel, wired into the draft
// and forgotten HERE is a field the owner fills in, watches save, and finds empty when they come
// back — with no error anywhere, because the save succeeded. It is the same failure `getPage`
// had in the other direction, and this feature found both in one afternoon.
//
// So this file asserts the KEY SET, not a handful of values: a test that checks the fields
// somebody remembered to check is the same list again, one layer up.
import { describe, expect, it } from 'bun:test'
import { emptyDraft, type SheetDraft } from '@/admin-shared/sheet-wire'
import { payloadOf } from './sheet-save'

const TZ = 'Asia/Ho_Chi_Minh'
const draft = (over: Partial<SheetDraft> = {}): SheetDraft => ({ ...emptyDraft(), ...over })

describe('what a save sends', () => {
  it('sends every field a POST has, and no more', () => {
    const keys = Object.keys(payloadOf('post', draft({ title: 'T', series: 'S' }), 'body', TZ)).sort()
    expect(keys).toEqual([
      'categories', 'content', 'coverImage', 'date', 'excerpt', 'featuredImage',
      'lang', 'metaDescription', 'metaTitle', 'series', 'seriesOrder', 'slug', 'status',
      'tags', 'title', 'translationGroup',
    ])
  })

  it('sends a PAGE its language and no date', () => {
    const body = payloadOf('page', draft({ title: 'About', lang: 'en', translationGroup: 'me' }), 'x', TZ)
    expect(Object.keys(body).sort()).toEqual([
      'content', 'featuredImage', 'lang', 'slug', 'status', 'title', 'translationGroup',
    ])
    expect(body.lang).toBe('en')
    expect(body.translationGroup).toBe('me')
  })

  it('sends a NOTE neither, because a note has neither', () => {
    // A note is a page of a notebook and a clip quotes its source in the source's own language
    // (ADR 0044, ADR 0056). The columns do not exist on it.
    const keys = Object.keys(payloadOf('note', draft({ title: 'N' }), 'x', TZ))
    expect(keys).not.toContain('lang')
    expect(keys).not.toContain('translationGroup')
  })

  it('sends undefined for an empty language, which CLEARS it', () => {
    // ⚠️ `undefined`, not left out. The row is written whole on every save, so a field emptied
    // on screen has to arrive as nothing rather than be absent — absent is "leave what was
    // there", which is how a language somebody removed comes back on the next save.
    const body = payloadOf('post', draft({ title: 'T', lang: '', translationGroup: '  ' }), 'x', TZ)
    expect('lang' in body).toBe(true)
    expect(body.lang).toBeUndefined()
    expect(body.translationGroup).toBeUndefined()
    // The counter-test: a value set really does travel.
    const filled = payloadOf('post', draft({ title: 'T', lang: 'vi', translationGroup: 'thu' }), 'x', TZ)
    expect(filled.lang).toBe('vi')
    expect(filled.translationGroup).toBe('thu')
  })
})
