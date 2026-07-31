# Roadmap

Direction for Quire Ink beyond the current single-owner, self-hosted blog. This is
a planning document — nothing here is built yet unless its status says so. Operational
detail for shipped features lives in [`CLAUDE.md`](../CLAUDE.md); the *why* of the
current design is in [`docs/spec/02-structure.md`](../docs/spec/02-structure.md), and the
*why* of the implementation it replaced is in
[`v1/ARCHITECTURE.md`](../v1/ARCHITECTURE.md).

> **Done (2026-07-13):** the admin and editor received a complete monochrome UI/UX pass without
> removing working features: coherent shared surfaces/spacing/radii, compact sidebar, repaired
> settings layouts and utility actions, sticky one-row editor controls, mobile horizontal toolbar,
> restored icon/file previews, lowercase tags, and optional typewriter writing feedback. See
> [`docs/admin-design.md`](../docs/admin-design.md) and
> [`state/reports/2026-07-13-admin-redesign.md`](../state/reports/2026-07-13-admin-redesign.md).

## Goal

Make Quire Ink something other people can actually run and live in - not just the
author's personal instance. Near-term tracks:

1. Run anywhere: **native self-host or Docker**, from one codebase.
2. Publish from a **Markdown note app** (Obsidian, then Craft).
3. Optional **AI assist** in the editor (titles, tags, drafting, images).

**There is no long horizon beyond that, and that is a decision.** A free multi-tenant SaaS
at `quireink.com` was fully specified and then abandoned
([ADR 0002](../docs/decisions/0002-no-saas-single-instance.md)); Phase 7 below is kept as
history, not as direction.

## Architecture fit (why the remaining work is additive)

Re-verified against the code after the 2.0 rewrite
([ADR 0005](../docs/decisions/0005-rewrite-in-bun-hono-sqlite.md)). Nothing here is
platform-locked, and the base is smaller than it was:

- **One process.** Bun + Hono, no framework on the reader's path, no database server and no
  sidecar to keep running. A deploy is one compiled binary plus a reverse proxy.
- **Two SQLite files** hold every word, and `bun:sqlite` is synchronous on a single-threaded
  runtime, so there is exactly one writer by construction: no pool, no mutex, no busy-retry.
- **Binaries stay store-relative on the local filesystem** (`collapseBlob` / `expandBlob`), so
  a stored reference is a path resolved against whatever store is configured. That is what
  keeps the Phase 1 storage adapter a driver swap rather than a migration.
- **`sharp` and `satori`** do the image and OG work, both offloaded off the event loop by
  their own libraries.

> **History:** the pre-2.0 tree ran Next.js on Postgres via PostgREST, itself migrated in
> 2026-06 from an `_index.json` + Markdown-on-disk model. Both are gone. What that
> implementation was and why is in [`v1/ARCHITECTURE.md`](../v1/ARCHITECTURE.md).

So what is left below is feature work on a sound base, not a rewrite.

## Decisions locked

- **No lock-in (hard principle).** Portability is a first-class feature, not an
  afterthought. A blog's full state is one portable snapshot — the admin's one-click export
  is both database files plus every upload — and that same archive is the import path on
  every target. Nothing about the storage format is proprietary: it is SQLite and a folder
  of files, readable without this application at all.
- **Storage is pluggable.** Binaries live on the local filesystem today; an S3-
  compatible driver (MinIO / Cloudflare R2 / Backblaze) is planned behind the same
  interface.
- **Note app: Obsidian first** (Markdown-native, real plugin API). Craft is best-
  effort afterward (no comparable plugin API).
- **AI: bring-your-own key**, owner-only, server-side. Text via Claude (Anthropic);
  image generation via a separate provider (fal.ai / Replicate) since Claude does
  not generate images.

## Phases

### Phase 1 — Storage adapter `[shipped — local filesystem]`
`src/lib/blob.ts` is a facade over the binary store:
- **Local filesystem** (single volume, served under `/uploads`) ✅
- **S3-compatible** (MinIO / R2 / B2) — *still planned*; same interface, drop-in driver

Public-URL resolution was the main work: in 2.0 the local driver serves files from
`src/web/uploads.ts`, with range requests and a mime allowlist. Because every stored
reference is store-relative, an S3 driver is a driver swap and not a data migration.

### Phase 2 — Docker `[shipped — self-contained stack]`
- `output: 'standalone'` + `Dockerfile` + `docker-compose.yml` (app + db + rest + cron). ✅
  The image builds with **no backend env** (data layer degrades to empty), so it is
  portable; env is supplied at runtime via `.env.docker`.
- **Self-contained, and much smaller since 2.0:** ONE service, two named volumes, no
  sidecar. The database sidecars this phase was built around (Postgres + PostgREST, their
  generated keys, `POSTGREST_URL`) went away with the rewrite; a container now holds the
  same binary a native install runs. ✅
