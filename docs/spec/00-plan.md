# Quire 2.0: master plan

Status: **DELIVERED.** M0 through M4 are done; Quire 2.0 has served the first instance since
2026-07-28. This document is the plan, not the tracker; the live list is kept outside this
repository (ADR 0017) and where the two disagree the tracker is right.

Supersedes the abandoned Go plan, whose specs were deleted on 2026-07-29 once everything
worth keeping had been folded into this directory. The record of that reversal is
[ADR 0004](../decisions/0004-rewrite-in-go-on-sqlite.md); "What changed from the Go plan"
below is the argument.

## Goal

Replace the Next.js implementation of Quire with a **Bun + Hono + SQLite** one that
ships as a single executable plus a single SQLite file, at full feature parity, then
retire the Next codebase.

The reason is NOT raw speed. It is:

1. **Payload.** Measured on the live site, a post page fetches **182 KB of JavaScript**
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

   **79% of the payload is framework.** Deleting every island on the site would save
   39 KB and still leave 143 KB. That is the whole argument for leaving Next: the cost
   is structural, not a result of the application being careless.

   Target for Quire 2.0: **0 KB on an article page**, under 3 KB site-wide. See
   04-frontend.md.

   Note: a 13th chunk (110 KB raw, core-js polyfills) is emitted with `noModule`, so
   modern browsers never fetch it. It is excluded from every number above.

   **Compression is not a lever, measured 2026-07-26.** The origin gzips and Cloudflare
   passes it through. Forcing brotli was tested per chunk and saves **956 bytes out of
   194,888, or 0.5%**. HTML and CSS already arrive as zstd. Do not revisit this.

2. **Operations.** Today the instance needs Node, Next, PostgreSQL, PostgREST,
   generated JWT keys, DB roles and grants, and a migration runner, all maintained by
   one person on one server. Target: one executable and one file.

3. **Dependency surface.** The current tree pins `next` hard and carries unpatched
   critical advisories that cannot be resolved without breaking the pin. Removing
   `next` removes the tree those advisories live in.

## Why Bun and not Go

The Go plan aimed at the same three goals. It was dropped for four reasons, recorded
here so the decision is not relitigated from memory.

**1. Porting beats reimplementing, and feature loss happens in the gap.**

```
src/lib          42 of 65 files never touch the database: ~6,500 lines of pure logic
                 (footnotes, toc, video, taxonomy, series-order, comment-tree,
                  inline-md, paginate, i18n, ua, utils, slugs, themes,
                  settings migration, email builders, wordpress-import)
tests            35 files, 2,427 lines, the only safety net that exists
db() call sites  132 across 28 files
```

In TypeScript that pure logic and every one of those tests **moves**. In Go all of it
is translated, and translation is precisely where behaviour goes missing. The tail that
gets lost is not in the renderer, which a golden harness covers, it is in things like
"`updateTerm` merges on collision", "the double-send guard reads the send log, not
`broadcast_at`", "purged comments tombstone and orphans re-root". None of those have
tests, and none of them are visible in a diff of rendered HTML.

**2. Three weeks instead of eight or nine.** The Go plan's own risk register rated
"project stalls before M1" as **High**. A three-week project does not stall.

**3. The quality regressions disappear.** `marked`, `shiki`, `sharp` and `satori` are
kept, so there is no goldmark parity risk, no Chroma downgrade, no OG image renderer to
rebuild for Vietnamese diacritics, and no second markdown engine living permanently
beside the first one in the newsletter and editor paths.

**4. The durability gap is smaller than the language ranking suggests.** What actually
rots on a ten-year horizon is the tooling layer, not the language. This plan makes that
layer unusually thin on purpose: no bundler for server code, no CSS framework, no UI
framework on the public site, and Hono runs unchanged on Node, Deno and Workers. The Go
plan meanwhile depended on `templ` and `sqlc`, two third-party code generators, which
is churn it did not need to buy.

**The residual risk is Bun itself**, a runtime from a single venture-funded company, and
it is accepted because the exit is shallow: `bun:sqlite` maps to `node:sqlite` (now in
the Node standard library), Hono is runtime-agnostic, and losing `bun build --compile`
returns the deployment to "a runtime plus a directory", which is exactly today's
position and no worse.

