// When this process — on Cloudflare, this Durable Object — began: the dashboard's uptime line and
// the date the cache counter runs from.
//
// Taken when the module loads, which is right on Bun. In workerd a clock read at an isolate's
// global scope reads 0, the epoch, so the dashboard said "Started 20,760 days ago" and analytics
// "since Jan 1, 1970" (2026-11-03). The object's `boot()` stamps both at its first request
// instead (`worker.ts`), and a value already set is left alone, so Bun keeps its load time.
import { cacheStats } from '@/server/cache'

let at = Date.now()

/** The first request of an object whose module loaded on the epoch: now is when it began. */
export function markStarted(now: number = Date.now()): void {
  if (at <= 0) at = now
  if (cacheStats.since <= 0) cacheStats.since = now
}

export const startedAt = (): number => at

/** Test seam: the value is process-global, like the cache counter. */
export function setStartedForTest(value: number): void {
  at = value
}
