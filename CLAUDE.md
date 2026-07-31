# Quire — router

Public, open-source blog platform. A single **Bun + Hono + SQLite** process: `src/` at the
repository root is the implementation that serves the live site.

**Zero personal data in this repo.** Real credentials live only in the gitignored `.env`;
never commit them. Personal and instance facts are not tracked in git.

> `v1/` is the **retired Next.js implementation**, replaced on 2026-07-28 (ADR 0012) and
> shut down on 2026-07-31. It runs nowhere and takes no patches, security included: it is
> kept as a readable record of the old behaviour, and [`v1/CLAUDE.md`](./v1/CLAUDE.md) says
> what that means. Read it freely for that. Do not edit it.

## This file is a ROUTER. It restates nothing.

One rule lives in exactly one file, because two copies means one is wrong within a month.
Capped at 170 lines and held there by `check:docs`, since it loads every turn.

| Looking for | Go to |
|---|---|
| Load-bearing rules you must not break | [`docs/invariants.md`](./docs/invariants.md) |
| How the pieces fit, module map, request flow | [`docs/spec/02-structure.md`](./docs/spec/02-structure.md) |
| Database schema and the Postgres mapping | [`docs/spec/01-schema.md`](./docs/spec/01-schema.md) · [`src/store/schema.sql`](./src/store/schema.sql) |
| Public rendering, islands, the CSS split | [`docs/spec/04-frontend.md`](./docs/spec/04-frontend.md) |
| Sign-in, TOTP, sessions | [`docs/spec/06-auth.md`](./docs/spec/06-auth.md) |
| What a feature does, per area | [`docs/features.md`](./docs/features.md) |
| What `/` serves: list, a page, or the front page | [`docs/homepage.md`](./docs/homepage.md) |
| Typography, layout, i18n, releases | [`docs/conventions.md`](./docs/conventions.md) |
| Fonts, CSS, island JS — the resource-loading law | [`docs/performance.md`](./docs/performance.md) |
| SEO, feeds, OG, PWA · MCP · agent discovery | [`docs/seo-pwa.md`](./docs/seo-pwa.md) · [`docs/mcp.md`](./docs/mcp.md) · [`docs/agent-ready.md`](./docs/agent-ready.md) |
| Backups and restore | [`docs/backups.md`](./docs/backups.md) |
| Running it on your own box | [`docs/self-host.md`](./docs/self-host.md) |
| Admin visual contract | [`docs/admin-design.md`](./docs/admin-design.md) |
| **Why was this decided, does it still hold** | [`docs/decisions/`](./docs/decisions/README.md) |
| Roadmap, tasks, open questions, worklog | [`state/`](./state/README.md) |
| What was deliberately NOT carried over | [`docs/spec/07-parity.md`](./docs/spec/07-parity.md) |

Anything dated is a snapshot and lives in `state/audits/` or `state/reports/`, which are
**write-only**: never retro-edited, never swept for current context.

⚠ Several files in `docs/` were written against the frozen tree and carried over because
their RULES are current and 2.0 follows them. Where one cites a file path, the path is
`v1/src/…` unless it says otherwise. Refreshing those citations is tracked in
[`state/TASKS.md`](./state/TASKS.md).

## Working principles

**1. Think before coding.** State assumptions. If two readings are possible, present both
rather than picking silently. If a simpler approach exists, say so and push back when
warranted. If something is unclear, stop, name what is confusing, and ask.

**2. Simplicity first.** The minimum code that solves the problem. No speculative
abstractions, no interfaces with one implementation, no error handling for impossible
states. If 200 lines could be 50, rewrite it.

**3. Surgical changes.** Touch only what the task requires. Do not "improve" adjacent code,
comments or formatting. **Mandatory exception:** when behaviour changes, update the matching
doc in the SAME change. That is part of the request, not scope creep.

**4. Definition of Done: `bun run check:all` exits 0.** Typecheck, the static guards
(`filesize` / `css` / `routes` / `docs`) and `bun test`. No "it compiles" exception.
Behaviour not covered by `check:all` gets a test in the same commit. A change touching
`src/render` or `src/web` also runs the golden compare.

