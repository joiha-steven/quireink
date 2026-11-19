# 0075 — Relicense to the GNU AGPL v3.0 only

Date: 2026-11-19
Status: accepted · supersedes [0015](0015-relicense-polyform-noncommercial.md), [0023](0023-commercial-use-of-unmodified-releases.md), [0038](0038-the-permission-reaches-the-install-people-actually-run.md) (its licence half) and [0050](0050-the-licence-opens-by-itself-after-48-months-without-a-release.md) for every release after v2.2.22
In force: see the [index](README.md). The index is maintained; this file is not.

## Context

Since [0015](0015-relicense-polyform-noncommercial.md) the code has been PolyForm Noncommercial
1.0.0 plus an additional permission (`LICENSE-EXCEPTION.md`, last at version 1.2): anyone may run
a release, including for money, and nobody may sell a changed copy without a separate licence.
[0050](0050-the-licence-opens-by-itself-after-48-months-without-a-release.md) then added a grant
that turns the code into Apache 2.0 after 48 months without a release, so the project would not
freeze when its author stops.

Three things changed the weighing.

- **There is no business left to protect.** The strategy review of 2026-09-10 dropped pricing and
  the hosted service: the project is worked on because its author wants to, and it should outlive
  them. The line 0015 drew existed to keep a paid commercial licence possible.
- **What the project lacks is reach, not features.** "Source-available, not open source" is a
  sentence a directory, a package index or a would-be contributor reads as a reason to look
  elsewhere. An OSI licence removes it.
- **The licence had grown three layers to say one thing.** A base licence, an exception with six
  sections in two languages, and a delayed grant, each with an ADR — and a `generator` meta in
  `src/web/layout.ts` whose stated job was enforcing §2(c).

0015 already weighed AGPL seriously and set it aside on one ground only: it permits a changed copy
to be sold. It also recorded the dependency check — nothing in the tree is incompatible — and
said AGPL "remains available with no dependency work". The owner decided on 2026-11-19 that a
changed copy being sold is acceptable, provided the changes come back as source.

## Decision

**Every release after v2.2.22 is licensed under the GNU Affero General Public License, version 3
only** (`AGPL-3.0-only`). `LICENSE` holds the text exactly as published at
<https://www.gnu.org/licenses/agpl-3.0.txt>. `LICENSE-EXCEPTION.md` and its Vietnamese translation
leave the tree; they stay readable at tag `v2.2.22` and earlier.

- **AGPL, not GPL.** Quire Ink is a server. The GPL asks for source only when a copy is
  *distributed*; a company that changes it and runs it as a hosted service distributes nothing and
  owes nothing. AGPL §13 closes that: whoever runs a modified version for users over a network
  must offer those users its source.
- **Version 3 only, not "or later".** "Or later" lets a licence nobody has read yet apply to this
  code. Adding "or later" afterwards is possible; taking it back is not.
- **Contributions.** `CONTRIBUTING.md` keeps its grant that the owner may relicense a
  contribution. The only outside contribution so far (#74, README prose) was made under that
  grant.

## What does not change

- **A licence change does not reach backwards.** Everything up to and including v2.0.0 stays MIT.
  Later releases up to v2.2.22 stay under PolyForm Noncommercial plus the additional permission they shipped
  with, including that permission's §6 grant, exactly as written. Anyone may also take the same
  code from the first AGPL release instead.
- **The `generator` meta stays.** It costs nothing, it is how WordPress, Ghost and Hugo name
  themselves, and it now serves AGPL §13 the other way round: a reader of a Quire Ink site can find
  where the source lives. It is no longer a licence condition.
- **The writing is not the code.** Posts, pages and uploads belong to their author and are not
  covered by this licence.

## Consequences

- Quire Ink is open source by the OSI definition again. The README badge, the Docker image label
  (`org.opencontainers.image.licenses`), `package.json` and the Docker Hub overview say so.
- Anyone may sell a modified Quire Ink, including as a hosted service, and must offer its users
  the modified source. The project's advantage becomes being upstream, which
  [0023](0023-commercial-use-of-unmodified-releases.md) already named as the likely outcome.
- A future commercial exception (for example, for someone who wants to ship a closed fork) is
  still possible, because of the contributor grant above. Nothing is offered today.
- The 48-month clause is no longer needed for new releases: under AGPL anyone may fork and keep
  going on the day the author stops.
- The version number of the first AGPL release is the owner's call
  ([releases](../conventions/releases.md)); this ADR does not cut one.
