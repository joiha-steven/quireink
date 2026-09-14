# 0010. Adopt the four-homes documentation layout

Date: 2026-07-27
Status: accepted
In force: see the [index](README.md). The index is maintained; this file is not.

## Context

43 markdown files with no rule about where anything goes. Specifically: dated snapshots
sitting in `docs/` next to living rules, an `audit/` directory at the repository root,
`ROADMAP.md` (a statement of where things stand) filed as durable truth, a 275-line
`CLAUDE.md` restating rules that also exist elsewhere, and **no decision record at all** —
which is how [0002](0002-no-saas-single-instance.md) came to reverse a fully-specified
direction with no trace in the repository.

The owner has a standard for this, distilled from another project, and asked for it here.

## Decision

Four homes, and everything has exactly one.

| Path | Holds |
|---|---|
| `src/`, `v2/` | Code only |
| `docs/` | Durable truth, kept CURRENT. Out of date here is a bug, fixed in place |
| `docs/decisions/` | Intent: ADRs, append-only, with a still-in-force index |
| `state/` | Where things stand NOW: `ROADMAP`, `TASKS`, `OPEN_QUESTIONS`, `WORKLOG` |
| `state/audits/`, `state/reports/` | Point-in-time. **Write-only**, never retro-edited |

`CLAUDE.md` becomes a router that restates nothing, capped at 170 lines because it loads
every turn.

## Consequences

- `scripts/checks/docs.mjs` holds the layout: broken relative links, ADR index agreement in
  both directions, the `CLAUDE.md` cap, no dated filenames in `docs/`, and a 700-line file
  cap. Prose rots, a red test does not.
- The write-only directories are exempt from link checking, because checking them would
  force exactly the retro-editing the rule forbids.
- Splitting `docs/features.md` (606 lines, ~20 modules) into one spec per module is the
  remaining gap. Deliberately deferred: it is a mechanical split with real risk of dropping
  content and deserves its own pass. Tracked in `state/TASKS.md`.
