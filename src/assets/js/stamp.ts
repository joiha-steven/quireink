// Solving the comment stamp (ADR 0032).
//
// The server puts a signed puzzle on the comments mount point; this counts until it finds
// the number whose hash matches, and hands the answer back with the comment. It starts the
// moment a form exists rather than when send is pressed, so the work happens while somebody
// is typing and nobody ever waits for it.
//
// `crypto.subtle` is the browser's own SHA-256, so this costs no bytes beyond the loop. It
// is absent on a page served over plain HTTP (not a secure context) and the solve resolves
// to null there: the server still has its age check, and the admin says the gate is reduced
// rather than pretending. The fix for that install is TLS.
//
// Only the first eight bytes are compared. The server checks the whole digest, so the worst
// a collision could do is one rejected send out of every few hundred million, and hex-ing
// four times less of the buffer is four times less work on the phone doing it.

import { payload } from './dom'

type Stamp = {
  salt: string
  target: string
  issued: number
  range: number
  signature: string
}

export type SolvedStamp = Stamp & { answer: number }

const encoder = new TextEncoder()

/** A little over the server's three-second floor (`MIN_AGE_MS` in `comments/stamp.ts`). */
const FLOOR_MS = 3_200

async function head(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(text))
  return [...new Uint8Array(digest, 0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Count until the hash matches, in slices with a yield between them.
 *
 * A phone that needs a second for this must not have its main thread held for a second, or
 * the page stops scrolling while the reader types.
 */
async function solve(stamp: Stamp): Promise<SolvedStamp | null> {
  if (!crypto?.subtle) return null
  const want = stamp.target.slice(0, 16)
  for (let n = 0; n < stamp.range; n++) {
    if (await head(stamp.salt + n) === want) return { ...stamp, answer: n }
    if ((n & 511) === 511) await new Promise((r) => setTimeout(r, 0))
  }
  return null
}

/**
 * One solve for the page, shared by every form on it.
 *
 * A post can have a form under the article and another under any comment being replied to,
 * and they are the same reader answering the same challenge. A salt buys exactly one
 * comment, so a second comment solves a fresh one.
 */
let pending: Promise<SolvedStamp | null> | null = null
/** Whether the page's own challenge has been handed to a send already. */
let pageSpent = false

/**
 * Arm the next answer.
 *
 * The page's own challenge only once. After a send — accepted or refused — it may be spent,
 * and it is certainly shared: the page is cached, so every reader of the post was handed the
 * same salt and the first comment on it spends it for all of them. Every later arm asks the
 * server for a challenge of this reader's own.
 */
export function startSolving(root: HTMLElement | null): void {
  // No attribute means this page is not using the stamp (Turnstile is on, or comments are
  // off), and then there is nothing to fetch either.
  const raw = root?.dataset.stamp
  if (!raw || pending) return
  if (pageSpent) {
    pending = solveFresh()
    return
  }
  try {
    pending = solve(JSON.parse(raw) as Stamp)
  } catch {
    // Malformed attribute: no stamp, and the server answers accordingly.
  }
}

/** The answer, if there is one. Re-arms so the next comment solves a fresh challenge. */
export async function takeSolution(): Promise<SolvedStamp | null> {
  const solved = await (pending ?? Promise.resolve(null))
  pending = null
  pageSpent = true
  return solved
}

/** Solve a replacement on the spot, after the server called the page's own one stale. */
export async function solveFresh(): Promise<SolvedStamp | null> {
  try {
    const asked = Date.now()
    const res = await fetch('/api/comments/stamp')
    // Through `payload`: the route answers in the `{ success, data }` envelope, and reading
    // `stamp` off the top level found nothing, so this retry never had a stamp to send.
    const { stamp } = await payload<{ stamp?: Stamp | null }>(res)
    const solved = stamp ? await solve(stamp) : null
    // The server refuses a stamp younger than three seconds — nobody reads and writes in
    // less — and a fresh one sent the moment it is solved is exactly that. Measured on this
    // browser's own clock from the moment it asked, so a skewed server clock cannot shorten
    // it. The reader sees "checking" for the rest of the three seconds, once.
    const wait = FLOOR_MS - (Date.now() - asked)
    if (solved && wait > 0) await new Promise((r) => setTimeout(r, wait))
    return solved
  } catch {
    return null
  }
}