- Cron: the hourly tick runs in-process. ✅
- *Still planned:* a GitHub Action that builds + publishes a versioned image to GHCR on
  each release tag, so updating is `docker compose pull && up -d`; optional bundled MinIO
  once the S3 driver lands.

One codebase, one CI: the same source drives both the native self-host and the Docker
image — there is no second version to maintain.

### Phase 3 — Token auth + ingest API `[partly done]`
> **Done (2026-06-22, v1.0.0):** token auth + external publishing landed as the **MCP
> server** (`/api/mcp`) — a single full-access `MCP_TOKEN` (+ thin OAuth for connectors)
> lets an agent create/update/delete posts & pages, manage media/files, and read settings,
> all through the same data layer. `add_media_from_url` rehosts an image URL to local storage.

> **Done (2026-07-09, v1.4.0):** **WordPress import** landed as a first-class admin
> feature (Settings → Integrations) — upload a WXR `.xml` export and posts + pages import
> as Markdown (`lib/wordpress-import.ts` + `POST /api/import/wordpress`). No CLI, no creds.

Still planned: a plain HTTP **ingest endpoint** that takes Markdown + frontmatter and maps
it to post fields (for the note-app plugins below), rehosting embedded images.

### Phase 4 — Obsidian, then Craft `[planned, needs Phase 3]`
- **Obsidian plugin**: a command that POSTs the active note (frontmatter + body) and
  its attachments to the ingest API. Quire Ink already stores exactly this format.
- **Craft**: best-effort — Markdown export → paste-import in admin, or pull via the
  Craft API where possible.

### Phase 5 — AI assist `[planned, independent]`
Owner-gated `/api/ai/*` routes; key in env, never client-exposed:
- Text (Claude): suggest title, tags/categories, excerpt; draft / rewrite a selection.
- Image (fal.ai / Replicate): generate, then upload to storage as featured image.

Independent of Phases 1–4 — could be done first as a quick win.

### Phase 6 — Native comments `[shipped]`

> **Done (v1.1.0):** reader comments are live — `comments` table, `features.comments`
> toggle, Turnstile-guarded `POST /api/comments`, SSG-safe client hydration, and the
> `/admin/comments` moderation page. The design below is what shipped.

Reader comments with **no third-party login** (giscus was rejected for exactly this —
it forces a GitHub account). Fully self-hosted in the same SQLite file as the posts,
owner-moderated, spam-guarded by **Cloudflare Turnstile**. A `features.comments` toggle
gates the whole thing (re-added; removed when the giscus spike was dropped).

**Data model** — new `comments` table:
- `id` (uuid), `post_slug` (text, references a post), `author_name` (text, required),
  `author_email` (text, required, **never shown publicly** — used for a Gravatar hash,
  dedup, and optional owner notify), `body` (text, plain/lightly-formatted),
  `status` (`pending` | `approved` | `spam`, default `pending`), `created_at`,
  `ip` + `user_agent` (abuse triage). Optional v2: `parent_id` for threaded replies.
- Index on `(post_slug, status, created_at)`.

**Public flow:**
- Comment form at the end of a post: name + email + body, plus a hidden **honeypot**
  field and the **Turnstile** widget.
- `POST /api/comments` → verify Turnstile (server-side `siteverify`) + honeypot empty +
  per-IP rate-limit → insert as `pending`. Reader sees "awaiting moderation".
- Only `approved` rows render. The article HTML stays **cacheable** because comments are
  not in it: an island fetches `GET /api/comments?post=` after load, and that route is
  refused a shared cache like everything under `/api`, so the thread is always live while
  the page around it is served from cache.

**Moderation (admin):**
- New `/admin/comments` page (force-dynamic): pending + approved lists, newest first,
  filter by status / post. Actions: approve, unapprove, mark spam, delete, with bulk
  select. A pending-count badge in the admin nav.
- Log each action to the activity log (`comment.approve` / `comment.spam` /
  `comment.delete`).

**Spam protection:**
- **Cloudflare Turnstile** (free, privacy-friendly, no puzzle) — env
  `TURNSTILE_SITE_KEY` (public) + `TURNSTILE_SECRET_KEY` (server). Verified before every
  insert.
- Honeypot field + minimum time-on-page + per-IP rate-limit. Optional link/keyword
  heuristics auto-flag obvious spam straight to `spam`.

**Out of scope for v1 (later):** email-notify the owner on a new pending comment
(Resend or similar); threaded replies; reactions.

**i18n:** form labels, validation/awaiting-moderation messages, and the moderation UI
go through `src/locales/` (+ admin) like everything else.

