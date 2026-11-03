// One read of the post index per page, however many parts of the page ask for it.
//
// A listing asks for the whole index several times over: the list itself, then the sidebar's
// taxonomy, its recent posts and its series, each a full read with a term subquery per row. Measured
// 2026-11-03 at 5,000 posts with the page cache empty: a 404 cost 107 ms, `/tag/nope` 133 ms, and
// one read 16 ms of it each time. A 404 is never cached and never rate limited, so every probe for
// `/wp-login.php` paid it.
//
// ⚠️ PER PAGE, NOT PER PROCESS. A copy kept across requests would be a second cache beside the page
// cache, and every write that does not pass the owner gate would have to know about it (invariant 1).
// The scope is one GET or HEAD (`cacheHeaders()` in `web/cache-headers.ts`), which reads, renders and
// answers, so inside it there is nothing to know; a write never runs inside one.
//
// ⚠️ AND A FLUSH STILL WINS. `clearCache()` moves the generation on, so a snapshot taken before a
// write is not handed out after it, in this request or any other: the same blunt rule.
import { AsyncLocalStorage } from 'node:async_hooks'
import { onFlush } from '@/server/cache'

type Kept = { generation: number; value: unknown }
const scope = new AsyncLocalStorage<Map<string, Kept>>()
let generation = 0
onFlush(() => { generation++ })

/** Run `fn` as one page read: the reads inside it that ask `once` share one answer. */
export const withReadScope = <T>(fn: () => Promise<T>): Promise<T> => scope.run(new Map(), fn)

/** `read()`'s answer, read once per page and per generation; a plain read outside a page. */
export function once<T>(key: string, read: () => T): T {
  const kept = scope.getStore()
  if (!kept) return read()
  const hit = kept.get(key)
  if (hit && hit.generation === generation) return hit.value as T
  const value = read()
  kept.set(key, { generation, value })
  return value
}
