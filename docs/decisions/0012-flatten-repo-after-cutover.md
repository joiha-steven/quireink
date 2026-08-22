# 0012. Flatten the repository after cutover: 2.0 to the root, the Next tree to `v1/`

Date: 2026-07-28 · Status: **in force**

## Context

Quire 2.0 took over `manhhung.me` earlier the same day. Until then the repository was
shaped for a rewrite in progress: the Next.js implementation at the root, the new one in
`v2/`, and everything shared between them — `state/`, `docs/decisions/` — at the root
alongside the old code.

That shape was correct while the old tree was the product and the new one was a project.
After cutover it inverts every default. `src/` meant the implementation nobody was allowed
to change. `package.json` was the one that could not be installed on the box that runs the
site. The deploy path started with `cd v2`. `CLAUDE.md` opened by describing a frozen tree
and had to send the reader elsewhere before saying anything useful, and it loads on every
turn.

The cost of leaving it is not aesthetic. Every agent and every human starts at the root, and
the root described the wrong program.

## Decision

The live implementation lives at the repository root. The frozen one moves to `v1/`, whole
and self-contained: its own `src/`, `public/`, `scripts/`, `deploy/`, `docker/`,
`package.json`, `tsconfig.json`, `README.md`, `CLAUDE.md`, and the documentation that
describes *its* implementation specifically (`data-layer`, `self-host-native`,
`invariants`, `backups`).

Four homes ([0010](0010-four-homes-doc-layout.md)) are unchanged, and now apply to 2.0:

| Path | Holds |
|---|---|
| `src/`, `scripts/`, `golden/` | Code only |
| `docs/` | Durable truth about the RUNNING system, kept current |
| `docs/spec/` | The 2.0 build plan, formerly `v2/docs/` |
| `docs/decisions/` | Intent: ADRs, append-only, with a still-in-force index |
| `state/` | Where things stand NOW |
| `v1/` | The frozen implementation, entire |
| `attic/` | Plans abandoned before anything shipped (`go/`) |

`v1/` and `attic/` are distinguished deliberately: `v1/` is frozen but **still running**,
and `attic/` never ran at all. Filing the Go plan under `v1/` would suggest it was once the
product.

Documents whose RULES survived the port — typography, the resource-loading law, features,
SEO, MCP, agent discovery — **stay in `docs/`** even though they cite Next file paths. The
rule is current; only the citation is stale. Moving them into `v1/` would file live rules
under an archive, which is the worse of the two errors. `docs/README.md` says which files
this applies to, and refreshing them is tracked in `state/TASKS.md`.

## Consequences

- **The deploy path changes.** It is now `tar` from the repository root, not from `v2/`.
  Nothing on the server moved.
- `scripts/checks/docs.mjs` was ported to `scripts/checks/docs.ts` and wired into
  `bun run check:all`. It was left behind in the frozen tree and had not run since the
  rewrite began, which is why `state/WORKLOG.md` had drifted past its size cap unnoticed.
  It caught **56 broken links** the move created, and that is the entire argument for
  holding a layout with a check rather than with prose.
- `golden/capture-corpus.ts` imports the frozen renderer across the tree boundary and now
  points at `../v1/src`. It runs from `v1/`, because the component's own `@/lib/...`
  specifiers resolve through v1's `tsconfig.json`, not the root one.
- CI (`.github/workflows/ci.yml`) still runs `npm ci` at the root and is now wrong. It
  could not be fixed in the same change: the credential in use lacks the `workflow` scope,
  so a push that touches that file is rejected outright. Flagged in `state/TASKS.md` for a
  human to apply.
- `v1/`'s history is preserved: every file moved with `git mv`, and `v1/README.md` is the
  old root README with a banner, not a rewrite.

## Amendment, 2026-07-29

`attic/` is gone. The owner asked for the Go plan to be removed the day after it was
filed there, and the argument for keeping it did not survive contact with the question
"what would anyone read this for?" — [0004](0004-rewrite-in-go-on-sqlite.md) and
[0005](0005-rewrite-in-bun-hono-sqlite.md) already carry the decision, the reversal and
the salvage record, which is the part that stops the argument being re-run. The specs
themselves were superseded by `docs/spec/` and describe a program nobody will ever build.
