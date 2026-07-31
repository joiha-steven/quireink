# 0016 — Rename the product to Quire Ink, on `quireink.com`

Date: 2026-07-31
Status: accepted

## Context

The project has answered to three names. It began as **vibeblog**, became **Quire** when the
Next tree was frozen, and the repository was renamed `joiha-steven/quire-blog` on 2026-07-31
so the repo, the working copy and the links agreed. Each rename fixed the name in one place
and left it in others: the shipped app icon still read `vb` when this ADR was written, two
names later, and nobody had looked at it because it is 512 pixels of something you never
open.

Two things then arrived together. The owner bought **`quireink.com`**, and the plan for it
splits the surface in two: `demo.quireink.com` becomes a public demo instance so that
`manhhung.me` stops doubling as the showroom for the software, and the apex is reserved for
a hosted offering later ([ADR 0002](0002-no-saas-single-instance.md) still stands: nothing
in the code is designed for multi-tenancy, and this ADR does not change that). A product
with a domain of its own should not still be named after the repository it lives in.

"Quire Blog" was also always slightly wrong as a name. It is a blog engine, so the noun adds
nothing, and it invited the wordmark `quireblog`, which is one long lowercase run with no
shape to it.

## Decision

The product is **Quire Ink**. `quireink` is the slug: repository, package name, binary,
domain. **quireINK** is the wordmark.

`quire` (a gathering of folded sheets) and `ink` are the two halves of what the thing is,
and the wordmark sets them in the project's own two typefaces: **Literata** for `quire`,
because that is the face a reader reads, and **JetBrains Mono** for `INK`, because that is
the face the machine talks in. The same pairing already runs the whole product — the IDE
chrome, the `//` labels, the code blocks — so the logo is the type system stated in two
words rather than a decoration applied on top of it.

**The wordmark is committed as outlines**, in `src/brand-art.ts`, not as text with a
`font-family`. Three reasons, in order of weight:

1. `/login` is the one page where "did this load?" is a security question, and a mark that
   arrives on its own request can arrive late or swap face mid-paint. `web/brand.ts` already
   made this argument for the symbol; it applies harder to the word.
2. The admin renders in whatever chrome font the owner picked. As live text the logo would
   have been a different logo per install.
3. Neither face is guaranteed to be declared on a given page: `pageStyles` emits the owner's
   chosen faces plus Inter and JetBrains Mono, so Literata is frequently absent.

The app icon and the favicon are generated from the same file, so they cannot drift from the
logo the way the `vb` icon did.

## What did NOT change, and why

Three names are load-bearing rather than decorative, and renaming them would cost real
things for no visible gain:

- **`quire.db` and `analytics.db`.** These are the data files of every existing install.
  Renaming them breaks every upgrade, every backup script and every archive already sitting
  in object storage, in exchange for a string nobody ever sees.
- **`__Host-quire_session`.** Renaming the cookie signs out every live session on deploy.
- **The systemd unit, the service user and `/home/quire2/app`** on the server. That is an
  infrastructure migration, not a repository change, and the deploy runbook and the backup
  cron both name them.

Historical documents keep the name they were written under: `CHANGELOG.md`, everything in
`state/audits/`, `state/reports/` and the worklog archive, the earlier ADRs, and `docs/spec/`
(a delivered plan, including the line in `00-plan.md` that says "the product stays Quire" —
which this ADR supersedes). Any phrase naming **Quire 1.x** keeps it too: that IS the retired
implementation and it shipped under that name.

`Quire` alone stays acceptable as the short form in running prose, the way nobody says Adobe
Photoshop twice in a paragraph.

## Consequences

- The GitHub repository moves to `joiha-steven/quireink`. GitHub keeps redirecting the old
  path, so links in the wild and existing clones keep working, but every link in this
  repository was updated rather than left to the redirect.
- The TOTP issuer becomes `QuireInk`, one token with no space: `encodeURIComponent` turns a
  space into `%20` inside the `otpauth:` label and an authenticator shows the label verbatim.
  Existing enrolments keep showing the old issuer and keep working, because the shared secret
  is what authenticates, not the label.
- Default settings change for NEW installs only (site title, footer credit). An existing
  install stores its own and sees nothing.
- The demo instance is not built by this ADR. It is the next piece of work, and it needs its
  own decision about how a public admin can be readable without being writable.
