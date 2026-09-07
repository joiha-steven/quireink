// Pure pagination helper shared by the home/category/tag lists.

export type Paged<T> = {
  items: T[]
  page: number // clamped current page (1-based)
  totalPages: number
}

/**
 * Parse a `/page/[n]` path segment. Returns the integer page only when it is a real deep
 * page (>= 2); null for "1" or junk, so those URLs 404 (page 1 lives at the bare base path,
 * and `canonicalPath` 301s the `/page/1` spelling before any route sees it).
 *
 * ONE SPELLING PER PAGE, which is why this is a regex and not `Number()`. `Number` accepts
 * `01`, `1.0`, `+1`, `1e0`, `0x2`, `0b10` and a leading space, so every one of those was a
 * second address for a page that already had one: duplicate content for a crawler, and in
 * infinite-scroll mode an unbounded set of cache entries each holding the whole archive,
 * since leading zeros never run out. `[1-9]` first is what closes that.
 */
export function parsePathPage(raw: string): number | null {
  if (!/^[1-9]\d*$/.test(raw)) return null
  const n = Number(raw)
  return n >= 2 ? n : null
}

// Slice `all` into the requested page; clamps page into range.
export function paginate<T>(all: T[], page: number, perPage: number): Paged<T> {
  const totalPages = Math.max(1, Math.ceil(all.length / perPage))
  const current = Math.min(Math.max(1, page), totalPages)
  const start = (current - 1) * perPage
  return { items: all.slice(start, start + perPage), page: current, totalPages }
}
