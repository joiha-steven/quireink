// Which copy of a draft to offer back.
//
// Both are decisions, and both were inside React hooks where nothing could reach them. The
// offer is the one that matters: getting it wrong means either losing work or silently undoing
// a save, and the writer finds out afterwards either way.
import { describe, expect, it } from 'bun:test'
import { pickOffer } from './draft-keep'

// The LINE this file also decides is tested next door, in `admin/components/autosave.test.ts`,
// where its eleven cases were written. One home each.

describe('which copy to offer', () => {
  it('offers nothing when there is nothing', () => {
    expect(pickOffer({ localAt: null, serverAt: null, rowSavedAt: null, dismissed: false })).toBeNull()
  })

  it('offers the device copy when it is the only one', () => {
    expect(pickOffer({ localAt: 10, serverAt: null, rowSavedAt: null, dismissed: false }))
      .toEqual({ at: 10, from: 'device' })
  })

  it('offers the newer of the two', () => {
    expect(pickOffer({ localAt: 10, serverAt: 20, rowSavedAt: null, dismissed: false }))
      .toEqual({ at: 20, from: 'server' })
    expect(pickOffer({ localAt: 30, serverAt: 20, rowSavedAt: null, dismissed: false }))
      .toEqual({ at: 30, from: 'device' })
  })

  it('gives the DEVICE the tie', () => {
    // A tie means the same second, not the same work: the copy on this machine is the one this
    // session wrote.
    expect(pickOffer({ localAt: 20, serverAt: 20, rowSavedAt: null, dismissed: false }))
      .toEqual({ at: 20, from: 'device' })
  })

  it('ignores a server copy the writer has already saved past', () => {
    // ⚠️ A SNAPSHOT OLDER THAN THE LAST REAL SAVE HAS BEEN SUPERSEDED. Offering it back is
    // offering to undo the save, which is the opposite of what the offer is for.
    expect(pickOffer({ localAt: null, serverAt: 10, rowSavedAt: 20, dismissed: false })).toBeNull()
    expect(pickOffer({ localAt: null, serverAt: 30, rowSavedAt: 20, dismissed: false }))
      .toEqual({ at: 30, from: 'server' })
  })

  it('offers nothing once it has been turned down', () => {
    expect(pickOffer({ localAt: 30, serverAt: 40, rowSavedAt: null, dismissed: true })).toBeNull()
  })
})
