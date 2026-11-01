# Quire Ink

Public, source-available blog platform (PolyForm Noncommercial, [ADR 0015](./docs/decisions/0015-relicense-polyform-noncommercial.md);
unmodified releases may be run commercially, [ADR 0023](./docs/decisions/0023-commercial-use-of-unmodified-releases.md); it opens by itself after 48 months without a release, [ADR 0050](./docs/decisions/0050-the-licence-opens-by-itself-after-48-months-without-a-release.md)).
One **Bun + Hono + SQLite** process; `src/` at the repository root serves the live site.

**Zero personal data in this repo.** No IP, user, port or host, ever: they live in the private
sibling with the worklog, the tasks and the audits; credentials only in the gitignored `.env`.
But before proposing `docs/`, `scripts/` or `golden/` for that sibling, the second test:
**if it vanished, could a stranger still install this and verify what they installed?** If no
it is the PRODUCT and stays — the private deploy script ships `scripts/` and the tests read `golden/`.


## Verify

```
bun run check:all   # typecheck, all static guards, bun test; ~2 min (src/md, src/render, src/web also run the golden compare)
bun run tour        # every flow in a real browser + restore-check; seeds its own instance on port 3399, refuses to start if taken
```

Run **both** for anything rendered: `check:all` cannot see a collapsed column or 14px misalignment, and CI runs
the tour on every push. Flows: [`scripts/tour-flows.ts`](./scripts/tour-flows.ts), plumbing: [`scripts/tour.ts`](./scripts/tour.ts).
One page, looked at: [`scripts/drive.ts`](./scripts/drive.ts), [`scripts/shot.ts`](./scripts/shot.ts). Verify against the **origin**,
never through the CDN. An install: `scripts/ops/matrix.sh <cell>` (ADR 0065).

## Read first

| Doing | Read |
|---|---|
| Anything at all | [`docs/invariants.md`](./docs/invariants.md) — the 7 load-bearing rules |
| Understanding how a part fits | [`docs/README.md`](./docs/README.md) — the index of everything below |
| Touching fonts, CSS, images or island JS | [`docs/performance.md`](./docs/performance.md) — the resource-loading law |
| Touching the cache, the CDN purge or compression | [`docs/delivery.md`](./docs/delivery.md) |
| Adding or changing an appearance setting | [`docs/appearance.md`](./docs/appearance.md) — the OWNER's map of every knob and the list of what cannot be changed; the CSS variables, classes and attributes custom CSS and themes may target are in [`docs/appearance-contract.md`](./docs/appearance-contract.md). It is a promise to users: update it in the same commit |
| Touching a public view | [`docs/conventions/`](./docs/conventions/README.md) — type · layout · colour · motion · admin: [`docs/admin-design.md`](./docs/admin-design.md), the editor: [`docs/admin-editor.md`](./docs/admin-editor.md), and moving between screens: [`docs/admin-navigation.md`](./docs/admin-navigation.md) |
| Touching the schema | [`docs/spec/01-schema.md`](./docs/spec/01-schema.md) · [`src/store/schema.sql`](./src/store/schema.sql) |
| Wondering whether 1.x did it differently | [`docs/spec/07-parity-public.md`](./docs/spec/07-parity-public.md) · [owner-facing half](./docs/spec/07-parity-admin.md) |
| Cutting a release, or touching the image | [`docs/conventions/releases.md`](./docs/conventions/releases.md) — the version is the owner's call, and a tag publishes the Docker image by itself |
| Going against a past decision | [`docs/decisions/`](./docs/decisions/README.md) — read the in-force index first |
| Picking up work, or logging it | the private sibling repo ([ADR 0017](./docs/decisions/0017-move-state-and-instance-config-private.md)) |

**Do not read `CHANGELOG.md` while coding.** It is append-only at release time and its
history is never needed to fix or understand code.

## Hard rules — each one is a bug that already shipped

- **NEVER quote the owner** — not in code, comments, docs, ADRs, tests or commit messages.
  State the fact or the measurement. Vietnamese in the tree is only ever a UI string, a test
  fixture or seed content.
- **No `any`** — use `unknown` and narrow. Acceptable only at a JSON boundary that
  immediately validates into a typed shape.
- **No VALUE is ever interpolated into SQL.** Values are bound, always. Only a fixed
  IDENTIFIER from a module constant or a closed set may be — a column list (`META_COLS`), the
  `liveOnly()` predicate, a table name, the analytics facet
  ([`docs/spec/01-schema-port.md`](./docs/spec/01-schema-port.md) §3). A handful of such sites, none reads a
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

- **Never regenerate `golden/v1/corpus/`** (the golden compare's contract, read by `src/render/golden.test.ts`).
  When output changes on purpose, name the fixture in `DIVERGED` in that test and capture the new answer under `golden/v2/corpus/`.
- **Do not reintroduce the retired Next.js tree** (tag `v1-final`, ADR 0019), and do not point a doc at a `v1/` path.
- **Production is not a test environment.** A newsletter cannot be unsent.
- **All scratch goes under `.tmp/`** — one gitignored root, never a new one at the root.

Find a file: [`MAP.md`](./MAP.md). Why a rule exists: [`HISTORY.md`](./HISTORY.md).