### Phase 7 — Multi-tenant SaaS `[❌ ABANDONED 2026-07-26]`

**Do not propose `tenant_id` again.** This direction was fully specified and then dropped
by [ADR 0002](../docs/decisions/0002-no-saas-single-instance.md): Quire is one instance for
its author, and every line below is written against a data layer (Postgres via PostgREST,
RLS, `service_role`) that no longer exists — 2.0 is one process over two SQLite files.

The plan is kept rather than deleted, for the same reason the superseded ADRs are: knowing
this was seriously worked through, and what it would have cost, is cheaper than re-running
the argument in six months. Everything from here to the end of this phase is **history, not
direction**.

A **free, hosted** Quire Ink at `quireink.com`: same app, run for you. Built
only AFTER Docker ships, so every hosted blog has a guaranteed eject path - hosted is a
convenience, not a trap (see "No lock-in" in Decisions locked). This is the **model-A**
choice: one shared stack, many blogs, isolated by `tenant_id` (true multi-tenant, not
deploy-per-user). It is a large rewrite of the data layer, accepted deliberately.

**Tenancy (the foundation, biggest lift):**
- New `tenants` (id, owner_user_id, subdomain, custom_domain, plan, status) + `users`
  (auth identity, owner of a tenant). Add `tenant_id` to EVERY content table (`posts`
  `pages` `post_revisions` `media` `files` `settings` `mcp_tokens` `backup_state`
  `activity_log` `analytics_*`).
- `settings` drops the hardcoded `id=1` → one row per tenant.
- **Cache tags go per-tenant** (`db:<tenantId>` not the global `db`), or one user's save
  purges everyone's cache.
- **Storage paths get a tenant prefix** (`t/<tenantId>/...`); URLs stay deterministic.
  Easiest part - binary I/O is already centralized.
- **Security:** the app uses `service_role` today (bypasses RLS). Multi-tenant requires
  either per-request clients scoped by JWT claims, or enforcing `tenant_id` in every
  query. This is the most sensitive surface - get it wrong and tenants read each other.

**Auth & routing:**
- Open signup, owner-per-tenant (replaces the single `AUTHORIZED_EMAIL`).
- Wildcard `*.quireink.com`; middleware resolves the tenant from the host. Admin at
  `app.quireink.com`. Custom domains via the reverse proxy + automated SSL.

**Portability backbone (the headline promise):**
- Reuse Backup/Restore as the universal interchange format. **Export** = the tenant's
  slice as a `.tar.gz`; **Import** = restore that snapshot into a fresh native or
  Docker install. Make import a first-class onboarding step on self-host.
- One button to leave, no proprietary state left behind.

**Plans (this is a hobby, never for profit):**
- **Free, for everyone**: 1GB storage AND custom domain - no questions, no upsell games,
  no feature held back. The free tier is the product; the operator's own salary covers
  its running cost. Custom domain is obviously free.
- **Paid, only for heavy/professional users who outgrow 1GB**: buy more storage for
  yourself when you genuinely need it. Priced later, **just enough to cover cost, kept
  super cheap** - it offsets storage, it does not make money.
- **Bring your own bucket (BYOS)**: a tenant can connect their own Cloudflare R2 / S3
  bucket; their binaries live there, on their dime, effectively unlimited and entirely
  outside our quota. This just applies the **Phase 1 storage adapter per-tenant** (the
  same interface that powers self-host). It reinforces no-lock-in - the media sits
  literally in the user's own bucket - and a heavy user need not pay us at all.

**Why "free" stays sustainable:** text in Postgres is tiny (a blog's DB stays well under
1GB); **binaries are the only real cost driver**. With BYOS offloading the heavy media to
users' own buckets and the shared DB staying small, the operator's running cost barely
grows with users - the free tier holds almost indefinitely.

**Cost & abuse guardrails (make-or-break for "free"):**
- Per-blog storage quota + rate limits; reap/flag long-dead free blogs.
- Hosting user content = real liability: ToS, content reporting, a per-tenant kill
  switch, DMCA path. Plan this in, not after.

## Accepted limitations (current design)

- **Single owner, permanently.** One account, no roles, no second author. This is the
  design ([ADR 0002](../docs/decisions/0002-no-saas-single-instance.md)), not a gap waiting
  to be filled, and the SaaS that would have lifted it is abandoned.
- List and taxonomy pages read every post's metadata and paginate in memory. Fine into the
  low thousands of posts on SQLite; past that it wants a real `limit`/`offset`.
- The page cache is flushed **entirely** on any write, so nothing can be stale, but a burst
  of writes re-renders more than it strictly must. That trade is deliberate: see
  [`docs/spec/02-structure.md`](../docs/spec/02-structure.md), and do not reintroduce
  targeted invalidation without a measurement that says it matters.
