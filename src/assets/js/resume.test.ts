// The way back into a half-read post: kept in the reader's browser, offered once,
// withdrawn the moment they answer by scrolling, forgotten when the post is finished.
import { beforeEach, describe, expect, it } from 'bun:test'
import { resume } from './resume'
import { page, useDom } from './test-dom'

useDom()

const LABELS = { resumePrompt: 'Continue where you left off?' }
// Whatever happy-dom says the page's path is — the island and the test must agree,
// and pinning a literal here silently missed when replaceState was a no-op.
const KEY = () => `quire:resume:${location.pathname}`

const frame = () => new Promise((r) => requestAnimationFrame(r))

/** Pretend the document is `height` tall and the reader is `y` pixels down it. */
function scrolledTo(y: number, height: number, viewport = 800): void {
  const doc = document.documentElement
  Object.defineProperty(doc, 'scrollHeight', { value: height, configurable: true })
  Object.defineProperty(doc, 'clientHeight', { value: viewport, configurable: true })
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: viewport, configurable: true })
  window.dispatchEvent(new Event('scroll'))
}

const pill = () => document.querySelector<HTMLButtonElement>('.resume-pill')

beforeEach(() => {
  localStorage.clear()
  page('<div class="prose"><p>Long text.</p></div>', LABELS)
  scrolledTo(0, 10_000)
})

describe('remembering', () => {
  it('stores the position once the reader is genuinely into the text', async () => {
    resume()
    scrolledTo(3_000, 10_000)
    await frame()
    const mark = JSON.parse(localStorage.getItem(KEY()) ?? 'null') as { y: number } | null
    expect(mark?.y).toBe(3_000)
  })

  it('keeps an earlier sitting when this visit stays near the top', async () => {
    localStorage.setItem(KEY(), JSON.stringify({ y: 4_000, t: Date.now() }))
    resume()
    scrolledTo(600, 10_000) // below the pill threshold, above SAVE_STEP
    await frame()
    expect((JSON.parse(localStorage.getItem(KEY())!) as { y: number }).y).toBe(4_000)
  })

  it('forgets a post the reader finished', async () => {
    localStorage.setItem(KEY(), JSON.stringify({ y: 4_000, t: Date.now() }))
    resume()
    scrolledTo(9_500, 10_000) // past 92% of the 9200 scrollable px
    await frame()
    expect(localStorage.getItem(KEY())).toBeNull()
  })
})

describe('the offer', () => {
  it('appears for a stored position and scrolls there on click', async () => {
    localStorage.setItem(KEY(), JSON.stringify({ y: 4_000, t: Date.now() }))
    const went: number[] = []
    window.scrollTo = ((opts: ScrollToOptions) => { went.push(opts.top ?? 0) }) as typeof window.scrollTo
    resume()
    await frame()
    expect(pill()).not.toBeNull()
    pill()!.click()
    expect(went).toEqual([4_000])
    expect(pill()).toBeNull()
  })

  it('does not appear for a fresh page, a finished post, or a stale mark', async () => {
    resume()
    expect(pill()).toBeNull() // nothing stored

    page('<div class="prose"></div>', LABELS)
    localStorage.setItem(KEY(), JSON.stringify({ y: 9_800, t: Date.now() }))
    resume()
    expect(pill()).toBeNull() // stored, but effectively finished

    page('<div class="prose"></div>', LABELS)
    localStorage.setItem(KEY(), JSON.stringify({ y: 4_000, t: Date.now() - 120 * 24 * 60 * 60 * 1000 }))
    resume()
    expect(pill()).toBeNull() // three months old
  })

  it('withdraws once the reader scrolls on their own', async () => {
    localStorage.setItem(KEY(), JSON.stringify({ y: 4_000, t: Date.now() }))
    resume()
    await frame()
    expect(pill()).not.toBeNull()
    scrolledTo(600, 10_000)
    expect(pill()).toBeNull()
  })

  it('is a no-op without the label — the owner turned it off', () => {
    page('<div class="prose"></div>', {})
    localStorage.setItem(KEY(), JSON.stringify({ y: 4_000, t: Date.now() }))
    resume()
    expect(pill()).toBeNull()
  })
})
