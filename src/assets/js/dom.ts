// Shared DOM helpers. Bundled into every entry point that uses one, never served alone.
// `whenActivated` lives in `activation.ts` rather than here, because the bundler shakes
// per module and keeping it here shipped it to pages that never call it.

/**
 * A label the server put on `<body>`. Every string a script shows a reader is translated
 * server-side and handed over as a data attribute, so the bundle carries no copy of the
 * locale table and no language of its own.
 */
export function label(name: string): string {
  return document.body.dataset[name] ?? ''
}

/**
 * The body of an API response, out of its envelope.
 *
 * Every handler answers `{success, data}`. The islands were written against the bare
 * payload and kept reading it that way after the envelope was introduced for the admin:
 * search returned an object where an array was expected and showed nothing, and the comment
 * thread destructured `comments` off the wrapper, got undefined, and threw. Both failed
 * silently in the sense that mattered - the page looked empty rather than broken.
 *
 * An error response has no `data` and is returned as-is, which is what the callers reading
 * `.error` off it expect.
 */
export async function payload<T>(res: Response): Promise<T> {
  const body: unknown = await res.json()
  return (body !== null && typeof body === 'object' && 'data' in body
    ? (body as { data: T }).data
    : body) as T
}

/** Create an element with attributes and children in one call. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v)
  node.append(...children)
  return node
}

// The scroll watcher lives in motion.ts with the rest of the motion engine. Re-exported here
// only so the book files, which the owner is rewriting, keep importing it from this module
// until that work lands; new code imports it from './motion'.
export { onScrollFrame } from './scroll'
