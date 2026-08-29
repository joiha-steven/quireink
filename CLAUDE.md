# Quire Ink

Public, source-available blog platform (PolyForm Noncommercial, [ADR 0015](./docs/decisions/0015-relicense-polyform-noncommercial.md);
unmodified releases may be run commercially, [ADR 0023](./docs/decisions/0023-commercial-use-of-unmodified-releases.md)).
One **Bun + Hono + SQLite** process; `src/` at the repository root serves the live site.

**Zero personal data in this repo.** No IP, user, port or host, ever: they live in the private
sibling with the worklog, the tasks and the audits; credentials only in the gitignored `.env`.
But before proposing `docs/`, `scripts/` or `golden/` for that sibling, the second test:
**if it vanished, could a stranger still install this and verify what they installed?** If no
it is the PRODUCT and stays — `deploy.sh` ships `scripts/` and the tests read `golden/`.

## Verify

```
bun run check:all
```

Typecheck, the eight static guards (`filesize` · `css` · `nul` · `routes` · `type` ·
`admin-kit` · `bundle` · `docs`) and `bun test`. About 2 minutes. A change under `src/render` or
`src/web` also runs the golden compare.

`check:all` proves the code compiles and the seams hold. It cannot tell you a column
collapsed to `reader@e…` or that three columns are 14px out of alignment. Both shipped,
because nobody opened the page.

```
bun run tour
```

Sixty-one flows in a real browser, each with a verdict: the reader's controls, every admin
page, a draft saved and published and trashed and restored, an upload refused for being too
large, the archive built. It seeds its own instance on **port 3399** and deletes it after, so it
never touches a real one — and it refuses to start if something already holds that port, because
a tour on a busy port silently tours the other instance and fails every admin flow on a session
that database never issued. `PORT=` moves it. Flows live in [`scripts/tour-flows.ts`](./scripts/tour-flows.ts);
the browser plumbing is [`scripts/tour.ts`](./scripts/tour.ts).

It then runs [`scripts/restore-check.ts`](./scripts/restore-check.ts), because a browser
cannot untar an archive or open a SQLite file. The tour proves the backup BUILDS; this opens
it — `integrity_check` on both databases, no table with fewer rows than before the snapshot,
every upload byte-identical. A backup nobody has restored is not a backup.

For one page, looked at rather than asserted: [`scripts/drive.ts`](./scripts/drive.ts) and
[`scripts/shot.ts`](./scripts/shot.ts). Verify against the **origin**, never through the CDN.

## Read first

| Doing | Read |
|---|---|
| Anything at all | [`docs/invariants.md`](./docs/invariants.md) — the 7 load-bearing rules |
| Understanding how a part fits | [`docs/README.md`](./docs/README.md) — the index of everything below |
| Touching fonts, CSS, images or island JS | [`docs/performance.md`](./docs/performance.md) — the resource-loading law |
| Touching the cache, the CDN purge or compression | [`docs/delivery.md`](./docs/delivery.md) |
| Adding or changing an appearance setting | [`docs/appearance.md`](./docs/appearance.md) — the OWNER's map of every knob, the CSS variables custom CSS may target, and the list of what cannot be changed. It is a promise to users: update it in the same commit |
| Touching a public view | [`docs/conventions/`](./docs/conventions/README.md) — type · layout · colour · motion · admin: [`docs/admin-design.md`](./docs/admin-design.md), the editor: [`docs/admin-editor.md`](./docs/admin-editor.md), and moving between screens: [`docs/admin-navigation.md`](./docs/admin-navigation.md) |
| Touching the schema | [`docs/spec/01-schema.md`](./docs/spec/01-schema.md) · [`src/store/schema.sql`](./src/store/schema.sql) |
| Wondering whether 1.x did it differently | [`docs/spec/07-parity-public.md`](./docs/spec/07-parity-public.md) · [owner-facing half](./docs/spec/07-parity-admin.md) |
| Cutting a release, or touching the image | [`docs/conventions/releases.md`](./docs/conventions/releases.md) — the version is the owner's call, and a tag publishes the Docker image by itself |
| Going against a past decision | [`docs/decisions/`](./docs/decisions/README.md) — read the in-force index first |
| Picking up work, or logging it | the private sibling repo ([ADR 0017](./docs/decisions/0017-move-state-and-instance-config-private.md)) |

