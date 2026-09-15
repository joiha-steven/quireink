// WHAT TO DO WHEN A FILE THIS TAB ASKS FOR IS NOT ON THE SERVER ANY MORE.
//
// Chunk names carry a content hash, which is what makes them cacheable forever and also what
// makes them disappear: a new build writes one name and DELETES the old. A tab that was open
// across the update still holds the old name.
//
// Every admin address is a page now, so a navigation always fetches markup naming the current
// build and thirteen of the fourteen cases this used to cover cannot happen. What is left is
// what a page that is ALREADY OPEN fetches on demand: arrange mode, and the media picker.
//
// ⚠️ IT OFFERS THE RELOAD RATHER THAN PERFORMING IT, and that is the whole of the decision. The
// rail is on every admin page INCLUDING the editor, so a reload started here by itself would be
// a reload of somebody's half-written post — begun because they pressed "Arrange the menu". A
// failure toast has no timer, so the sentence waits as long as it takes to be read.
//
// There was a seven-string error boundary and a `stale-build.ts` that reloaded the tab once,
// guarded by a mark in `sessionStorage`; both went with React in ADR 0054's step 6, and the wait
// between the two was long enough for the arrange key to have no catch at all — a tab older than
// the server answered the press by closing the menu and doing nothing, however often it was
// pressed, leaving an unhandled rejection where nobody was looking.

/**
 * Whether a thrown value is a dynamic import that could not be fetched.
 *
 * Matched on the MESSAGE, because there is no shared type to match on: Chrome throws a
 * `TypeError`, Firefox and Safari throw plain `Error`s, and the wording differs in all three.
 * Each browser's own sentence is kept verbatim rather than reduced to one loose pattern — a
 * pattern broad enough to cover all three would also swallow ordinary network failures, and
 * those mean something else entirely and must not be answered with "reload, you are out of
 * date".
 */
export function isChunkGone(error: unknown): boolean {
  const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  return (
    /failed to fetch dynamically imported module/i.test(text) // Chrome, Edge
    || /error loading dynamically imported module/i.test(text) // Firefox
    || /importing a module script failed/i.test(text) // Safari
    || /module specifier|failed to load module script/i.test(text) // Safari, older wording
  )
}

/** The two words the sentence needs, which the server sends with the rail's own. */
export type ChunkWords = { chunkGone: string; chunkReload: string }

/**
 * Say it, with the way out beside it. Anything that is NOT the missing file says nothing here
 * and is left for the caller to rethrow.
 */
export function sayChunkGone(words: ChunkWords, error: unknown): void {
  if (!isChunkGone(error)) return
  window.dispatchEvent(new CustomEvent('quire:toast', {
    detail: {
      message: words.chunkGone,
      kind: 'error',
      action: { label: words.chunkReload, run: () => location.reload() },
    },
  }))
}
