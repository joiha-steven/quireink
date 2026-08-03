# 0019. Remove the frozen 1.x tree from the working copy

**Date:** 2026-08-03 · **Status:** accepted · **Supersedes:** the `v1/` bullet of
[ADR 0017](0017-move-state-and-instance-config-private.md)

## Context

[ADR 0017](0017-move-state-and-instance-config-private.md) considered deleting `v1/` and
rejected it: "its only cost was code-scanning noise, which was already triaged and closed,
and it is cited by `SECURITY.md`, `bunfig.toml`, `.dockerignore`, ADR 0012 and both READMEs.
Deleting it would break more than it cleans."

That weighed the wrong cost. The real one, measured on 2026-08-03:

- **438 tracked files, against 434 in `src/`.** Every glob, every grep and every directory
  listing an agent runs covers twice the ground it needs to. That is paid on every session,
  forever, and it is the dominant cost of the tree, not the code scanner.
- **495 MB on disk** (2 MB tracked, the rest a `node_modules` and a `.next` nobody runs).
- **Two guards carry a special case for it**: `scripts/checks/docs.ts` exempts it from link
  checking through a `frozen()` predicate and lists it in `ROOTS`, and `bunfig.toml` roots
  the test runner at `src` only because ~100 vitest files under `v1/` throw under Bun.
- **Twenty live documents carry a caveat about it**, most of them a variant of "this path
  means `v1/src/…` unless it says otherwise". A reader pays for that sentence every time.

Against that, the benefit was that the old behaviour stays readable. Git history already
gives that, at zero cost to the working tree.

## Decision

`v1/` is removed from the working copy. It is preserved at the annotated tag **`v1-final`**,
which points at the last commit that contained it, and a zip of the tracked tree is kept
outside the repository. Read it with `git show v1-final:v1/<path>` or
`git checkout v1-final -- v1/` in a scratch clone.

Removed with it, because nothing else drove them:

| Removed | Why it existed |
|---|---|
| `scripts/import-v1.ts`, `scripts/import/source.ts` | The one-shot PostgREST importer from the live 1.x instance |
| `src/import/{checksum,transform,verify,write}.ts` and two tests, 972 lines | Reachable only from that importer. `src/import/wordpress.ts` is unrelated and stays: it is the admin's WordPress import |
| `@supabase/postgrest-js` | The importer's only consumer |
| `docs/spec/05-importer.md` | Describes a migration that has happened and cannot happen again |
| `scripts/port/` ledgers | The port finished at the 2026-07-28 cutover |

`golden/v1/corpus/` is **not** part of this and must not be deleted. Despite the name it is
not the frozen tree: it is captured reference HTML, it is the golden compare's contract, and
`src/render/golden.test.ts` reads it on every run.

## What it costs

The one-time sweep ADR 0017 was avoiding: twenty documents edited, two guards simplified,
`bunfig.toml` and both ignore files rewritten. It was an afternoon, once, against a cost
that was being paid on every session.

Anyone wanting to read 1.x now needs a git command rather than a file path. That is the
whole trade, and it is the right way round: the people who need it are rare, and the agents
that pay for it are every session.
