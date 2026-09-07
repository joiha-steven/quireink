// Pure path helpers for the redirect subsystem. NO imports — safe to use from the
// edge middleware (which must never pull in the node-only `db` client bundle)
// AND from the server-side data layer (`redirects.ts`).

// Normalize a request path for storage + lookup: force a single leading slash, drop
// any query/hash, collapse duplicate slashes, and strip a trailing slash (except the
// root). Returns '' if the input can't be made into a rooted path.
export function normalizePath(input: string): string {
  let p = (input ?? '').trim()
  if (!p) return ''
  p = p.split('#')[0].split('?')[0]
  // DECODED, on both sides of the question.
  //
  // A WordPress export gives its permalinks as `<link>` URLs, and `URL.pathname` is always
  // percent-encoded — so an import stored `/2020/05/b%C3%A0i-vi%E1%BA%BFt` while the router
  // hands this function `/2020/05/bài-viết`, and the two never met. Every inbound link to a
  // non-ASCII permalink answered 404, and the import report counted the redirect as saved.
  // Storing the decoded form makes one spelling of a path, which is the same rule the rest
  // of this file is about. A malformed escape is left as it was written.
  try {
    p = decodeURIComponent(p)
  } catch {
    /* not valid encoding: compare the literal */
  }
  if (!p.startsWith('/')) p = `/${p}`
  p = p.replace(/\/+/g, '/') // collapse duplicate slashes
  if (p.length > 1) p = p.replace(/\/$/, '') // drop trailing slash (keep root '/')
  return p
}

// A destination is valid if it is a rooted path or an absolute http(s) URL.
export function isValidDestination(dest: string): boolean {
  const d = (dest ?? '').trim()
  if (d.startsWith('/')) return d.length > 1 || d === '/'
  return /^https?:\/\/\S+$/i.test(d)
}