## Stack decisions

| Area | Choice | Why |
|---|---|---|
| Runtime | Bun | `bun build --compile` produces one executable; `bun:sqlite` and `Bun.password` are built in |
| HTTP | Hono | Tiny, typed, runtime-portable. The escape hatch if Bun ever has to go |
| DB | SQLite via `bun:sqlite` | In-process, synchronous, no driver to maintain |
| Queries | Hand-written SQL in a thin repository layer | No ORM. The current data layer is already thin; keep it that way |
| Templates | Hono JSX, server-side only | The 13 public server components port with near-zero edits. Zero client runtime |
| Markdown | **`marked`, kept** | Same renderer means article bodies stay byte-identical. See 03-golden.md |
| Highlighting | **`shiki`, kept**, run at save time | Highlighted HTML is stored, so the renderer has no highlighter at runtime |
| Images | **`sharp`, kept** | Already libvips underneath; AVIF and WebP output is unchanged |
| OG images | **`satori`, kept** | Vietnamese diacritic shaping already works. Do not rebuild this |
| Editor | **Tiptap + React, kept**, as an embedded SPA | See "Admin stays React" below |
| CSS | **Hand-written, no Tailwind on the public site** | Removes the highest-mortality dependency in the tree |
| Public JS | Hand-written vanilla, no bundler | Three small files, no dependencies |
| Auth | Self-hosted: password + TOTP. **Google login removed** | See 06-auth.md |
| Mail | `nodemailer`, kept | Works on Bun |
| MCP | `@modelcontextprotocol/sdk`, kept | The reference implementation, kept current upstream |
| Backup | `litestream` to Cloudflare R2 | A standalone binary replicating a SQLite file; language-agnostic. Replaces ~730 lines of Google Drive OAuth and cron |

## Admin stays React

**61 of 66 admin components are already `'use client'`.** The admin is a client-side
React application; Next is only the shell around it.

So it is not ported. It is **built as a static SPA with Bun's bundler, embedded in the
executable, and served by Hono**, talking to the same JSON API it talks to today.
`04-frontend.md` already established that admin payload is irrelevant because only the
owner loads it.

This deletes the single largest and riskiest work item in the Go plan: no Tiptap port to
vanilla, no ProseMirror NodeView rewrites, no Vietnamese IME regression risk, no
reimplementation of autosave, crash recovery and conflict detection.

Cost accepted: React idiom has a high ten-year mortality, so this code will need
rewriting eventually. That is the right trade, because the cost of rewriting it later is
falling faster than the risk of keeping it is rising.

## Non-goals

- Not a rewrite of the product. Features, URLs, content model and admin concepts stay
  the same.
- Not horizontally scalable. One process, one machine, one SQLite file.
- Not a new name. The product stays **Quire**. `v2/` was a temporary directory and
  disappeared at M4.
- Not multi-tenant. See "Audience".

## Repository layout

During development the Next tree was **not moved** and kept deploying unchanged, with the
new implementation built alongside it in `v2/`. At cutover the two swapped places
([ADR 0012](../decisions/0012-flatten-repo-after-cutover.md)): 2.0 is now the repository
root and the Next tree is `v1/`.

```
quire/
  src/                              see 02-structure.md
  scripts/                          build, checks, ops, the importer
  golden/                           parity harness + reference snapshots
  docs/spec/                        this directory
  v1/                               Next.js, FROZEN
```

That swap happened in a single commit on 2026-07-28. The Next tree went to `v1/` rather
than the `legacy/` this section originally proposed, and the deploy now tars from the
repository root.

## Freeze policy

From 2026-07-26, `src/` accepts **security patches only**. No new features, no refactors.
Version stays at **1.5.0**.

(The root `CLAUDE.md` says 1.4.37; that is stale, v1.5.0 shipped 2026-07-26. Fix it in
the same commit as this plan.)

`v2/` starts at `2.0.0-dev`.

## Milestones

Every milestone must produce something deployed and reachable over the internet. A
milestone that only runs on localhost does not count as done.

### M0: Quick wins on the frozen tree, DONE 2026-07-27

