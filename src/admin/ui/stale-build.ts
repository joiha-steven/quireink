// What to do when a page is not merely broken but ABSENT.
//
// The admin is one bundle plus a lazy chunk per screen, and the chunk filenames carry a content
// hash. That is what makes them cacheable forever, and also what makes them disappear: a new
// build writes `Trash-8qe19gzs.js` and deletes `Trash-qxdzszpf.js`. An admin tab already open
// still holds the OLD bundle, which knows only the old name. Nothing is wrong with that tab
// until the owner opens a screen they had not opened yet — and then the browser asks for a file
// deleted while they were reading, and the import rejects.
//
// Not a demo problem: every self-hosted blog updates its own instance, and anyone with the
// admin open in another tab when it does is in exactly this state.
//
// THE CURE IS A RELOAD, which is why this exists rather than a nicer error message. The old
// bundle cannot be repaired in place; the new one is one round trip away. `ui/ErrorBoundary`
// deliberately refuses to offer "try again", because for a render that threw, retrying re-runs
// the same broken state. This is the other failure, where trying again is not a bluff: nothing
// rendered at all, and the second attempt fetches a file that really is there.
//
// So the boundary still catches everything else. This runs FIRST, and only for the one error
// whose cure is known.

/** Where the fact "we already tried this" is kept. Per tab, which is the right scope: another tab's reload is not evidence about this one. */
const MARK = 'qi:stale-build-reload'

/**
 * How long a reload counts as "just tried".
 *
 * Long enough that a genuinely missing file cannot spin the tab, short enough that a second
 * deploy later in the same sitting is still recovered from rather than shown as a crash.
 */
const QUIET_MS = 30_000

/**
 * Whether a thrown value is a dynamic import that could not be fetched.
 *
 * Matched on the message, because there is no shared type to match on: Chrome throws a
 * `TypeError`, Firefox and Safari throw plain `Error`s, and the wording differs in all three.
 * The patterns are each browser's own sentence, kept verbatim rather than reduced to one
 * loose regex — a pattern broad enough to cover all three would also swallow ordinary
 * network errors from `fetch`, and those must reach the boundary and be shown.
 */
export function isStaleChunk(error: unknown): boolean {
  const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  return (
    // Chrome, Edge
    /failed to fetch dynamically imported module/i.test(text) ||
    // Firefox
    /error loading dynamically imported module/i.test(text) ||
    // Safari
    /importing a module script failed/i.test(text) ||
    // Safari, older wording
    /module specifier|failed to load module script/i.test(text)
  )
}

/**
 * Whether this failure should be answered by reloading the tab — and, if so, records that it
 * was, before returning.
 *
 * The recording is not bookkeeping, it is the loop guard, which is why it happens here and
 * not at the call site: a caller that reloads and forgets to mark will reload again on the
 * next paint, forever, on a blog whose new build is genuinely missing a file. If the mark
 * cannot be WRITTEN — Safari in private browsing throws on `setItem`, and some embedded
 * webviews have no storage at all — the answer is no. Without a memory of having tried,
 * there is no safe way to try, and a crash sheet the owner can read beats a tab that
 * flickers until it is closed.
 *
 * `now` is a parameter so the quiet window can be tested without waiting through it.
 */
export function shouldReloadForNewBuild(error: unknown, now: number = Date.now()): boolean {
  if (!isStaleChunk(error)) return false
  try {
    // "Never tried" is tested for as an ABSENT mark, not as a zero. Folding the two together
    // — `Number(getItem(...)) || 0` — reads correctly against a real clock only because
    // `Date.now()` is enormous, and it silently becomes "we already tried, at the epoch" the
    // moment anything hands this function a small `now`. That is a bug that would show up as
    // the cure quietly not firing, which is the hardest kind to notice.
    const mark = sessionStorage.getItem(MARK)
    if (mark !== null) {
      const last = Number(mark)
      // A mark that is not a number is a mark from nowhere: treat it as no mark rather than
      // letting `NaN` decide, because every comparison with `NaN` is false and this one
      // would fall through to reloading, every time, forever.
      if (Number.isFinite(last) && now - last < QUIET_MS) return false
    }
    sessionStorage.setItem(MARK, String(now))
  } catch {
    return false
  }
  return true
}

/**
 * Wrap a route's chunk loader so a deploy underneath the tab heals itself.
 *
 * The returned promise never settles on the reload path, on purpose. Resolving it with some
 * placeholder component would paint that placeholder for the fraction of a second before the
 * document is replaced — a flash of the wrong thing is exactly what the owner reported
 * seeing on the demo, and adding a second one to fix the first would be a poor trade. A
 * pending promise leaves React on the suspense fallback, which is a screen that already
 * means "this page is on its way", and here it truthfully is.
 */
export function throughDeploys<T>(load: () => Promise<T>): () => Promise<T> {
  return () =>
    load().catch((error: unknown) => {
      if (!shouldReloadForNewBuild(error)) throw error
      // The console line survives the reload in a kept-open devtools, and is the only trace
      // afterwards that the tab did this rather than the owner pressing something.
      console.warn('admin: this tab is older than the server, reloading', error)
      location.reload()
      return new Promise<T>(() => {})
    })
}
