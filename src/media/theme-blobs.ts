// Where an installed theme's files sit in the blob store (ADR 0072): `themes/<hash>/<path>`,
// beside the uploads and not among them. `/themes/<hash>/…` serves them (`web/theme-files.ts`);
// `/uploads` and the Markdown export, which read the store as the owner's own files, step around
// them with `isThemeBlobPath`.

const DIR = 'themes'

/** Where a file of the installed package `hash` is kept. */
export const themeBlobPath = (hash: string, path: string): string => `${DIR}/${hash}/${path}`

/**
 * Whether a store pathname lands under `themes/`, read the way the store would read it: `.` and
 * `..` resolved, a backslash taken as a separator (Bun's store on Windows does), percent-escapes
 * decoded, and the case folded (Windows and macOS do not tell `Themes` from `themes`). A plain
 * prefix test would let `media/../themes/…` or `Themes/…` through to the same file.
 */
export function isThemeBlobPath(pathname: string): boolean {
  let text = pathname
  try { text = decodeURIComponent(pathname) } catch { /* not escaped text; judged as it is */ }
  const kept: string[] = []
  for (const segment of text.split(/[\\/]+/)) {
    if (segment === '' || segment === '.') continue
    if (segment === '..') kept.pop()
    else kept.push(segment)
  }
  return kept[0]?.toLowerCase() === DIR
}