An explicit exception to the freeze, agreed because the changes are contained and needed
no matter what happens to the rest of this plan.

Shipped to the live instance ahead of M4, rather than waiting for the milestone.

| Planned | Found | Shipped |
|---|---|---|
| Subset Literata per script, 107 KB to 30 KB | Already subset, and the preload rule was already correct. Real size **97,588 B** (latin + vietnamese, since the site runs `language: vi`) | `opsz` pinned at 18 on both book serifs: preload set **97,588 to 46,212, −53%**, and 180 KB off the font directory. `scripts/subset-font-axes.py` |
| Split `public.css` from `admin.css`, "only partially honoured" | **Already fully honoured.** Verified in the build, not assumed: public chunk **8,754 B brotli**, zero admin markers, admin chunk absent from a post's HTML | nothing to do |
| Add Speculation Rules | Not present | Shipped, `eagerness: moderate`, excluding `/admin`, `/api`, `/uploads`, `/preview`, `/og` |

The unplanned find was in the third item: **a prerendered page runs its JavaScript at
speculation time.** Shipping the rules alone would have made `Track` record a pageview
every time a reader hovered a link, and `ScrollDepth` count the speculation wait as dwell.
Both now defer through `lib/prerender.ts` until `prerenderingchange`. Analytics rows are
kept forever, so that bug would not have been self-correcting.

**Two lessons that apply to the rest of this plan:**

1. **Verify a claim before acting on it, but verify it against production.** The CSS item
   was already done and would have been wasted work. Separately, a local build reported the
   font preset as Inter with `lang="en"`, which briefly produced a confident and wrong
   "the plan's premise is false" correction; `.env.local` points at a dev database whose
   `settings` row differs from the live one. Anything settings-dependent must be read off
   the server.
2. The Go documents' numbers were measured once and reused as fact. The Literata figure
   held up; **re-measure the others before acting**, including the 182 KB JavaScript figure
   in the Goal section above.

### M0.5: Feature inventory (half a day, before any v2 code)

One line per user-visible behaviour, with a tick box. Sources: `/admin/help`
(`HelpGuide` + `HelpSections`, written for a non-technical owner and therefore already a
complete feature list), `docs/features.md`, `CHANGELOG.md`.

This is the primary defence against silent feature loss and it is cheaper than any test.

**Gate:** the list exists and Hùng has read it.

### M1: Foundations and data layer (week 1)

- SQLite schema (01-schema.md), applied at boot from an embedded `schema.sql`
- `import-v1` importing production data into SQLite, with the four verification tiers
  (05-importer.md)
- The 132 `db()` call sites moved from `@supabase/postgrest-js` to `bun:sqlite`
- The 6 plpgsql functions reimplemented in TypeScript (01-schema.md section 3)
- The ~6,500 lines of pure logic moved unchanged; all 35 test files passing

**Gate:** `bun test` green on the moved suite, importer verification clean against a copy
of production.

### M2: Public renderer (week 2)

- 13 public server components to Hono JSX
- 23 islands to vanilla, per the table in 04-frontend.md
- Hand-written CSS replacing Tailwind on the public site
- Everything a reader sees: posts, pages, the shared `/{slug}` namespace, category, tag
  and series pages with pagination, search, preview links, RSS, sitemap, robots,
  llms.txt, OG images, ToC, footnotes, video embeds, `<picture>`, book mode, 6 theme
  palettes, 6 locales, redirects, scheduled publishing

**Gate:**
- Deployed to a real subdomain, serving imported production content
- **Article bodies byte-identical to v1** (03-golden.md; achievable because the renderer
  is unchanged, so unlike the Go plan this is a hard gate, not a reviewed diff)
- Article page ships 0 KB JS, under 10 KB CSS brotli
- Lighthouse on a real post at least matches the current site

### M3: Admin, API and everything else (week 3)

- Admin built as an embedded SPA; `next/navigation`, `next/link`, `next/dynamic` removed
  (about 65 import sites)
- 61 API routes moved from `next/server` to Hono handlers (93 import sites)
- Auth rebuilt per 06-auth.md; `next-auth` removed entirely
- Comments, newsletter, analytics v2, MCP, backup and restore, WordPress import,
  activity log, health probe, cron jobs
