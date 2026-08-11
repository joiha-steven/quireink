# 0021. A hosted Quire Ink, as one process per blog. `tenant_id` stays rejected

Date: 2026-08-11 · Status: **in force** · Supersedes [0002](0002-no-saas-single-instance.md) in part

## Context

[0002](0002-no-saas-single-instance.md) abandoned a fully specified SaaS on 2026-07-26 and
`ROADMAP.md` Phase 7 carries the plan as history with the instruction **"Do not propose
`tenant_id` again."** The owner reversed the direction on 2026-08-11: there will be a hosted
Quire Ink.

This ADR does not reopen the argument 0002 settled. It records that the *goal* changed, that
0002's reasoning about `tenant_id` was right and is now right for a second reason, and which
architecture the code as it stands actually makes cheap.

Two things are different from 2026-07-26, and neither is a change of mind:

1. **The data layer 0002's plan was written against no longer exists.** Every line of Phase 7
   assumes Postgres, PostgREST, RLS and `service_role`. [0005](0005-rewrite-in-bun-hono-sqlite.md)
   deleted all four. `tenant_id` on 22 tables across 183 call sites would now be a rewrite of
   the data layer to buy an isolation boundary that **one SQLite file per blog already is**: no
   query can reach a file the process did not open. Adding a column to re-earn what a path
   already gives is the part that was never worth it, and it is worth less now than it was.
2. **A blog's entire identity is three environment variables** — `DATA_DIR`, `PORT`,
   `SITE_URL` ([`src/env.ts`](../../src/env.ts)) — and three instances already run this way on
   two machines. That was not true when 0002 was written; the app was a Next.js deployment
   against a shared database.

0002's own last consequence called this: *"If this ever reverses, 'one SQLite file per tenant'
is the direction to take. Do not build for it now."* This ADR is that reversal, taking that
direction, and nothing was built for it in the meantime.

## Decision

**A hosted blog is a process with its own two SQLite files and its own uploads directory.**
Tenancy is the filesystem and the process boundary. No `tenant_id` column, no row-level
predicate, no per-request tenant resolution inside the app — the app continues not to know
that other blogs exist.

What gets built is a **control plane** beside the app, not inside it: provision a blog,
route a hostname to its process, issue its certificate, hold its quota, back it up, delete it.
The app's contribution to all of this is the two limits added on 2026-08-11
([`src/media/limits.ts`](../../src/media/limits.ts)) and the `HOST` variable, both of which a
single-owner self-host wanted anyway.

**Rejected: one shared process serving many blogs, resolving the database per request.** The
seam exists and would not be expensive — [`src/store/query.ts`](../../src/store/query.ts) is
already `bind(get: () => Db)`, so roughly seven module singletons would become tenant-scoped
(`store/db.ts`, `content/settings.ts`'s `id = 1`, `server/cache.ts`, `web/compress.ts`,
`server/rate-limit.ts`, the store directory, `auth/secret.ts`). It is rejected on blast radius,
with a measurement: `bun:sqlite` is synchronous, and a listing render is **77.6 ms at 20,000
posts** (measured 2026-08-11 — 0.9 / 3.6 / 9.1 ms at 500 / 2,000 / 5,000). In a shared process
that is every other blog's request waiting behind one blog's archive. Isolation would also
become a property of a resolver nobody can see rather than of a file nobody can name.

## Consequences

- **The cost is RAM, and it is known.** ~140 MB per blog before a word is written (measured on
  the live box: 150 MB and 129 MB for two instances), plus content — RSS reached 462 MB at
  20,000 posts. It does not grow with traffic: +3 MB across 40 requests against an empty
  database. A hundred blogs is therefore ~15 GB before content, and that is the number the free
  tier has to be argued against, not a smaller one.
- **The eject path stays free**, which is what [0002](0002-no-saas-single-instance.md) and the
  "no lock-in" principle in `ROADMAP.md` care about. A blog is already a directory and two
  files; export is a copy, not a query with a `where` clause.
- **`web/guard.ts` treats any account holding a session as the owner**, and the schema has no
  role column. The single-owner rule is enforced in
  [`src/auth/users.ts`](../../src/auth/users.ts) as of 2026-08-11 — `createUser` refuses a
  second account — and that is what makes a signup route in the control plane safe: it creates
  a BLOG, each with one account, never a second account in an existing blog.
- **Per-blog quota is a precondition, not a feature.** It exists now
  (`STORAGE_QUOTA_GB`, narrowable by the blog and never raisable), which is why it is listed
  here rather than deferred.
- The rate limiter is per-process and in-memory, which under process-per-blog is exactly right
  and needs no shared store. Under the rejected option it would have needed Redis.
- Phase 7 of `ROADMAP.md` stays as history. Its tenancy section is superseded by this file; its
  *non*-tenancy sections — the free tier's reasoning, BYOS, the abuse and liability guardrails —
  were never about `tenant_id` and remain the starting point.
- **What this ADR does not decide:** how a hostname reaches a process (reverse-proxy config
  generation versus a router process), where certificates come from, what the control plane is
  written in, and whether blogs are processes or containers. Those are a spec, not a decision,
  and the rule in [`README.md`](README.md) says a 200-line ADR is a spec wearing the wrong hat.
