# Why 2.0 exists, what it deliberately does not do, and what it bet on

The milestone plan that used to live here was delivered on 2026-07-28 and is in git
history. What remains is the part that still binds: the measurements that justified the
rewrite, the exceptions that are intentional, and the risks that were accepted.

Decisions are in [`../decisions/`](../decisions/README.md): [0005](../decisions/0005-rewrite-in-bun-hono-sqlite.md)
is why Bun rather than Go, [0006](../decisions/0006-admin-stays-react-spa.md) is why the
admin stayed React, [0008](../decisions/0008-hand-written-css-no-tailwind-public.md) is why
the public CSS is hand-written.

## The measurement that ended Next.js

Measured on the live 1.x site, 2026-07-26. A post page fetched **182 KB of JavaScript**
(gzip, over the wire) across 12 files to render roughly 30 KB of HTML.

| Chunk | KB | Removable? |
|---|---|---|
| react-dom | 70 | no |
| Next app-router client | 40 | no |
| Next runtime | 13 | no |
| ServerInsertedHTML | 9 | no |
| react | 6 | no |
| turbopack runtime | 4 | no |
| misc framework | 1 | no |
| **framework subtotal** | **143** | **no** |
| application code (the 23 islands) | 39 | partly |

**79% of the payload was framework.** Deleting every island on the site would have saved
39 KB and still left 143 KB. The cost was structural, not carelessness, and that is the
whole argument for leaving. Target for 2.0: **0 KB on an article page**, under 3 KB
site-wide ([04-frontend.md](04-frontend.md)).

A 13th chunk (110 KB raw, core-js polyfills) was emitted with `noModule`, so modern
browsers never fetched it. It is excluded from every number above.

**Compression is not a lever, measured 2026-07-26. Do not revisit this.** The origin gzips
and Cloudflare passes it through. Forcing brotli was tested per chunk and saved **956 bytes
out of 194,888, or 0.5%**. HTML and CSS already arrive as zstd.

The other two reasons were operational: 1.x needed Node, Next, PostgreSQL, PostgREST,
generated JWT keys, DB roles and grants and a migration runner, all maintained by one person
on one server; and its hard `next` pin carried unpatched critical advisories that could not
be resolved without breaking the pin.

## Non-goals

- Not a rewrite of the product. Features, URLs, content model and admin concepts stay the same.
- Not horizontally scalable. One process, one machine, one SQLite file.
- Not multi-tenant ([ADR 0002](../decisions/0002-no-saas-single-instance.md)).

## Explicit parity exceptions

Deviations from Quire 1.x that are intentional. **The numbering is cited from other
documents: append, never renumber.**

1. **Google Drive backup is replaced by litestream to R2.** Continuous point-in-time
   replication instead of scheduled archives. Removes OAuth, refresh-token storage, the
   cron job and ~730 lines. A manual export/import archive is still provided.
2. **Search is accent-insensitive at the index level.** FTS5 with `remove_diacritics 2`
   does natively what the 1.x `/search` route bolted on. Ranking changed from "none" to BM25.
3. **Cache invalidation is total instead of targeted.** See [02-structure.md](02-structure.md).
4. **Sessions did not survive cutover. MCP tokens did**, deliberately: an MCP token that
   silently stops working takes AI publishing down with no error anywhere.
5. **Google login is removed.** Replaced by self-hosted password + TOTP
   ([06-auth.md](06-auth.md), [ADR 0007](../decisions/0007-self-hosted-password-totp-auth.md)).
6. **Tailwind is removed from the public site.** Retained for the admin SPA, where its
   churn is contained and its payload does not matter.

## Risks that were accepted, and how they landed

| Risk | Outcome |
|---|---|
| Admin behaviour lost in the SPA extraction | The reason the parity inventory ([public](07-parity-public.md) · [admin](07-parity-admin.md)) exists. Still the standing defence: the golden harness only sees public HTML |
| The 61 API routes more entangled with `next/cache` than the import count suggested | Accepted in advance and paid; the cutover held to schedule |
| Bun behaviour differences under load: streaming, `sharp` native module, file handles | Why M2 was required to be deployed and publicly reachable rather than benchmarked on localhost |
| **`sharp` and `satori` native parts do not embed in the compiled executable** | **Confirmed, and worse than this said. SETTLED by [ADR 0022](../decisions/0022-ship-from-source-not-a-compiled-binary.md) 2026-08-11: there is no compiled binary.** It does not throw "at first call" — `sharp` is reached on the boot path, so the process dies before it listens and a request to `/` is a connection refused. And "one executable plus a native module directory" turned out not to exist: with the real `@img/*` copied beside the executable it fails identically, because `sharp` resolves from the bundle's own `/$bunfs/root/…` path, which has no sibling directory to walk. `bun src/index.ts` from source is the only shape, and it is what every live instance runs |
| SQLite single-writer contention between analytics and content writes | Handled by two database files ([01-schema.md](01-schema.md)) with analytics batched on an interval |
| Analytics timezone bucketing regresses | Existing test cases were ported first. Bucket boundaries are computed in TypeScript, aggregation in SQL |