**Do not read `CHANGELOG.md` while coding.** It is append-only at release time and its
history is never needed to fix or understand code.

## Debug router — a symptom, and the files to open first

| Symptom / area | Read these first |
|---|---|
| Routing, middleware, what a request does | `src/web/app.ts`, `src/web/guard.ts`, `src/web/cache-headers.ts` |
| Cache, or content not updating | `src/server/cache.ts` (in-process), `src/web/cache-headers.ts` (shared), `src/server/edge-cache.ts` |
| A page's HTML | `src/web/{layout,chrome,article,listing}.ts`, `src/web/*.css.ts` |
| Markdown → HTML, highlighting, footnotes | `src/render/` |
| Island JS: search, theme, comments, subscribe, book mode | `src/assets/js/` |
| Admin SPA, editor | `src/admin/`, `src/web/admin/` |
| Sign-in, TOTP, sessions, recovery codes | `src/auth/`, `src/web/auth-routes.ts` |
| Posts, pages, slugs, series, revisions, settings | `src/content/` |
| Uploads, image variants, ranges | `src/media/` |
| Newsletter, broadcast, SMTP | `src/news/` |
| Comments · Analytics | `src/comments/` · `src/analytics/` (writes go through `buffer.ts`) |
| SQL, migrations, the live/trashed predicate | `src/store/` |
| Scheduled publishing, redirects, rate limit, activity | `src/server/` |
| MCP server, tokens | `src/mcp/`, `src/web/admin/mcp-transport.ts`, `src/web/admin/mcp.ts` |
| UI strings, translations | `src/i18n/`, `locales/` (repo root, so translators can find it) |
| Imports (WordPress/Ghost/…), image rescue | `src/import/`, `src/web/admin/ops.ts` |

## Hard rules — each one is a bug that already shipped

- **NEVER quote the owner** — not in code, comments, docs, ADRs, tests or commit messages.
  State the fact or the measurement. Vietnamese in the tree is only ever a UI string, a test
  fixture or seed content.
- **No `any`** — use `unknown` and narrow. Acceptable only at a JSON boundary that
  immediately validates into a typed shape.
- **No VALUE is ever interpolated into SQL.** Values are bound, always. Only a fixed
  IDENTIFIER from a module constant or a closed set may be — a column list (`META_COLS`), the
  `liveOnly()` predicate, a table name, the analytics facet
  ([`docs/spec/01-schema.md`](./docs/spec/01-schema.md) §3). Sixteen such sites, none reads a
  request.
- **Every write route is mounted on the owner-gated router group**, not checked inside the
  handler ([invariant 4](./docs/invariants.md)).
- **Every handler** times and logs its request, catches errors, and returns a typed error.
- **Secrets never reach a client-bound payload**: `users.password_hash`, `users.totp_secret`,
  `recovery_codes`, `integration_keys`, `mcp_tokens`.
- **Public UI colours come ONLY from theme tokens.** Never a hardcoded `neutral-*`, `white`,
  `black` or hex. ONE typeface, no hardcoded sizes, one divider style, never ALL-CAPS.
- **UI strings live in `locales/` only** (repo root), every language in sync — the compiler enforces the keys; `locales/langs.ts` is the list.

## Danger zones

- **`golden/v1/corpus/` is the golden compare's contract**, read by `src/render/golden.test.ts`
  on every run. **Never regenerate it:** those files are what 1.x actually printed, from a
  renderer that no longer exists, so overwriting them does not update the reference — it
  destroys it, and the gate then reports parity against our own output. When output changes on
  purpose, name the fixture in `DIVERGED` in that test and capture the new answer under
  `golden/v2/corpus/`; the other 42 keep the original contract.
- **The retired Next.js implementation is gone from the tree** ([ADR 0019](./docs/decisions/0019-remove-the-frozen-tree-from-the-working-copy.md)),
  preserved at tag `v1-final`. Do not reintroduce it, and do not "fix" a doc by pointing at
  a `v1/` path.
- **Production is not a test environment.** A newsletter cannot be unsent.
- **All scratch goes under `.tmp/`** — one gitignored root, never a new one at the root.
