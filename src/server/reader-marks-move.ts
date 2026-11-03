// A reader's marks are kept by PATH (`reader-marks.ts`), and a rename moves the path. They stayed
// under the old one, which then 301s to the new, so nobody saw their marks again (2026-11-03).
// Moved in the rename's own transaction, beside the comments and the revisions.
//
// Its own file so the content layer can call it without the request half of `reader-marks.ts`
// (cookies, the commenter). `update or ignore`: a reader who already has marks at the new path
// keeps those, and the old ones stay where they were rather than overwriting them.
import { all, run } from '@/store/query'

export function renameMarks(fromPath: string, toPath: string): void {
  run(`update or ignore reader_marks set path = ? where path = ?`, toPath, fromPath)
}

/**
 * The addresses a page was renamed from: the permanent redirects that land on it. The marks a
 * reader keeps in their own browser are under the path too, and only the page can tell the island
 * where they were (`pen-store.ts` › `adopt`). Newest first, and a handful: a page renamed more
 * often than that has readers whose marks went with the first renames already.
 */
export function formerPaths(path: string): string[] {
  return all<{ source: string }>(
    `select source from redirects where destination = ? and permanent = 1 order by created_at desc limit 5`, path,
  ).map((r) => r.source)
}
