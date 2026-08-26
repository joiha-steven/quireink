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

type Stamp = {
  salt: string
  target: string
  issued: number
  range: number
  signature: string
}

export type SolvedStamp = Stamp & { answer: number }

const encoder = new TextEncoder()

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

export function startSolving(root: HTMLElement | null): void {
  const raw = root?.dataset.stamp
  if (!raw || pending) return
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
  return solved
}

/** Solve a replacement on the spot, after the server called the page's own one stale. */
export async function solveFresh(): Promise<SolvedStamp | null> {
  try {
    const res = await fetch('/api/comments/stamp')
    const { stamp } = await res.json() as { stamp?: Stamp }
    return stamp ? await solve(stamp) : null
  } catch {
    return null
  }
}
