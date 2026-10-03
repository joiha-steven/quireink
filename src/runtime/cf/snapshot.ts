// Cloudflare: there is no file to copy and no VACUUM. The copy before a migration is a Durable Object
// BOOKMARK — a point in the object's own history it can be restored to for 30 days — taken by
// `src/worker.ts` before the databases open (getting one is async; opening is not). What
// `copyBeforeMigrating` returns is that bookmark, for the log, exactly where Bun returns a path.
import type { SnapshotPort } from '@/runtime/ports'
import { bound } from './bindings'

let bookmark: string | null = null

/** Called by the worker with the bookmark it took just before `openDatabases`. */
export function rememberBookmark(id: string): void {
  bookmark = id
}

export const copyBeforeMigrating: SnapshotPort['copyBeforeMigrating'] = () =>
  bookmark ? `bookmark:${bookmark}` : null

// Nothing to compact: the platform owns the file and gives the space back itself.
export const compactIfMostlyFree: SnapshotPort['compactIfMostlyFree'] = () => false

/** Into the bucket, under a prefix nothing ever serves (`private/`), written after the request. */
export const keepAside: SnapshotPort['keepAside'] = (_dataDir, name, text) => {
  const { env, ctx } = bound()
  const key = `private/aside/${name}`
  ctx.waitUntil(env.BLOBS.put(key, text).then(() => undefined))
  return `r2:${key}`
}