**5. RUN what you changed and LOOK at it. Never test against production.** `check:all`
proves the code compiles and the seams hold. It cannot tell you a column collapsed to
`reader@e…`, or that three columns are 14px out of alignment. Both shipped, because nobody
opened the page.
- **Drive it with headless Chromium** — [`scripts/drive.ts`](./scripts/drive.ts),
  [`scripts/shot.ts`](./scripts/shot.ts). Navigate, click, screenshot, read the DOM,
  **measure**. Do NOT reason about rendered CSS from source, and do NOT ask the human for
  screenshots.
- **Verify against the ORIGIN, not through the CDN.** A shared cache in front of the site
  will hand you HTML from two deploys ago and you will debug a fix you already shipped.
- **Production is not a test environment.** A newsletter cannot be unsent.

## DEBUG ROUTER — when you hit a symptom, read THESE files first

| Symptom / area | Read these first |
|---|---|
| Routing, middleware, what a request does | `src/web/app.ts`, `src/web/guard.ts`, `src/web/cache-headers.ts` |
| Cache / content not updating | `src/server/cache.ts` (in-process), `src/web/cache-headers.ts` (shared) |
| A page's HTML | `src/web/{layout,chrome,article,listing}.ts`, `src/web/*.css.ts` |
| Markdown → HTML, code highlighting, footnotes | `src/render/` |
| Island JS (search, theme, comments, subscribe, book mode) | `src/assets/js/` |
| Admin SPA, editor | `src/admin/`, `src/web/admin/` |
| Sign-in, TOTP, sessions, recovery codes | `src/auth/`, `src/web/auth.ts` |
| Posts, pages, slugs, series, revisions, settings | `src/content/` |
| Uploads, image variants, ranges | `src/media/` |
| Newsletter, broadcast, SMTP | `src/news/` |
| Comments | `src/comments/` |
| Analytics | `src/analytics/` (writes go through `buffer.ts`) |
| SQL, migrations, the live/trashed predicate | `src/store/` |
| Scheduled publishing, redirects, rate limit, activity | `src/server/` |
| MCP server, tokens | `src/mcp/`, `src/web/mcp-wire.ts` |
| UI strings, translations | `src/i18n/`, `src/locales/` |
| Importing from the frozen tree | `src/import/`, `scripts/import-v1.ts` |

## Hard rules

- **400 lines per file maximum. No `any`** — use `unknown` and narrow. `any` is acceptable
  only at a JSON boundary that immediately validates into a typed shape.
- **No SQL string building.** Every query is a literal with bound parameters. The single
  exception is the analytics facet column, which comes from a fixed lookup table
  ([`docs/spec/01-schema.md`](./docs/spec/01-schema.md) §3).
- **Every write route is mounted on the owner-gated router group**, not checked inside the
  handler ([invariant 4](./docs/invariants.md)).
- **Every handler** times and logs its request, catches and logs errors, and returns a typed
  error response.
- **Secrets never reach a client-bound payload**: `users.password_hash`, `users.totp_secret`,
  `recovery_codes`, `integration_keys`, `mcp_tokens`.
- **Public UI colours come ONLY from theme tokens.** Never a hardcoded `neutral-*`, `white`,
  `black` or hex. ONE typeface, no hardcoded sizes, one divider style, never ALL-CAPS.
- **UI strings live in `src/i18n` only**, all 6 languages in sync (en, then vi, de, ja, zh,
  ko). Code, comments, identifiers, filenames, commits and docs: **English**.
- **Comments explain why, not what.** The Next codebase was unusually good at this; keep the
  standard.
- **Behaviour change → update its doc in the same commit.** Rules to `docs/`, decisions to
  `docs/decisions/` (append-only), what happened to `state/WORKLOG.md`.
- **Do NOT read CHANGELOG.md while coding.** It is append-only at release time and its
  history is never needed to fix or understand code.

## The porting rule — still in force

Anything still being moved from `v1/src` is a **port, not a rewrite**. Move it; do not
improve it, rename its exports, or modernise its idioms on the way. Its tests move with it,
in the same commit. If the file is genuinely wrong, port it as-is first and fix it in a
separate commit that says what changed and why. Every "small improvement" made in transit
is a place a behaviour can vanish without anyone noticing.

## Database

Two SQLite files, `quire.db` and `analytics.db`, joined with `ATTACH` where needed.
`bun:sqlite` is synchronous and the runtime is single-threaded, so there is exactly one
writer by construction: no pool, no mutex, no busy-retry. The cost is that a slow query
blocks everything, so keep the request path indexed. Timestamps are **INTEGER milliseconds
since epoch, UTC**, everywhere; timezone logic lives in TypeScript, never in SQL.
