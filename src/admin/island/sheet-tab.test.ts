// TWO "NEW POST" TABS ARE TWO POSTS.
//
// Every unsaved piece used to keep its device copy under one key, `quire:draft:post:new`: a second
// blank sheet opened with the first one's words in it, and closing both left only the words of
// whichever closed last (2026-11-03). Each sheet now writes under a key of its own and a new tab
// takes over only a copy no open tab is holding.
import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { claimNewSheet, LEASE_MS } from './lib/sheet-tab'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())
beforeEach(() => { localStorage.clear(); sessionStorage.clear() })

const put = (key: string, title: string, at = new Date()) =>
  localStorage.setItem(key, JSON.stringify({ data: { title }, at: at.toISOString() }))
const titleAt = (key: string): string | null => {
  const raw = localStorage.getItem(key)
  return raw ? (JSON.parse(raw) as { data: { title: string } }).data.title : null
}
/** A second tab: its own sessionStorage, the same localStorage. */
const otherTab = () => sessionStorage.clear()

describe('claimNewSheet', () => {
  it('gives a second open tab a key of its own, empty', () => {
    const a = claimNewSheet('post')
    put(a.key, 'tab A')
    otherTab()
    const b = claimNewSheet('post')
    expect(b.key).not.toBe(a.key)
    expect(b.adopted).toBe(false)
    expect(titleAt(b.key)).toBeNull()
    expect(titleAt(a.key)).toBe('tab A')
  })

  it('reopens its own copy after a reload of the same tab', () => {
    const a = claimNewSheet('post')
    put(a.key, 'mine')
    a.release() // pagehide
    const again = claimNewSheet('post')
    expect(again.key).toBe(a.key)
  })

  it('takes over a copy left by a tab that closed, and leaves a live one alone', () => {
    const live = claimNewSheet('post')
    put(live.key, 'still open', new Date(Date.now() + 1000)) // the newer of the two
    otherTab()
    const a = claimNewSheet('post')
    put(a.key, 'closed tab')
    a.release()
    otherTab()
    const c = claimNewSheet('post')
    expect(c.key).toBe(a.key)
    expect(c.adopted).toBe(true)
    expect(titleAt(live.key)).toBe('still open')
  })

  it('treats a lease nobody renewed as a crashed tab', () => {
    const a = claimNewSheet('post', Date.now() - 5 * LEASE_MS)
    put(a.key, 'crashed')
    a.stop() // the tab died: no pagehide, the lease is simply old
    otherTab()
    expect(claimNewSheet('post').key).toBe(a.key)
  })

  it('does not share a key with a duplicated tab that copied its session', () => {
    const a = claimNewSheet('post')
    put(a.key, 'original')
    // "Duplicate tab" copies sessionStorage, so the copy names the same sheet.
    const dup = claimNewSheet('post')
    expect(dup.key).not.toBe(a.key)
  })

  it('moves the copy kept under the old shared key onto a key of its own', () => {
    put('quire:draft:post:new', 'from before')
    const a = claimNewSheet('post')
    expect(a.adopted).toBe(true)
    expect(titleAt(a.key)).toBe('from before')
    expect(localStorage.getItem('quire:draft:post:new')).toBeNull()
  })

  it('keeps posts, pages and notes apart', () => {
    const post = claimNewSheet('post')
    put(post.key, 'a post')
    post.release()
    otherTab()
    expect(claimNewSheet('page').adopted).toBe(false)
  })
})
