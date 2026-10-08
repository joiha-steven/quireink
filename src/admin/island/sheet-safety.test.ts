// DISCARD IS UNDOABLE, AND THE UNDO GIVES BACK WHAT WAS DISCARDED.
//
// The recovered-work strip's Discard used to act at once with no way back. Its toast now carries
// an Undo, and the copy it puts back is the one that was on offer at the moment of the discard —
// not whatever the next autosave tick wrote over the same key while the toast was up.
import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { draftKey, emptyDraft } from '@/admin-shared/sheet-wire'
import type { Offer } from '@/admin-shared/draft-keep'
import { wireSafety, type Safety, type Snapshot } from './lib/sheet-safety'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

const SLUG = 'a-post'
const KEY = draftKey('post', SLUG)
const snap = (title: string): Snapshot => ({ ...emptyDraft(), title, slug: SLUG, content: `${title} body` })

/** A sheet on a saved post that finds a device copy waiting, as it is when the strip shows. */
function open(): { safety: Safety; offers: Offer[]; setDirty: (d: boolean) => void; now: () => Snapshot } {
  localStorage.setItem(KEY, JSON.stringify({ data: snap('kept on the device'), at: new Date().toISOString() }))
  const offers: Offer[] = []
  let dirty = false
  let current = snap('on screen')
  const safety = wireSafety({
    kind: 'post', slug: SLUG, serverAt: null, rowSavedAt: null,
    dirty: () => dirty, take: () => current, intervalMs: 3_600_000,
    onOffer: (o) => offers.push(o), onKept: () => {},
  })
  return {
    safety, offers,
    setDirty: (d) => { dirty = d; current = snap('typed after the discard') },
    now: () => current,
  }
}

beforeEach(() => { localStorage.clear() })

describe('the recovered-work strip', () => {
  it('offers the device copy when it opens', () => {
    const { safety, offers } = open()
    expect(offers.at(-1)?.from).toBe('device')
    safety.destroy()
  })

  it('takes the offer down on Discard, and Undo puts it back', () => {
    const { safety, offers } = open()
    safety.dismiss()
    expect(offers.at(-1)).toBeNull()
    expect(safety.undismiss()).toBe(true)
    expect(offers.at(-1)?.from).toBe('device')
    safety.destroy()
  })

  it('restores the DISCARDED copy after an undo, even if a tick wrote over its key meanwhile', async () => {
    const { safety, setDirty } = open()
    safety.dismiss()
    // The writer types; the autosave tick (or the way out) writes the screen over the same key.
    setDirty(true)
    localStorage.setItem(KEY, JSON.stringify({ data: snap('typed after the discard'), at: new Date().toISOString() }))
    safety.undismiss()
    const back = await safety.restore()
    expect(back?.title).toBe('kept on the device')
    safety.destroy()
  })

  it('has nothing to undo when nothing was discarded', () => {
    const { safety } = open()
    expect(safety.undismiss()).toBe(false)
    safety.destroy()
  })

  it('keeps the discarded words for the Undo in the toast even when a save lands in between', async () => {
    const { safety } = open()
    safety.dismiss()
    safety.clear() // ⌘S while the toast is still up
    expect(safety.undismiss()).toBe(true)
    expect((await safety.restore())?.title).toBe('kept on the device')
    safety.destroy()
  })

  it('a second Discard after an Undo keeps the ORIGINAL copy, not what a tick wrote since', async () => {
    const { safety, setDirty } = open()
    safety.dismiss()
    setDirty(true)
    localStorage.setItem(KEY, JSON.stringify({ data: snap('typed after the discard'), at: new Date().toISOString() }))
    safety.undismiss()
    safety.dismiss()
    safety.undismiss()
    expect((await safety.restore())?.title).toBe('kept on the device')
    safety.destroy()
  })

  it('keeps the device copy in storage after a discard: a discard is not a delete', () => {
    const { safety } = open()
    safety.dismiss()
    expect(localStorage.getItem(KEY)).not.toBeNull()
    safety.destroy()
  })
})

describe('the server copy on offer', () => {
  const real = globalThis.fetch
  afterAll(() => { globalThis.fetch = real })

  /** What the server's autosave holds right now, as `GET …/autosave` answers it. */
  let onServer = snap('written on the laptop')
  const answer = (): Response => new Response(
    JSON.stringify({ success: true, data: { json: JSON.stringify(onServer) } }),
    { headers: { 'content-type': 'application/json' } },
  )

  it('restores the copy that was DISCARDED, though the next autosave overwrote it on the server', async () => {
    onServer = snap('written on the laptop')
    globalThis.fetch = (async () => answer()) as unknown as typeof fetch
    const offers: Offer[] = []
    const safety = wireSafety({
      kind: 'post', slug: SLUG, serverAt: Date.now() + 1000, rowSavedAt: null,
      dirty: () => true, take: () => snap('typed on the phone'), intervalMs: 3_600_000,
      onOffer: (o) => offers.push(o), onKept: () => {},
    })
    expect(offers.at(-1)?.from).toBe('server')
    safety.dismiss()
    await new Promise((r) => setTimeout(r, 0))
    // The phone types and one autosave lands: the server's copy is now the phone's text.
    onServer = snap('typed on the phone')
    expect(safety.undismiss()).toBe(true)
    expect(offers.at(-1)?.from).toBe('server')
    expect((await safety.restore())?.title).toBe('written on the laptop')
    safety.destroy()
  })
})
