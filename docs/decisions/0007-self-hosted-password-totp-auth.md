# 0007. Replace Google login with password + TOTP + recovery codes

Date: 2026-07-27
Status: accepted
In force: see the [index](README.md). The index is maintained; this file is not.

## Context

Sign-in was `next-auth` with a single Google provider gated on `AUTHORIZED_EMAIL`. On a
ten-year horizon that is three external dependencies (an OAuth client, a Google Cloud
project, and a policy Google can change unilaterally) for a login used by one person.

Two secondary problems: `next-auth` v5 encrypts its session as a JWE, which is unpleasant
to verify outside its own runtime, and the sign-in page was a bare provider button on a
site that accepts comments and runs a newsletter.

## Decision

Self-hosted auth. Username + password (argon2id via `Bun.password`), **mandatory** TOTP
(RFC 6238, SHA-1 / 30s / 6 digits), and 10 single-use recovery codes. Google login and
`next-auth` are removed entirely. Passkeys were considered and deferred.

## Consequences

- Sessions live in SQLite as hashed tokens, so they are revocable and "sign out everywhere"
  is possible. Sessions do not survive the cutover; MCP tokens do.
- Recovery codes carry the failure mode Google was implicitly insuring against.
- Removing `next-auth` removes the JWE constraint permanently.
- Net cost is near zero: porting `next-auth` to Bun was already on the M3 list, so this
  replaces that work rather than adding to it.
- `MCP_OAUTH_SECRET` and the MCP OAuth flow are untouched. Different client, different
  mechanism.
- Full spec: `v2/docs/06-auth.md`.
