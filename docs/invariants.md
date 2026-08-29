# Invariants

The load-bearing rules. Break one and something breaks in production quietly — no crash, no
red test, just a page that never updates or a deleted row that comes back.

Each is enforced in ONE place in code and pinned by a test or a static guard, all run by
`bun run check:all`. A change that weakens one updates its guard in the SAME commit, which
is what makes the weakening visible in review.

The reasoning behind each is in [`spec/02-structure.md`](spec/02-structure.md).

| # | Rule | Enforced at | Pinned by |
|---|---|---|---|
| 1 | **The cache is cleared COMPLETELY after every write.** `clearCache()`, unconditional. No per-tag, per-path or per-kind invalidation. Structural since 2026-08-29: the owner gate flushes after every successful state-changing request, and the MCP door wraps every write tool the same way — a handler that forgets cannot exist | [`src/server/cache.ts`](../src/server/cache.ts) · [`src/web/guard.ts`](../src/web/guard.ts) · [`src/web/admin/mcp-transport.ts`](../src/web/admin/mcp-transport.ts) | `src/web/app.test.ts` · `src/web/admin.test.ts` |
| 2 | **Posts and pages share ONE `/{slug}` namespace.** `ensureSlugFree` on create and on rename; a trashed row still reserves its slug | [`src/content/slugs.ts`](../src/content/slugs.ts) | `src/content/slugs.test.ts` · `src/web/admin.test.ts` |
| 3 | **Image refs are stored store-relative.** `collapseBlob` on write, `expandBlob` on read, in the data layer only — stored bytes carry no origin | [`src/media/blob.ts`](../src/media/blob.ts) | `src/media/blob.test.ts` · `src/web/admin-uploads.test.ts` |
| 4 | **Write routes are owner-gated by router-group MEMBERSHIP**, not by a check inside the handler. A new write route is protected because of where it is mounted, or it fails the build | [`src/web/guard.ts`](../src/web/guard.ts) | `check:routes` · `src/web/admin.test.ts` |
| 5 | **Raw HTML in user content is escaped, never executed.** `escapeHtml` first; `javascript:`/`data:`/`vbscript:` hrefs are dropped | [`src/utils.ts`](../src/utils.ts) | `src/render/post-content.test.ts` · `src/comments/comment-md.test.ts` |
| 6 | **Every delete is a soft delete.** `deleted_at` is set; every live read filters through the single `liveOnly()` fragment, and Trash reads its complement | [`src/store/db.ts`](../src/store/db.ts) | `src/store/db.test.ts` |
| 7 | **Analytics writes go through the flush buffer**, never straight from a handler. A request never waits on an analytics write | [`src/analytics/buffer.ts`](../src/analytics/buffer.ts) | `src/analytics/analytics.test.ts` |

## Why 1 is blunt on purpose

The frozen tree invalidated selectively, per kind and per action, and the rule there was
"never under-purge" — a superset, because getting the set exactly right was impossible and
being wrong meant a published post nobody could see. 2.0 removes the problem instead of
managing it: the page cache is one `Map` in one process, so throwing all of it away costs a
few renders and cannot be wrong.

The owner can switch the cache off entirely (Settings → System, `settings.cache.enabled`),
which does not weaken this rule: it decides whether there is a cache to clear, never how one
is invalidated. When it is on, a write still empties all of it. See
[`delivery.md`](delivery.md), "The switch".

Note that this is the IN-PROCESS cache only. What a *shared* cache in front of the app may
do is a separate rule with a separate file, [`src/web/cache-headers.ts`](../src/web/cache-headers.ts),
because a CDN cannot be told to forget.
