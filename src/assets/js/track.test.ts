// The leave sample, and the one property it lost until 2026-09-10: a reader who switches
// app and comes back is still reading. The first hide used to be the only sample ever
// sent, so a post opened for three seconds and then read for five minutes was recorded as
// a three-second bounce.
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { track } from './track'
import { page, stubFetch } from './test-dom'

// A window PER TEST, not per file as `useDom` gives: `track()` wires listeners on the
// window and the document and never removes them (a page has one beacon for its whole
// life), so a second `track()` on the same window would answer every event twice.
const realNow = performance.now
beforeEach(() => GlobalRegistrator.register())
afterEach(() => {
  performance.now = realNow
  GlobalRegistrator.unregister()
})

type Leave = { depth: number; dwell: number }

let clock = 0
let visibility: DocumentVisibilityState = 'visible'
let sent: Record<string, unknown>[] = []

/** Pretend the document is `height` tall and the reader is `y` pixels down it. */
function scrolledTo(y: number, height: number, viewport = 800): void {
  const doc = document.documentElement
  Object.defineProperty(doc, 'scrollHeight', { value: height, configurable: true })
  Object.defineProperty(doc, 'clientHeight', { value: viewport, configurable: true })
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true })
  window.dispatchEvent(new Event('scroll'))
}

function tab(state: DocumentVisibilityState): void {
  visibility = state
  document.dispatchEvent(new Event('visibilitychange'))
}

/** Every leave sample the beacon sent, in order — the view beacon carries no depth. */
const leaves = (): Leave[] =>
  sent.filter((b) => typeof b.depth === 'number').map((b) => ({ depth: b.depth as number, dwell: b.dwell as number }))

beforeEach(() => {
  clock = 0
  visibility = 'visible'
  sent = []
  page('<div class="prose"><p>Long text.</p></div>')
  // The beacon prefers `sendBeacon`; the fetch fallback is the one a stub can read.
  Object.defineProperty(navigator, 'sendBeacon', { value: undefined, configurable: true })
  Object.defineProperty(document, 'visibilityState', { get: () => visibility, configurable: true })
  performance.now = () => clock
  stubFetch((_url, init) => {
    sent.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
    return {}
  })
  scrolledTo(0, 10_000)
})

describe('the leave sample', () => {
  it('is sent once for a plain leave', () => {
    track()
    scrolledTo(4_600, 10_000) // half of the 9200 scrollable px
    clock = 3_000
    tab('hidden')
    window.dispatchEvent(new Event('pagehide')) // the second leave event a browser delivers
    expect(leaves()).toEqual([{ depth: 50, dwell: 3_000 }])
  })

  it('follows the reader back to the tab, and sends the whole visit on the next leave', () => {
    track()
    scrolledTo(4_600, 10_000)
    clock = 3_000
    tab('hidden')
    clock = 600_000 // ten minutes in another app: not reading
    tab('visible')
    scrolledTo(9_200, 10_000)
    clock = 605_000
    tab('hidden')
    // Two samples, and the second carries the visit so far: the deepest point and the
    // engaged total, without the ten minutes away. The server replaces the first with it.
    expect(leaves()).toEqual([{ depth: 50, dwell: 3_000 }, { depth: 100, dwell: 8_000 }])
  })

  it('keeps the deepest point even when the reader comes back to the top', () => {
    track()
    scrolledTo(9_200, 10_000)
    tab('hidden')
    tab('visible')
    scrolledTo(0, 10_000)
    tab('hidden')
    expect(leaves().map((l) => l.depth)).toEqual([100, 100])
  })
})
