# Contributing to Quire Ink

Quire Ink is a single-owner, self-hosted blog engine: one Bun process, two SQLite files, and no
services behind it. That shape is the point, and it is the first thing a change is measured
against. Small, correct, well-scoped changes are the easiest to accept.

Opening a pull request means your contribution ships under the
[PolyForm Noncommercial license](./LICENSE), and that you grant the project owner the right
to relicense it, including under commercial terms. That second half is what keeps a paid
commercial licence possible without having to track down every past contributor; it is
stated here rather than enforced by a CLA bot.

> **Quire 1.x takes nothing.** The Next.js + PostgreSQL implementation was shut down on
> 2026-07-31 and removed from the working tree; it is in git history at tag `v1-final`. It
> receives no changes at all, security fixes included.

## This file is an entry point, not the rulebook

One rule lives in exactly one file, because two copies means one of them is wrong within a
month. So before writing code, read the file that owns what you are touching.

| You are about to | Read |
|---|---|
| Write any code at all | [`CLAUDE.md`](./CLAUDE.md): the house rules, and a debug router that names the files per symptom |
| Change something load-bearing | [`docs/invariants.md`](./docs/invariants.md): seven rules, each with its enforcing code and its guard |
| Touch type, spacing, i18n or a release | [`docs/conventions/`](./docs/conventions/README.md), one file per surface |
| Ask why it is like this | [`docs/decisions/`](./docs/decisions/README.md), append-only, including the reversals |
| Pick something up | The [issue tracker](https://github.com/joiha-steven/quireink/issues). The author's own task list is not in this repository (ADR 0017) |
| Report a vulnerability | [`SECURITY.md`](./SECURITY.md). Privately, and not as a pull request |

## Getting set up

Bun 1.3 or newer, and nothing else: no database server, no container runtime, no
third-party account, no credentials. The four commands are in
[README, run locally](./README.md#-run-locally-dev).

Two more are worth knowing, because the house rule is that you LOOK at what you changed
instead of reasoning about rendered CSS from the source: `bun run shot` takes a screenshot
and `bun run drive` drives headless Chromium through a flow.

## Definition of done

**`bun run check:all` exits 0.** It builds the island bundles and the admin SPA, typechecks
all three projects, runs the seven static guards in `scripts/checks/`, then the test suite. It
touches no network, needs no credentials and starts no services, so there is no excuse for
opening a pull request without it.

Behaviour the suite does not cover gets a test in the same commit. A guard going red is
information rather than an obstacle: each one exists because the mess it catches already
happened here at least once.

**A change under `src/render/` or `src/web/` also faces the golden gate.**
[`src/render/golden.test.ts`](./src/render/golden.test.ts) renders every fixture in
`golden/corpus/` and compares it byte for byte against captured 1.x output. One moved byte
usually means a template is wrong. Re-baselining is sometimes the correct answer, but it is
a decision: say in the commit what moved and why it is allowed to.

## What makes a change easy to accept

- **One thing per pull request.** Two unrelated fixes are two pull requests.
- **Surgical scope.** Do not improve adjacent code, comments or formatting on the way past.
  The one mandatory exception: a behaviour change updates its doc in the SAME commit.
- **Simplicity first.** The minimum code that solves the problem. No speculative
  abstraction, no interface with one implementation, no handling for impossible states.
- **English everywhere except the interface.** Code, comments, identifiers, filenames,
  commit messages and docs are English. UI strings live in `src/i18n/` and move in all six
  languages together.
- **Run it and look at it.** `check:all` proves the code compiles and the seams hold. It
  cannot tell you that a column collapsed or that three headings sit 14px out of line.
- **Never test against production.** A newsletter cannot be unsent.

## Opening the pull request

The [template](./.github/pull_request_template.md) asks what changed, how you verified it,
and four checkboxes. Answer the verification honestly: "ran `check:all`" and "opened every
admin page this touches" are different claims, and both are worth having.

Bug reports and feature requests have their own templates under
[`.github/ISSUE_TEMPLATE/`](./.github/ISSUE_TEMPLATE/bug_report.md).

## Two licenses, kept apart

The **code** in this repository is [PolyForm Noncommercial](./LICENSE): read it, change it,
self-host it, share it, for any noncommercial purpose. Commercial use needs a separate
licence, which is usually cheap or free for the asking. The **writing** published with Quire Ink
belongs to its author, is not covered by the code licence, and is not in this repository.
