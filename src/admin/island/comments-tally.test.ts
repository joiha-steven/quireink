// The comments screen's tally sentence ("N comments on P posts") is shown only while a filter
// narrows the list: unfiltered it restated the figures of the band above it. The island is a
// top-level script, so the page is drawn first and the script imported once; the cases below run
// in order against that one page, the way a moderator would.
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { adminT } from '@/i18n/admin-i18n'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

const t = adminT('en')
const NOW = Date.now()
const OLD = NOW - 30 * 24 * 60 * 60 * 1000

// id, post, when. Two posts, four comments, two of them from this week.
const ROWS: [number, string, number][] = [[1, 'a', NOW], [2, 'a', OLD], [3, 'b', NOW], [4, 'b', OLD]]

const key = (k: string, on: boolean): string =>
  `<button type="button" data-tab="${k}" aria-pressed="${on}">${k}</button>`

function draw(): void {
  const words = {
    inPosts: t.commentsInPosts, commentCount: t.commentCount, postCount: t.postCount,
    trashed: 'Trashed', undo: 'Undo', failed: 'Failed', restoreFailed: 'Restore failed',
  }
  const cards = ['a', 'b'].map((post) =>
    `<section data-card data-newest="1"><span data-card-count>2</span><ul>`
    + ROWS.filter((r) => r[1] === post).map(([id, , at]) =>
      `<li data-comment="${id}" data-at="${at}" data-who="p${id}" data-find="comment ${id}">`
      + `<input type="checkbox" data-comment-pick data-id="${id}">`
      + `<button type="button" data-comment-delete data-id="${id}">Delete</button>`
      + `<span data-mark data-text="comment ${id}">comment ${id}</span></li>`).join('')
    + `</ul></section>`).join('')
  document.body.innerHTML = `<div data-screen="comments" data-lang="en" data-comment-words='${JSON.stringify(words)}'>`
    + `<div data-comment-sort>${key('recent', true)}</div>`
    + `<div data-comment-age>${key('all', true)}${key('week', false)}</div>`
    + `<span data-comment-tally hidden>4 comments on 2 posts</span>`
    + `<input type="search" data-comment-search>`
    + `<div data-comment-selection hidden><span data-pick-count></span></div>`
    + `<div data-comment-band><b>4</b><b>2</b><b>2</b><b>4</b></div>`
    + `<p data-comment-nomatch hidden></p><div data-comment-cards>${cards}</div></div>`
}

const q = <T extends HTMLElement>(s: string): T => document.querySelector<T>(s)!
const tally = (): HTMLElement => q('[data-comment-tally]')
const age = (k: string): void => q(`[data-comment-age] [data-tab="${k}"]`).click()
const type = (v: string): void => {
  const box = q<HTMLInputElement>('[data-comment-search]')
  box.value = v
  box.dispatchEvent(new Event('input', { bubbles: true }))
}
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 20))

describe('the tally appears only while a filter narrows the list', () => {
  beforeAll(async () => {
    draw()
    await import('./comments')
  })

  it('is hidden with no filter, so the band is the only place the totals appear', () => {
    expect(tally().hidden).toBe(true)
  })

  it('shows the narrowed count under "This week" and hides again under "All"', () => {
    age('week')
    expect(tally().hidden).toBe(false)
    expect(tally().textContent).toContain('2')
    age('all')
    expect(tally().hidden).toBe(true)
  })

  it('shows for a search that matches fewer, and hides once the search is cleared', () => {
    type('comment 1')
    expect(tally().hidden).toBe(false)
    type('')
    expect(tally().hidden).toBe(true)
  })

  it('stays right after a delete and an undo while a filter is on', async () => {
    const calls: string[] = []
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push(`${init?.method ?? 'GET'} ${String(url)}`)
      return new Response(JSON.stringify({ success: true }), { status: 200 })
    }) as typeof fetch
    let undo: (() => void) | undefined
    window.addEventListener('quire:toast', (e) => {
      undo = (e as CustomEvent<{ action?: { run: () => void } }>).detail.action?.run
    })

    age('week')
    expect(tally().hidden).toBe(false)
    q('[data-comment-delete][data-id="1"]').click()
    await tick()
    // Row 1 is gone: three left in the page, one of them from this week, so the filter narrows.
    expect(document.querySelectorAll('[data-comment]').length).toBe(3)
    expect(q('[data-comment-band] b').textContent).toBe('3')
    expect(tally().hidden).toBe(false)
    expect(tally().textContent).toContain('1')

    undo?.()
    await tick()
    expect(calls.some((c) => c.startsWith('POST /api/trash'))).toBe(true)
    expect(document.querySelectorAll('[data-comment]').length).toBe(4)
    expect(q('[data-comment-band] b').textContent).toBe('4')
    expect(tally().hidden).toBe(false)
    expect(tally().textContent).toContain('2')

    age('all')
    expect(tally().hidden).toBe(true)
  })
})
