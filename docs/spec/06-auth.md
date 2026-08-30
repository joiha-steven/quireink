# Authentication

New in Quire 2.0. Decided 2026-07-27.

**Google login is removed.** Sign-in is username + password + TOTP, entirely
self-hosted. `next-auth` is deleted along with it.

## Why

- Ten-year horizon: an OAuth client, a Google Cloud project and a policy that Google can
  change unilaterally are three external dependencies to keep alive for a decade, for a
  login used by one person.
- `next-auth` v5 encrypts its session as a JWE, which is unpleasant to verify anywhere
  outside its own runtime. Removing it removes that constraint permanently.
- The current sign-in page is a bare provider button. A blog that accepts comments and
  runs a newsletter should have a sign-in page that looks like a product.

Recovery codes cover the failure mode Google was implicitly insuring against (forgotten
password, lost device).

## Model

One owner. The schema uses a `users` table with one row anyway, because a one-row table
costs nothing and a hard-coded singleton costs a rewrite later.

```sql
create table users (
  id             integer primary key autoincrement,
  username       text not null unique,
  email          text not null,
  password_hash  text not null,               -- argon2id, via Bun.password
  totp_secret    text,                        -- base32, NULL until enrolled
  totp_last_step integer,                     -- replay guard, see below
  created_at     integer not null,
  updated_at     integer not null
);

create table sessions (
  id           text primary key,              -- sha256 of the cookie token, never the token
  user_id      integer not null references users(id) on delete cascade,
  created_at   integer not null,
  last_seen_at integer not null,
  expires_at   integer not null,
  user_agent   text,                          -- coarse bucket only, via ua.ts. No raw UA
  ip_hash      text                           -- salted hash, consistent with analytics
);

create table recovery_codes (
  user_id   integer not null references users(id) on delete cascade,
  code_hash text not null,                    -- argon2id
  used_at   integer,                          -- NULL until spent
  primary key (user_id, code_hash)
) without rowid;
```

`totp_secret` and `password_hash` are **never** read into any client-bound payload. Same
rule as `backup_state.refresh_token` and `integration_keys` in the frozen tree.

## Password

- `Bun.password.hash(pw)` (argon2id by default) and `Bun.password.verify`. No dependency.
- Minimum 12 characters. No composition rules, which push people toward worse passwords.
  A short deny-list of the obvious ("password", the site name, the username) is enough.
- **Constant-time failure.** When the username does not exist, still run a verify against
  a fixed dummy hash before returning, so response timing does not disclose account
  existence.
- The error copy is the same for wrong username and wrong password.

## TOTP

RFC 6238, and deliberately the boring configuration so every authenticator app works:
SHA-1, 30-second step, 6 digits. About 80 lines using `crypto.createHmac`, no library.

- Accept the current step and one step either side (±30s clock drift).
- **Replay guard:** store the step number that was accepted in `totp_last_step` and
  reject any step less than or equal to it. Without this, a code shoulder-surfed inside
  its 90-second window is replayable.
- Enrolment produces an `otpauth://totp/Quire:<username>?secret=...&issuer=Quire` URI,
  rendered as a QR code, with the base32 secret shown as text for manual entry.
- 2FA is **required**, not optional. One user, no support desk, no reason for a weaker
  path to exist.

## Recovery codes

- 10 codes, generated at enrolment, format `xxxxx-xxxxx` from a base32 alphabet with
  ambiguous characters removed.
- Stored argon2id-hashed. Single use: `used_at` is stamped on redemption.
- Shown **once**, on a screen with a download button and an explicit "I have saved these"
  confirmation.
- Regenerating invalidates all previous codes, and says so before doing it.
- A code substitutes for the TOTP step only. The password is still required.

## Sessions

- Token: 32 random bytes, base64url. The **hash** is the primary key; the raw token
  exists only in the cookie. A database leak does not yield live sessions.
