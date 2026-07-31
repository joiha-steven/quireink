# 0017 — Move `state/` and instance config to a private repository

Date: 2026-08-01
Status: accepted

## Context

[ADR 0010](0010-four-homes-doc-layout.md) gave the documentation four homes: code, `docs/`
for current rules, `docs/decisions/` for why, and `state/` for intent and for anything dated.
That layout was designed when this repository was one person's blog and nobody else read it.

Since then it became a product. It is public, it is source-available under
[PolyForm Noncommercial](0015-relicense-polyform-noncommercial.md), it has a demo instance,
a self-hosting guide and a Vietnamese README, and it is written throughout for a stranger who
wants to run it. Under that reading, `state/` is not one of four homes. It is a record of one
person building **one installation**:

- `WORKLOG.md` and `TASKS.md` name that installation on nearly every page: its domain, its
  box, its service name, its data directory, which of two servers it moved between.
- `audits/` describes how that installation is configured and what was wrong with it on five
  separate dates. None of it is a credential, and none of it was a leak. It is simply somebody
  else's server, published to everyone who reads the repository, for no benefit to them.
- `ROADMAP.md` and `OPEN_QUESTIONS.md` are the author's intentions for his own blog, not a
  commitment to anybody running the software.

The same argument had already been made about ops, one file at a time and without a rule
behind it. `scripts/ops/quire2-backup.sh` says in its own header that it takes its paths and
its bucket from environment variables *because the file is in a public repository* — and then
two vhosts sat next to it naming a domain, a certificate path and an internal port. The
deploy script had been carried out of the repository entirely, to a scratch directory in no
repository at all, where it stopped working and nobody could tell.

So the boundary already existed. It was just being applied by hand, per file, and losing.

## Decision

**The public repository holds the product. Instance facts move to
`joiha-steven/quireink-private`.**

Moved out:

| | |
|---|---|
| `state/` | entire: roadmap, tasks, open questions, worklog, audits, reports |
| `scripts/ops/nginx-manhhung.me.conf`, `nginx-old.manhhung.me.conf` | one installation's vhosts |

Joining them there, from outside any repository: `deploy.sh`, and the demo preview layer that
had been a second private repository of its own.

Staying:

- **`docs/decisions/`.** An ADR is why the software is the way it is; a reader of the code
  needs it more than the author does.
- **`CHANGELOG.md`** and everything in `docs/`.
- **`scripts/ops/quire2-backup.sh`.** It is a *reference* backup script, already written so
  that every installation-specific value is an environment variable. This ADR finishes that
  job: the two Slack alert strings that still hardcoded a service and a box name now read
  `$ALERT_ALIAS` like the rest.
- **`v1/`.** Removing it was considered and rejected. Its only cost was code-scanning noise,
  which was already triaged and closed on 2026-07-31, and it is cited by `SECURITY.md`,
  `bunfig.toml`, `.dockerignore`, [ADR 0012](0012-flatten-repo-after-cutover.md) and both
  READMEs. Deleting it would break more than it cleans.

## What it costs

**The four homes are now three, here.** ADRs 0010, 0012 and 0016 refer to `state/` and are
append-only, so they are left exactly as written and this ADR is the correction. `docs/` is
still current-truth-only and `docs/decisions/` is still append-only; those rules did not
change, they just stopped having a fourth sibling in this repository.

**Two rules lost their enforcement.** `check:docs` policed `state/audits/` and
`state/reports/` as write-only and `state/worklog/` as append-only. Those directories are no
longer here to police, so the check drops both clauses and `state/` from its roots. The rules
still hold where the files now live, and they now hold by habit rather than by a red check.
That is a real loss and is recorded here rather than pretended away.

**Nothing is retracted.** `state/` was public from the first commit until today. The history
is not rewritten: nothing in it is a secret, rewriting does not unpublish a public repository
that has been cloned and cached, and the last history rewrite here invalidated every commit
SHA cited in the docs. Removing it going forward is the whole of the remedy, and it is
proportionate to what it is: somebody's server notes, in the wrong repository.

**One less place to look, one more place to forget.** A contributor reading this repository
can no longer see what is planned or what is queued. `CONTRIBUTING.md` used to point at
`state/TASKS.md` for something to pick up and now points at the issue tracker, which is where
an outside contributor was always going to look first.
