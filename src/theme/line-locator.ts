// Offsets to the line and column an author sees in an editor. Shared by every finding the
// stylesheet checker reports.

/**
 * Maps an offset to a 1-based line and column, the way an editor counts them: CR, LF, CRLF and
 * FF each end a line, and a column counts code points, so an emoji is one column.
 *
 * Built once, in one pass: the line starts for a binary search, and a running count of
 * surrogate pairs so a column is a subtraction. Counting the column by walking from the line
 * start made 64 KB of `}` on one line quadratic.
 */
export function lineLocator(src: string): (offset: number) => { line: number; col: number } {
  const starts = [0]
  // pairsBefore[k]: surrogate pairs that end before offset k.
  const pairsBefore = new Uint32Array(src.length + 1)
  let pairs = 0
  for (let k = 0; k < src.length; k++) {
    const c = src.charCodeAt(k)
    pairsBefore[k] = pairs
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = src.charCodeAt(k + 1)
      if (next >= 0xdc00 && next <= 0xdfff) {
        pairs += 1
        pairsBefore[k + 1] = pairs - 1
        k += 1
        continue
      }
    }
    if (c === 0x0d && src.charCodeAt(k + 1) === 0x0a) {
      pairsBefore[k + 1] = pairs
      k += 1
    }
    if (c === 0x0a || c === 0x0d || c === 0x0c) starts.push(k + 1)
  }
  pairsBefore[src.length] = pairs
  return (offset) => {
    let lo = 0
    let hi = starts.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (starts[mid]! <= offset) lo = mid
      else hi = mid - 1
    }
    const lineStart = starts[lo]!
    const col = offset - lineStart - (pairsBefore[offset]! - pairsBefore[lineStart]!) + 1
    return { line: lo + 1, col }
  }
}
