// Which commit this process is running.
//
// The admin printed a version and nothing else, and `2.0.0-dev` has meant every deploy
// since the cutover — so the one question the line existed to answer, "is what I am looking
// at what I just shipped", it could not answer.
//
// ⚠️ This note used to continue "clicking it went to the repository's front page, which answers
// it even less", and on 2026-08-15 the owner sent it back there on purpose: *"mã commit (link
// tới dự án, ko phải link tới commit)"*. Both readings were right about different things. The
// SHA answers the question by being READ, not by being clicked — a per-commit URL is a page
// nobody opens from a dashboard, and it 404s as soon as the branch it came from is rebased.
// The link is doing the other job, which is simply getting to the project.
//
// The box has no git checkout: the service runs `bun src/index.ts` out of a directory the
// deploy untars into. So the commit has to ARRIVE with the code, in a `build-sha` file the
// deploy writes beside `package.json`. Absent — a dev machine, someone else's install — the
// admin simply shows the version alone, which is the correct thing to show when there is no
// commit to name.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** Read once. The file cannot change under a running process without a restart. */
let cached: string | null | undefined

export function buildSha(): string | null {
  if (cached !== undefined) return cached
  try {
    const raw = readFileSync(resolve(process.cwd(), 'build-sha'), 'utf8').trim()
    // A full hex SHA and nothing else. Anything shorter or stranger is a file that got
    // there another way, and a wrong commit link is worse than none.
    cached = /^[0-9a-f]{40}$/.test(raw) ? raw : null
  } catch {
    cached = null
  }
  return cached
}

/** Test seam. `process.cwd()` is stable in a process; a test that changes it is not. */
export function resetBuildSha(): void {
  cached = undefined
}
