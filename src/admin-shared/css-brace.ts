// THE ONE OPINION THE CUSTOM CSS BOX HAS.
//
// It moved here when the settings screen became a page (ADR 0054): the server draws the box now
// and the island watches it, and both have to reach the same answer. The React component that
// held it is gone; everything else in that file was layout.

/** Unbalanced braces, ignoring anything inside a comment or a string. */
export function braceBalance(css: string): number {
  let depth = 0
  let i = 0
  while (i < css.length) {
    const c = css[i]!
    if (c === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2)
      i = end === -1 ? css.length : end + 2
      continue
    }
    if (c === '"' || c === "'") {
      i += 1
      while (i < css.length && css[i] !== c) i += css[i] === '\\' ? 2 : 1
      i += 1
      continue
    }
    if (c === '{') depth += 1
    else if (c === '}') depth -= 1
    // A stray `}` is already broken; report it as one problem rather than letting the
    // count go negative and cancel out against a later missing one.
    if (depth < 0) return -1
    i += 1
  }
  return depth
}
