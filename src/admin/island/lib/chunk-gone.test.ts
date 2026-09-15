// The one thing here a browser test cannot reach: WHICH failures mean "this tab is out of date".
//
// The behaviour — a toast with a reload beside it, and no reload this code starts by itself —
// needs a chunk that 404s, and a dynamic import is not interceptable from a page. What IS worth
// pinning is the list of sentences, because it is the part most likely to rot: three browsers
// word the same failure three ways, and any of them is free to reword it in a release.
//
// ⚠️ THE NEGATIVE CASES ARE THE POINT. A pattern broad enough to catch all three browsers would
// also catch an ordinary network failure, and answering a dropped connection with "you are out
// of date, reload" is a lie that costs the owner whatever they were typing.
import { describe, expect, it } from 'bun:test'
import { isChunkGone } from '@/admin/island/lib/chunk-gone'

describe('a chunk that is not there any more', () => {
  it('is recognised in every browser that says so, in the words that browser uses', () => {
    // Chrome and Edge.
    expect(isChunkGone(new TypeError('Failed to fetch dynamically imported module: https://x/y.js'))).toBe(true)
    // Firefox.
    expect(isChunkGone(new Error('error loading dynamically imported module: https://x/y.js'))).toBe(true)
    // Safari, and its older wording.
    expect(isChunkGone(new Error('Importing a module script failed.'))).toBe(true)
    expect(isChunkGone(new Error('Failed to load module script'))).toBe(true)
  })

  it('is recognised however the failure arrives', () => {
    // Not every rejection is an Error. A string, and a value with no message at all, both have
    // to be read rather than thrown at `.message`.
    expect(isChunkGone('Failed to fetch dynamically imported module')).toBe(true)
    expect(isChunkGone(null)).toBe(false)
    expect(isChunkGone(undefined)).toBe(false)
    expect(isChunkGone({})).toBe(false)
  })

  it('does NOT claim an ordinary network failure is a stale tab', () => {
    // The sentence `fetch` throws when the connection drops. It is one word away from Chrome's
    // chunk failure and means something completely different: nothing is out of date, so the
    // cure on offer would be wrong and the work it costs would be real.
    expect(isChunkGone(new TypeError('Failed to fetch'))).toBe(false)
    expect(isChunkGone(new TypeError('NetworkError when attempting to fetch resource.'))).toBe(false)
    expect(isChunkGone(new Error('The request timed out.'))).toBe(false)
    // And a fault in the module's own code, which arrives from the same `import()` and is a bug
    // to be fixed rather than a build to be caught up with.
    expect(isChunkGone(new ReferenceError('enterArrangeMode is not defined'))).toBe(false)
  })
})
