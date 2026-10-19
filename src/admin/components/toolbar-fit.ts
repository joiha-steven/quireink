// How much of the button row fits on one line, and what goes behind "More".
//
// A PURE FUNCTION OF WIDTHS, so the decision can be tested without a browser: the bar measures
// its keys and the room it has, and this says how many clusters stay on the row. Everything
// after them moves, from the END of the row, behind one "More" key.
//
// WHOLE CLUSTERS FIRST. A cluster is one idea (the marks, the block types, the lists, the
// shapes, the inserts), and half of the headings on the row with the other half in a menu is a
// row that no longer says what it holds. Only when not even the first cluster fits beside the
// More key does that cluster split, key by key, because a row with nothing on it but "More" is
// worse than a split.

/** The answer: `whole` clusters stay on the row, then `part` keys of the next one. */
export type RowFit = {
  /** Clusters drawn whole, counted from the start. Equal to the cluster count when all fit. */
  whole: number
  /** Keys of cluster `whole` that stay on the row. Non-zero only when `whole` is 0. */
  part: number
}

/**
 * @param clusters  each cluster's key widths, in order along the row
 * @param room      the width the row may take (the strip less its padding)
 * @param more      the More key's width
 * @param gap       the gap between two clusters, and between the last one and More
 * @param keyGap    the gap between two keys of one cluster
 */
export function fitRow(
  clusters: readonly (readonly number[])[], room: number, more: number, gap: number, keyGap: number,
): RowFit {
  const widthOf = (keys: readonly number[]): number =>
    keys.reduce((sum, w) => sum + w, 0) + Math.max(0, keys.length - 1) * keyGap
  const widths = clusters.map(widthOf)
  // Half a pixel of slack: widths come from `getBoundingClientRect`, and a row that fits
  // exactly must not lose a cluster to the third decimal of a subpixel layout.
  const fits = (used: number): boolean => used <= room + 0.5

  const all = widths.reduce((sum, w) => sum + w, 0) + Math.max(0, widths.length - 1) * gap
  if (fits(all)) return { whole: clusters.length, part: 0 }

  // Something goes, so More is on the row, one gap after the last cluster that stays.
  let used = more
  let whole = 0
  for (const w of widths) {
    if (!fits(used + w + gap)) break
    used += w + gap
    whole++
  }
  if (whole > 0) return { whole, part: 0 }

  // Not even the first cluster fits beside More: keep as many of its keys as do.
  const first = clusters[0] ?? []
  let part = 0
  let keys = 0
  for (const w of first) {
    const next = keys + w + (part > 0 ? keyGap : 0)
    if (!fits(more + gap + next)) break
    keys = next
    part++
  }
  return { whole: 0, part }
}