- litestream to R2 replacing the Google Drive backup

**Gate:** newsletter round trip through Mailpit, backup taken and restored into an empty
instance, MCP connected from a real client and a post written through it, and a scripted
headless tour of **at least 30 admin flows** passing (not the single flow the Go plan
specified).

### M4: Cutover (week 4)

Final import, DNS switch, one week of observation, then the repository reshuffle.

**Gate:** seven days on the new stack with no rollback.

Then: **keep the frozen Next tree runnable for 3 to 6 months**, pointed at a read-only
copy of the database, so "did we lose something?" can be answered by comparison instead
of memory.

## Risk register

| Risk | Severity | Mitigation |
|---|---|---|
| Admin behaviour lost in the SPA extraction | **High** | M0.5 inventory + the 30-flow headless tour + keeping v1 runnable after cutover |
| The 61 API routes are more entangled with `next/cache` and ISR than the import count suggests, and week 3 becomes weeks 3 to 5 | Medium | Accepted. Even at 5 weeks this beats the alternative. Do the two most cache-entangled routes first as a probe |
| Bun-specific behaviour differences under load (streaming, `sharp` native module, file handles) | Medium | M2 must be deployed and publicly reachable, not benchmarked on localhost |
| `sharp` / `satori` native and wasm parts do not embed in the compiled executable | Medium, **now measured** | Confirmed 2026-07-27, not predicted: `bun build --compile` bundles sharp's JavaScript but not its `@img/sharp-<platform>` native module, and the resulting binary throws "Could not load the sharp module using the win32-x64 runtime" at first call, from any working directory. So "one executable" is really "one executable plus a native module directory". Decide at M4: ship `node_modules/@img/*` beside the binary, or run from source with `bun src/index.ts` (which works today). The Go plan had the same asterisk via cgo and libvips |
| SQLite single-writer contention between analytics and content writes | Low | Two database files (01-schema.md), analytics batched on an interval |
| Analytics timezone bucketing regresses | Medium | Port the existing test cases first. Bucket boundaries computed in TypeScript, aggregation in SQL |
| Project stalls | Low | Three weeks, and M0 already shipped the biggest user-visible win independently |

## Explicit parity exceptions

Deviations from Quire 1.x that are intentional.

1. **Google Drive backup is replaced by litestream to R2.** Continuous point-in-time
   replication instead of scheduled archives. Removes OAuth, refresh-token storage, the
   cron job and ~730 lines. A manual export/import archive is still provided.
2. **Search becomes accent-insensitive at the index level.** FTS5 with
   `remove_diacritics 2` does natively what the `/search` route currently bolts on.
   Ranking changes from "none" to BM25.
3. **Cache invalidation becomes total instead of targeted.** See 02-structure.md.
4. **Sessions do not survive cutover.** MCP tokens do.
5. **Google login is removed.** Replaced by self-hosted password + TOTP, decided
   2026-07-27. See 06-auth.md.
6. **Tailwind is removed from the public site.** Retained for the admin SPA, where its
   churn is contained and its payload does not matter.

## Audience (settled 2026-07-26, and half of it no longer holds)

> ⚠️ **The first paragraph below was true when the rewrite was planned and is not true now.**
> It is left as written because it explains why several things in this plan were scoped the
> way they were. There are three instances today, the software ships a self-hosting guide, a
> Docker image and a public demo, and [ADR 0015](../decisions/0015-relicense-polyform-noncommercial.md)
> relicensed it for exactly the audience this paragraph says does not exist. Read it as a
> record of an assumption, not as a statement about the project.

**There are no third-party self-hosters.** Quire runs one instance, the author's own blog,
used by its author. The repository is public, but nobody else depends on it.

**SaaS is not a goal.** Nothing in Quire 2.0 is designed for multi-tenancy. This half still
holds; [ADR 0002](../decisions/0002-no-saas-single-instance.md) is in force.

Consequences:

- M4 needs no deprecation window and no migration guide. Cutover is a private operation.
- Parity is judged by the one person who uses the product. "Does this bother me" is a
  legitimate and sufficient test.
- Anything built purely to be a good open-source citizen is out of scope.
