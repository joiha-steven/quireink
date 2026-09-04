# Security Policy

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report privately through GitHub's **[Report a vulnerability](https://github.com/joiha-steven/quireink/security/advisories/new)**
(Security → Advisories on this repo). If that is unavailable, open a minimal public
issue asking a maintainer to make private contact — without any exploit detail.

Include what you can: affected version/commit, a description, reproduction steps or a
proof of concept, and the impact you foresee. We aim to acknowledge within a few days
and to ship a fix or mitigation before any public disclosure.

## Scope

Quire Ink is self-hosted, single-owner software. The trust model: the account created with
`bun run user create` is the owner, and the owner is trusted. Owner-only actions
(uploading media, editing content, custom CSS, uploading an SVG) are not vulnerabilities.

Reports we care about:

- **Anything reachable without a session** that reads or writes owner data, escapes the
  owner-gated router group, or forges an MCP token or OAuth code.
- **Authentication**: bypassing the password or the TOTP second factor, replaying a TOTP
  code or a recovery code, fixing or stealing a session, or defeating the rate limiter on
  the sign-in path.
- **Injection** reachable by a non-owner: SQL, path traversal out of the upload store,
  SSRF through a URL the app fetches, or stored XSS in reader comments, public pages or
  OG images.
- **Secret exposure to a client**: `users.password_hash`, `users.totp_secret`, recovery
  codes, `integration_keys` (SMTP password, Turnstile secret, Cloudflare token), MCP token
  hashes, or the server secret.

## What the current design already assumes

Stated so a report can say which of these is wrong, which is more useful than a scan.

- Sessions are a 32-byte CSPRNG token in a `__Host-` prefixed, `HttpOnly`, `Secure`,
  `SameSite=Lax` cookie. Only its SHA-256 is stored. The prefix scopes it to one host, so
  a session does not follow a domain change.
- Passwords are argon2id (`Bun.password`). TOTP is required, not optional, and a used step
  is recorded so a code cannot be replayed. Ten single-use recovery codes are hashed at
  rest and shown once.
- Every write route is protected by **where it is mounted**, not by a check inside the
  handler, and a static guard (`bun run check:routes`) fails the build if a route escapes
  that group. See `docs/invariants.md`.
- Every SQL statement is a literal with bound parameters. There is no query string
  building anywhere in the request path.
- Raw HTML in markdown and in comments is escaped, never executed, and `javascript:`,
  `data:` and `vbscript:` hrefs are dropped.
- The HTML the software itself writes ships **no inline script**, which is what lets the
  recommended CSP omit `'unsafe-inline'` from `script-src`. A report that this is violated
  is a real finding. The one exception is by design: **Connections → Custom code** inserts
  whatever the owner pastes, verbatim, on public pages only (never the admin, the sign-in
  page or a preview). That is the owner's script on the owner's site, and it runs only where
  the owner's own policy allows it.
- Uploads are served from a single directory by exact path lookup; `..` and encoded
  variants do not escape it.

## Supported versions

Fixes land on `main`. Please test against the latest `main` before reporting.

**Quire 1.5.0**, the Next.js + PostgreSQL implementation, was replaced by 2.0 on 2026-07-28
and its last instance was shut down on 2026-07-31. It is **unsupported** and receives no
fixes, security ones included. It is no longer part of the working tree; it is in git
history at tag `v1-final`. Its trust model differed in one important way, so read it
with that in mind: the owner signed in with Google and was identified by
`AUTHORIZED_EMAIL`. A finding against 1.x is still worth sending if 2.0 inherited the same
flaw, but say which tree you tested, because a 1.x-only issue will be documented rather
than patched.
