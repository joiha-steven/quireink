# 0038 — The commercial permission reaches the install people actually run, and the credit has somewhere to point

Date: 2026-08-29
Status: accepted
Amends: [0023](0023-commercial-use-of-unmodified-releases.md), whose grant is unchanged. This
corrects two places where its TEXT did not reach the software it was written about.

## Context

The intent has not moved since 0023: running the software, freely or to earn from it, is
permitted; altering the source and earning from the altered copy is not. Reading the exception
against the running software found two gaps, and neither of them is about that line.

**1. The permission did not cover the install this project documents.** §2(a) required that
what you run is *"a release published by the licensor"*. Every from-source path puts you on
the default branch instead: `README.md` and `docs/self-host.md` both say `git clone`, and
`install.sh` does `git clone --depth 1` and upgrades with `git pull --ff-only`. No tag is
checked out anywhere. So somebody following the official install guide and monetising their
blog was, on the text, outside the permission and back under plain PolyForm Noncommercial —
which forbids commercial use entirely. The Docker path was fine, because `:latest` is the
newest release and `README.md` says so. Two documented install paths, two different licences,
and nothing said which was which.

**2. Nothing in the software carried the name the licence asks be kept.** §2(c) asks that
*"wherever the software displays its own name and version, that stays visible"*. Measured on
the live demo: no `<meta name="generator">`, and the only public mention of Quire Ink was the
footer — which is a SETTING, and §2(a) says in as many words that anything set through the
admin is not a change to the source. A licensee could therefore delete every trace of Quire
Ink from their pages **without modifying a line of code** and remain inside the permission.
That is precisely the outcome §2(c) and §2(d) exist to prevent, and the condition had nothing
to bite on.

## Decision

**§2(a) turns on UNCHANGED, not on TAGGED.** It now reads "code published by the licensor — a
release, or this repository's default branch — with its source unchanged". The condition that
carries the owner's intent was always "unchanged"; requiring a version number as well was an
accident of drafting that excluded most real deployments. Version 1.1 of the exception.

**§2(d) accepts either <https://quireink.com> or the repository.** The product has a home page
now; a reader who follows a credit link wants to know what Quire Ink is, and that is the page
that answers.

**And the software names itself where no setting can reach.** `<meta name="generator" content="Quire Ink ‹version›">`
on every public page, emitted from `layout.ts` and pinned by a test in `app.test.ts`. The
default footer's credit points at `quireink.com` rather than at the repository, for the same
reason as §2(d).

## Consequences

- **The grant is not widened.** Commercial use of a modified copy still needs a separate
  licence ([0023](0023-commercial-use-of-unmodified-releases.md) §3, untouched). This lets in
  the person who was always meant to be in and could not get through the door.
- **The generator meta is not a lock, and is not meant to be.** Anyone who modifies the source
  can delete it — and deleting it is then a source change, which is exactly the line the
  licence draws. What it buys is that the line is now *checkable from outside* rather than
  only asserted: one request tells you whether a site running this software has removed the
  attribution.
- **It costs a reader nothing.** One meta element, no request, invisible on the page.
  WordPress, Ghost and Hugo all emit the same tag.
- **Version 1.1 binds going forward.** §5 is unchanged: the permission applies from the
  release that carries it, and earlier copies keep the terms they were given under.
- **Both language texts moved together**, English governing, as the file itself says.
- **Existing installs keep the footer they saved.** The default only reaches a new blog; the
  two the owner runs were still crediting "Quireblog" and "Quire Blog" from before the rename
  ([0016](0016-rename-to-quire-ink.md)) and are corrected separately.
