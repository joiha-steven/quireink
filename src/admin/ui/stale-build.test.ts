// The tab that is older than the server, and the one rule that keeps the cure from becoming
// the disease.
//
// `stale-build.ts` reloads the page. That is a big hammer for a module to swing on its own,
// so what is pinned here is not that it works — it is every case where it must NOT swing:
// an ordinary error, a second failure inside the quiet window, and a browser with no session
// storage to remember the first attempt in. Each of those, wrong, is a tab that reloads
// forever, and a reload loop cannot be reported by the person stuck in it.
//
// Nothing here renders. `ErrorBoundary.tsx` explains why admin components cannot be mounted
// under this test runner; these are plain functions, chosen to be plain functions partly so
// that this file could exist.

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { isStaleChunk, shouldReloadForNewBuild } from '@/admin/ui/stale-build'

// A stand-in for the browser's own, because bun has no DOM. Only the three methods the
// module touches, and a switch for the storage that throws.
function installStorage(options: { throws?: boolean } = {}): Map<string, string> {
  const store = new Map<string, string>()
  const api = {
    getItem: (k: string) => {
      if (options.throws) throw new Error('SecurityError')
      return store.get(k) ?? null
    },
    setItem: (k: string, v: string) => {
      if (options.throws) throw new Error('SecurityError')
      store.set(k, v)
    },
    removeItem: (k: string) => void store.delete(k),
  }
  ;(globalThis as { sessionStorage?: unknown }).sessionStorage = api
  return store
}

beforeEach(() => void installStorage())
afterEach(() => {
  delete (globalThis as { sessionStorage?: unknown }).sessionStorage
})

describe('recognising a chunk that is not there any more', () => {
  it('knows each browser’s own wording', () => {
    // Three engines, three sentences, and no shared error type to match on instead. If a
    // fourth wording ever appears the symptom is the bug coming back for those users only,
    // which is the kind of thing that gets reported as "it works on my machine".
    expect(isStaleChunk(new TypeError('Failed to fetch dynamically imported module: https://a/b.js'))).toBe(true)
    expect(isStaleChunk(new Error('error loading dynamically imported module'))).toBe(true)
    expect(isStaleChunk(new Error('Importing a module script failed.'))).toBe(true)
  })

  it('leaves every other failure alone', () => {
    // The point of matching narrowly. A page whose render threw must reach the boundary and
    // be SHOWN; reloading it would hide a real bug behind a flicker, and would keep hiding
    // it, because the same render throws again after the reload.
    expect(isStaleChunk(new Error('token.type is undefined'))).toBe(false)
    expect(isStaleChunk(new TypeError('Failed to fetch'))).toBe(false)
    expect(isStaleChunk('Cannot read properties of null')).toBe(false)
    expect(isStaleChunk(null)).toBe(false)
  })
})

describe('deciding whether to reload', () => {
  it('says yes the first time, and records that it did', () => {
    const store = installStorage()
    expect(shouldReloadForNewBuild(new Error('error loading dynamically imported module'), 1_000)).toBe(true)
    expect(store.get('qi:stale-build-reload')).toBe('1000')
  })

  it('says no to a second failure inside the quiet window', () => {
    // THE LOOP GUARD, and the reason the mark is written by the same function that reads it.
    // A blog whose new build is genuinely missing a file would otherwise reload, fail, reload
    // — for as long as the tab is open.
    const error = new Error('error loading dynamically imported module')
    expect(shouldReloadForNewBuild(error, 1_000)).toBe(true)
    expect(shouldReloadForNewBuild(error, 5_000)).toBe(false)
    // The window runs from the reload that HAPPENED, not from the last refusal — a refusal
    // does not move the mark, or a page failing every second would hold the window open for
    // as long as it kept failing and the tab would never recover from the next real deploy.
    expect(shouldReloadForNewBuild(error, 31_500)).toBe(true)
  })

  it('says no when the attempt cannot be remembered', () => {
    // Safari in private browsing throws on `setItem`. Without somewhere to write the mark
    // there is no loop guard, so the answer has to be no — a crash sheet the owner can read
    // beats a tab that flickers until it is closed.
    installStorage({ throws: true })
    expect(shouldReloadForNewBuild(new Error('Importing a module script failed.'), 1_000)).toBe(false)
  })

  it('says no to an ordinary error however fresh the tab is', () => {
    expect(shouldReloadForNewBuild(new Error('token.type is undefined'), 1_000)).toBe(false)
  })
})

describe('where it is wired in', () => {
  const APP = readFileSync('src/admin/App.tsx', 'utf8')

  it('wraps every routed page, so no screen is left un-healed', () => {
    // A route added later without the wrapper is a screen that breaks after a deploy while
    // its neighbours recover, which is the hardest version of this bug to recognise.
    // Matched on the DECLARATION line, not on the text `lazy(` anywhere in the file: the
    // prose above these lines discusses `lazy()` too, and a test that reads comments passes
    // or fails on how the comments are worded.
    const declarations = [...APP.matchAll(/^const \w+ = lazy\((.+)\)$/gm)].map((m) => m[1])
    expect(declarations.length).toBeGreaterThan(10)
    for (const inner of declarations) expect(inner).toStartWith('throughDeploys(load.')
  })

  it('does NOT wrap the speculative warm-up', () => {
    // `preloadRoute` fires on hover. A tab that reloaded itself because a pointer crossed a
    // link would be worse than the bug being cured, so the reload belongs to the navigation
    // the owner actually made.
    // The statement itself, for the same reason: the comment beside it says the word.
    const call = APP.split('\n').find((line) => line.includes('void loaderFor(path)()'))
    expect(call).toBeDefined()
    expect(call).not.toContain('throughDeploys')
  })

  it('gives the boundary its own sentence for a page that never drew', () => {
    const sheet = readFileSync('src/admin/ui/ErrorBoundary.tsx', 'utf8')
    expect(sheet).toContain('isStaleChunk(error)')
    expect(sheet).toContain('crashMissingTitle')
  })
})
