# 0050 — The licence opens by itself after 48 months without a release

Date: 2026-09-10
Status: accepted
Amends: [0023](0023-commercial-use-of-unmodified-releases.md) and [0038](0038-the-permission-reaches-the-install-people-actually-run.md), whose grant is unchanged. This adds a clause about what happens when the grant's author stops.

## Context

The project is built to outlast its author: one process, two SQLite files, a documented
export, and a README that tells a self-hoster their archive is theirs. The licence did not
keep that promise. PolyForm Noncommercial plus the additional permission allow anyone to run
a published release, freely or for money, and forbid earning from a changed copy without a
separate licence (0023 §3). The only person who can grant that separate licence is the
licensor. If the licensor stops answering — stops releasing, stops reading issues — the last
release is the last version anyone may lawfully improve and offer as a service. A blog engine
whose users were told to trust it with ten years of writing would freeze at the exact moment
its author was no longer there to unfreeze it.

The question was settled on 2026-09-10 in the strategy review that also settled what the
project is for: it is worked on because its author wants to, and it should have a future that
does not depend on them. The grant during the author's active years stays as it is; the
protection it gives — no one takes the code, changes it and sells it as their own — is the
one line the project has held since 0015. What was missing was the day that line stops
mattering because there is nobody left to hold it.

## Decision

Section 6 of `LICENSE-EXCEPTION.md` (version 1.2) grants, today, a licence that takes effect
on its own the day after **48 months pass without a release**. A release is a version tag on
this repository, or a package or image published from it by the licensor. On that day the
software as it then stands — the last release and the default branch — is also licensed under
the **Apache License 2.0**, alongside the two existing texts.

Three details carry the intent:

- **It is a present grant with a delayed effect**, not a promise to relicense later. A
  promise needs somebody to keep it; a present grant needs nobody. The clause says so.
- **Any release resets the count.** Forty-eight months is long enough that an author who is
  merely busy is never caught by it, and short enough that a user who wonders whether the
  project is alive gets an answer within their own planning horizon.
- **Apache 2.0, not MIT.** Both keep the copyright notice. Apache also requires that a
  changed file carry a notice saying it was changed (§4(b)) and grants patent rights
  explicitly. The first is what the additional permission has asked for all along in
  §2(c) and §2(d), carried past the day the permission itself stops binding.

The window is 48 months. A shorter one was considered and rejected: the project has gone
quiet for months before and come back, and a clause that could fire during an ordinary
pause would be an accident waiting to happen.

## Consequences

- `LICENSE-EXCEPTION.md` and `LICENSE-EXCEPTION.vi.md` go to version 1.2 with a new §6; the
  README licence sections in both languages gain one paragraph. Nothing else changes: the
  licence a self-hoster reads today asks the same four things it asked yesterday.
- **Version 1.2 binds going forward**, as 0038 established for 1.1: it applies from the
  release that carries it. A copy taken under 1.1 keeps 1.1.
- The clause is a reason a directory listing or a package index can accept a source-available
  project it would otherwise flag as one that could disappear: the source cannot disappear
  into a dead licence.
- The obligation this creates for the author is the smallest one possible: **keep releasing**,
  and the clock never runs. It is also the one signal this project has always used to say it
  is alive ([0036](0036-the-blog-asks-for-updates-and-is-counted-by-asking.md)).
