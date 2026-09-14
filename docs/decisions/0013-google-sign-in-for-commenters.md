# 0013. Bring back Google sign-in, for commenters only

Date: 2026-07-29
Status: accepted
In force: see the [index](README.md). The index is maintained; this file is not.

## Context

The frozen tree let a reader sign in with Google before commenting. That reader was
trusted: their name and address came from the session and Turnstile was skipped. 2.0
shipped without it, and `docs/spec/07-parity.md` §7a recorded the removal as deliberate,
citing [0007](0007-self-hosted-password-totp-auth.md).

That citation was wrong, and the mistake is worth naming because it is how a feature
disappears quietly. 0007 is about the OWNER'S sign-in: it argues that three external
dependencies are too many for a login used by one person, and that argument is untouched
here. It says nothing about readers, who are not one person and have no account to give
a password to.

What was left behind was worse than a clean removal: the `comments.googleAuth` toggle was
still in Settings, still defaulted visible, and controlled nothing. The owner could turn on
a feature that did not exist.

## Decision

Google sign-in returns for **commenters only**. The owner's sign-in is untouched and stays
password + TOTP + recovery codes.

- OAuth 2.0 authorization code flow against Google, `openid email profile` and nothing else.
  The access token is used for nothing and is dropped; the identity comes from the
  `id_token` in the same response.
- The client id and secret are entered **in the admin** and stored in `integration_keys`,
  beside Turnstile and Cloudflare, with the old `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`
  environment variables kept as a fallback.
- A commenter is a **signed cookie**, not a row: 30 days, `__Host-` prefixed, HttpOnly,
  `SameSite=Lax`, HMAC over a payload holding name, address and expiry.
- A signed-in reader's comment takes its identity from the cookie and ignores what the
  request body claims, records `provider = 'google'`, and skips Turnstile.

## Consequences

- **No table, no purge sweep, no write on a reader's first comment.** The cost is that a
  single commenter session cannot be revoked. That is the right trade for a credential
  whose entire power is to pre-fill two form fields; the owner's session, which can do
  anything, still lives in `sessions` and is still revocable one by one.
- **The id_token's signature is not verified.** It arrives on the server's own TLS
  connection to Google's token endpoint, in the direct response to a request carrying the
  client secret. OpenID Connect Core §3.1.3.7 permits skipping validation in exactly that
  case. The claims are still checked — `aud`, `iss`, `exp`, `email_verified` — because
  those assert things TLS does not. Fetching and rotating Google's JWKS to re-prove what
  TLS just proved is the cost avoided.
- **A dependency Google can change unilaterally is back**, which is precisely what 0007
  refused for the owner. The difference is the failure mode: if Google withdraws the client,
  readers fill in a name and an email, which is what they do today. The owner locked out of
  their own admin is not comparable.
- **The first schema migration.** `01-schema.md` said the ledger starts empty because there
  is no Quire 2.0 in the wild to upgrade. There is now, so `src/store/migrations.sql` and
  the runner in `db.ts` exist. A schema change is two edits from here on: the final shape in
  `schema.sql`, and the step that gets an existing database there.
- The reader keeps a real choice. Sign-in is an offer above the form, never a gate; the
  manual path is unchanged and is what a reader who ignores it gets.
- Reverses parity exception 7a. `docs/spec/07-parity.md` is updated to point here.