- Cookie: `__Host-quire_session`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`.
- Sliding expiry: 30 days from last use, absolute maximum 90 days.
- `last_seen_at` is written at most once per hour to avoid a write per request.
- Revocable: Settings lists active sessions (coarse device, approximate location by IP
  hash bucket, last seen) with per-session revoke and a "sign out everywhere" button.
- Changing the password revokes every session except the current one.

## CSRF

`SameSite=Lax` blocks cross-site form POSTs. On top of that, every state-changing
request must present `Sec-Fetch-Site: same-origin` **or** a matching `Origin` header;
requests with neither are rejected. The admin SPA sends JSON with a custom header, so
the simple-request bypass does not apply to it.

No token table, no hidden field. This is the modern shape and it has less to go wrong.

## Rate limiting and lockout

Extends the existing `rate-limit.ts` sliding window.

| Surface | Limit | On exceeding |
|---|---|---|
| Password attempt, per IP | 10 / 15 min | 429 with `Retry-After` |
| Password attempt, per username | 5 / 15 min | soft lock 15 min, message says so plainly |
| TOTP attempt, per session | 5 total | the pending sign-in is destroyed, start over |
| Recovery code attempt | 5 / hour, per IP | 429 |

**Failures count; successes do not.** The window is checked before the attempt and charged
only after it fails, and a correct password clears the username's window outright. Built
2026-07-28 the other way first, where the sixth *successful* sign-in in a quarter of an
hour locked the owner out of their own blog — which is a normal amount of signing in while
setting up a new device. `overLimit` / `recordHit` / `clearLimit` in `server/rate-limit.ts`
are the split; `rateLimited` keeps the record-and-verdict-together shape for public
endpoints, where every request genuinely is a request.

Every outcome is written to `activity_log`, named `auth.login`, `auth.login.failed`,
`auth.totp.failed`, `auth.recovery.used`, `auth.password.changed`, `auth.totp.enrolled`,
`auth.recovery.regenerated`, `auth.logout` and `auth.sessions.revoked` — the `<area>.<event>`
shape the rest of that enum already uses, rather than the informal names this document
first wrote them in.

These are written by `logAuthEvent`, which **does not consult the `activityLog` feature
toggle**. Every other entry in that log is a convenience (what did I change, and when);
these are the answer to "was somebody trying to get in", and a security trail a setting can
silence is one an intruder can silence. The toggle exists so the owner can stop recording
their own edits, which is a different want.

## Bootstrap

There is no sign-up. The first owner is created by the CLI:

```
quire user create --username hung --email hung@...
quire user set-password --username hung
```

Implemented as `bun run user <create|set-password|list>` (`scripts/user.ts`).

The password is read from stdin, never from an argument, so it does not land in shell
history. On a TTY it is read in raw mode with no echo; when stdin is a pipe it is read once
and queued, so `echo "..." | bun run user create ...` answers both the password and the
confirmation prompt. (Reading the stream per prompt returns nothing the second time — the
first read drains it — which made every scripted install fail on "They did not match".)

TOTP enrolment then happens in the browser at first sign-in, which is forced before the
admin becomes reachable.

`--dev` was dropped. It was specified to mirror `DEV_LOGIN`, but `DEV_LOGIN` existed
because the frozen tree's only sign-in was Google OAuth, which cannot run against
localhost without credentials. Password sign-in has no such problem: `bun run user create`
IS the development path, so a second, weaker one gated on `NODE_ENV` would be a permanent
liability bought for no convenience.

## The sign-in interface

The brief is "looks trustworthy", so the details are the point.

**`/login`**, a real page on the site, not a framework-generated route.

- **The Quire mark at the top, not the blog's logo.** This reverses what this document
  originally specified ("the site's own masthead", on the phishing argument), changed by
  the owner on 2026-07-28 after seeing the built page. The phishing argument does not
  reach here: no reader is ever sent to `/login`, so the only person it addresses is the
  one signing in to Quire, and the door should look the same on every install. The blog is
  still named in words — in the line under the heading and in the way back at the bottom.
- **It does not load the public stylesheet.** That sheet is written for articles, and one
  of its rules (`main{flex:1}`) reached the card and stretched it to the height of the
  viewport. `web/login.css.ts` is self-contained apart from the `--c-*` palette tokens,
  which it still shares so the page follows the blog's colours and dark mode. It is
  appended after the owner's custom CSS: a blog's custom CSS may not distort the page you
  have to get through to fix it.
- Two fields, labelled, with correct autocomplete attributes: `autocomplete="username"`
  and `autocomplete="current-password"`. Password managers filling correctly is a real
  trust signal and costs one attribute.
- Password visibility toggle. A caps-lock warning.
- Errors appear inline, next to the field, in plain language, and never reveal whether
  the account exists.
- **2FA is its own screen**, reached after the password is accepted, with
  `autocomplete="one-time-code"` and a 6-digit input that accepts a paste of the whole
  code. A "use a recovery code instead" link below.
- No "remember me" checkbox. The session is already 30 days.

**First-run enrolment:** the password already exists (the CLI set it), so the browser flow
is TWO steps, not three — scan the QR and confirm one code, then save the recovery codes —
with a "Step n of 2" indicator so it is obvious it has an end.

Two properties of that flow are load-bearing, and both were found by running it rather
than by reading it:

- **The secret is held on the pending ticket, not written to `users`, until the confirming
  code verifies.** An interrupted enrolment must not leave a secret behind that nobody has
  scanned, because the next sign-in would then demand a code from an app that was never set
  up, and the only way out is the command line.
- **Confirming the code SPENDS it.** `setTotpSecret` resets the replay floor to null (the
  old floor referred to a different secret), so without an explicit `setTotpLastStep` the
  code just used to enrol is still unspent and replaying it signs in. That is exactly the
  replay the guard exists to stop.
- **The final step requires that enrolment actually completed.** The pending ticket alone
  used to be enough to receive a session at `/api/auth/enrol/done`, which skipped two-factor
  entirely on the one flow whose whole purpose is that two-factor is not optional.

**QR code:** inline SVG via `qrcode-generator` (`src/render/qr.ts`). A hand-written encoder
was rejected: QR is Reed-Solomon over a bit-interleaved layout, and a subtly wrong one
produces an image that looks exactly like a QR code and cannot be scanned. `qrcode-generator`
is a single file with no dependencies, chosen over the more popular `qrcode` (29 packages,
including a CLI argument parser and a PNG encoder). The code is black on white regardless of
theme — a dark theme rendering it inverted produces a code many scanners refuse, and it is
the one place in the codebase where a hardcoded colour is the right answer.

The base32 secret is shown as text beside it, grouped in fours. That is not a fallback: it
is what makes the screen complete without the QR, since every authenticator accepts a typed
key.

**Settings → System → Security** (`SecurityFields.tsx`, routes in `web/admin/security.ts`,
shipped 2026-08-31): change password, re-enrol 2FA, regenerate recovery codes, and the list
of signed-in devices with revoke. Every action that CHANGES something asks for the current
password and is rate limited per IP — a stolen session is the threat these controls answer,
so the session alone must not be enough to rotate the 2FA secret. Revoking a session asks for
nothing, because it only removes access. Changing the password signs out every OTHER device
and keeps the current one. All four log to `activity_log`.

This page described that screen for a long time before it existed: no route answered any of
it, while `listSessions`, `revokeAllSessions` and `remainingCodes` sat in `src/auth/` written
and tested and called by nobody. An owner whose laptop was stolen had no way to end its
session; an owner down to their last recovery code had no way to make more.

House style applies throughout, per the `frontend-house-style` guidance: theme tokens
only, one typeface, no all-caps, one divider style.

## What is removed

`next-auth`, `@auth/*`, the Google provider, the credentials provider, `AUTH_SECRET`,
`AUTH_URL`, `AUTHORIZED_EMAIL`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `DEV_LOGIN`, and
the seven `next-auth` import sites.

`MCP_OAUTH_SECRET` stays: MCP tokens and the MCP OAuth flow are a separate mechanism for
a separate client, they are unaffected by this change, and their token hash format must
be preserved across cutover (00-rationale.md, parity exception #4).

### `AUTH_SECRET` had a second job

It was also the salt for the analytics visitor hash, via
`process.env.AUTH_SECRET ?? 'quire'` — and the fallback was the worse half: a salt printed
in the source is one anybody holding the database can reuse, trying candidate IP and user
agent pairs until one matches. That is the single property the hash exists to deny.

Replaced by the `server_secrets` table and `auth/secret.ts`: a 32-byte value generated on
first use, per purpose (`analytics-visitor`, `session-ip`), never shown in any UI. One
fewer environment variable for a self-hoster to set, and no way to leave it unset. Distinct
per purpose so a confirmed guess in one table proves nothing about the other.

## Later, not now

**Passkeys / WebAuthn** as an additional fast path alongside password + TOTP. Decided
against for v2.0 to keep the surface small; the `users` table gains a `credentials`
child table when it happens, and nothing above needs to change.
