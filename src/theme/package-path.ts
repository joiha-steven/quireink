// What a path inside a theme package may look like, shared by the zip check (A3), the
// stylesheet's URLs (A2) and the manifest's font files (A6).
//
// Deliberately narrower than what a file system allows. Each segment is ASCII letters, digits,
// `_`, `-` and `.`, and may not start with a dot. That one shape rules out, without a list of
// tricks to keep current: `..` and `.` segments, a leading `/`, a backslash (which a URL parser
// reads as `/`), a drive letter or an NTFS stream (`:`), percent-encoding (`%2e%2e` is `..` to a
// URL parser), NUL and every other control character, and Unicode that normalises into any of
// those. A theme author loses spaces and accents in file names, which the theme does not need.

const SEGMENT = /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/

export function isSafePackagePath(path: string): boolean {
  if (path.length === 0 || path.length > 200) return false
  return path.split('/').every((segment) => SEGMENT.test(segment))
}
