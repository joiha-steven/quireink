# Port ledger

Every file moved from the frozen tree, and every one deliberately left behind. Kept so a
module cannot be dropped silently: `docs/spec/07-parity.md` covers behaviour, this covers
files.

Closed milestones are split out as they finish, so this file stays the CURRENT one:

| Milestone | File |
|---|---|
| M1, the data layer | [LEDGER-M1.md](LEDGER-M1.md) |
| M2, the public renderer | [LEDGER-M2.md](LEDGER-M2.md) |
| M3, admin, API and auth | this file |

## M3 begins: the auth core (2026-07-28)

Nothing was moved here. Authentication is the one area of 2.0 that is **not** a port:
`next-auth` and the Google provider are deleted outright, and password + TOTP is new code
against `docs/spec/06-auth.md`. So the porting rule does not apply, and the protection it
normally buys — a diff that is pure motion — is absent. Everything below is therefore
covered by tests written alongside it.

**Written:** `auth/totp.ts`, `auth/password.ts`, `auth/sessions.ts`, `auth/recovery.ts`,
`auth/users.ts`, `auth/csrf.ts`, `auth/login.ts`, `auth/secret.ts`.

**TOTP without a library.** RFC 6238 is ~90 lines against `node:crypto`, and a TOTP
dependency is a supply-chain entry for an algorithm unchanged since 2011. The configuration
is deliberately the boring one — SHA-1, 30-second step, 6 digits — because that is what
every authenticator assumes when it scans a QR that does not spell out its parameters.
SHA-256 would be marginally stronger and would fail silently in some apps.

All six RFC 6238 appendix B vectors pass, including `T=20000000000`. That last one is the
reason the counter is written through a `DataView` with a `BigInt`: a naive
two-`writeUInt32BE` split works for every vector below 2^31 steps and breaks in 2038.

**Three deviations from 06-auth.md**, each documented there in the same commit:

1. **The lockout counts failures, not attempts.** Built the spec's way first, and the tests
   immediately locked the owner out: the per-username window charges every attempt, so the
   sixth *successful* sign-in inside fifteen minutes is refused. That is a normal amount of
   signing in while setting up a new device. `rate-limit.ts` gained `overLimit` /
   `recordHit` / `clearLimit`; `rateLimited` keeps its combined record-and-verdict shape for
   public endpoints, where every request genuinely is a request.
2. **Auth events are `auth.<event>` and bypass the `activityLog` toggle.** The names match
   the `<area>.<event>` shape of the enum they join rather than the spec's informal prose.
   The bypass matters more: every other entry in that log is a convenience, these are the
   answer to "was somebody trying to get in", and a security trail a setting can silence is
   one an intruder can silence.
3. **`AUTH_SECRET` had a second job.** It left with next-auth, but it was also salting the
   analytics visitor hash — as `process.env.AUTH_SECRET ?? 'quire'`, and the fallback was
   the worse half: a salt printed in the source is one anybody holding the database can
   reuse to try candidate IP and user agent pairs until one matches, which is the single
   property that hash exists to deny. Replaced by a `server_secrets` table and
   `auth/secret.ts`, generated on first use, distinct per purpose.

**`--dev` dropped.** The spec called for `quire user create --dev`, mirroring `DEV_LOGIN`.
But `DEV_LOGIN` existed because the frozen tree's only sign-in was Google OAuth, which
cannot run against localhost without credentials. Password sign-in has no such problem:
`bun run user create` IS the development path, so a second weaker one gated on `NODE_ENV`
would be a permanent liability bought for no convenience.

## M3: the sign-in flow, and Invariant 4 made enforceable (2026-07-28)

**Written:** `web/guard.ts`, `web/auth-routes.ts`, `web/login-page.ts`, `web/login.css.ts`,
`render/qr.ts`, `assets/js/login.ts`, `scripts/user.ts`,
`scripts/checks/routes-guarded.ts`.

**The gate is structural.** `ownerRouter()` applies `requireOwner()` at construction, so
there is no router someone can create and then forget to guard. The CSRF origin check lives
inside that same middleware rather than beside it: a cookie-authenticated write is exactly
the request that needs both, and splitting them creates the possibility of mounting one
without the other.

`check:routes` is the other half — a build failure for any write route outside a gated
router, unless its path is in `PUBLIC_WRITES` **with a written reason**. Making the
exception a list entry that carries an argument is the point; a naming convention would not
be one. Proved it fires by injecting a `DELETE` route before trusting it, and it then caught
a real forgotten `/api/auth/enrol/done`.

### Two security bugs, both found by RUNNING the flow

Neither was visible in the code. Every part was individually correct; only the sequence was
wrong.

1. **The TOTP code used to enrol could be replayed to sign in.** `setTotpSecret` resets the
   replay floor to null — correctly, since the old floor referred to a different secret — so
   the code just used to confirm enrolment was still unspent. Signing in with it worked.
   That is precisely the replay the guard exists to stop, defeated at the one moment the
   guard is initialised.
2. **`/api/auth/enrol/done` issued a session from the pending ticket alone.** Nothing
   checked that enrolment had actually completed, so anyone with the correct password could
   POST straight to it and receive a session, skipping two-factor entirely — on a flow whose
   entire purpose is that two-factor is not optional. It surfaced because a test about open
   redirects passed *through that path by accident*, which is the more useful lesson: the
   test was green and proving nothing.

Both now have a test named after the failure.

**Progressive enhancement, which matters most here.** The sign-in page is the one page a
reader cannot route around, so every screen is a real form with a method and an action.
`login.js` is 858 b and carries three conveniences only: the reveal toggle, the caps-lock
warning (via `getModifierState`, because inferring it from typed case fails for a password
with no letters) and auto-submit on a pasted one-time code.

**QR: a dependency, deliberately.** QR is Reed-Solomon over a bit-interleaved layout, and a
subtly wrong encoder produces an image that looks exactly like a QR code and cannot be
scanned — the "looks right and is not" failure mode, with no scanner here to catch it.
`qrcode-generator` is one file with no dependencies, chosen over the more popular `qrcode`
(29 packages, including a CLI argument parser and a PNG encoder that would never be called).

Tested by structure the QR specification fixes independently of any implementation: the
three finder patterns, the deliberately absent fourth (it is how a scanner tells which way
up the code is), and a clear quiet zone. Black on white regardless of theme, because a dark
theme rendering it inverted produces a code many scanners refuse — the one place in this
codebase where a hardcoded colour is the right answer.

**Also fixed:** `scripts/user.ts` read the whole stdin stream on the first prompt, so the
confirmation prompt always read empty and every scripted install failed on "They did not
match".

## M3: the first 21 API routes (2026-07-28)

| Destination | From | Change |
|---|---|---|
| `web/admin/content.ts` | `app/api/{posts,pages}/**` | posts, pages, revisions |
| `web/admin/site.ts` | `app/api/{taxonomy,series,redirects,settings,trash,activity,cache}/**` | the rest of the content-adjacent admin |

Same paths, same request shapes, same status codes — including the two strings a client
matches on rather than a status: `slug_taken` and `in_use:<n>`.

They are materially shorter than what they replace, for three structural reasons and no
cleverness: `requireOwner()` is a property of the router, `logRequest`/`logError` are
middleware, and `revalidatePost(meta.slug, slug)` is `clearCache()`.

**`app.onError(errorHandler())` replaces sixty-one copies of the same try/catch.** It logs
to `activity_log` and returns a typed 500 **without** the exception message, which can
carry a path, a SQL fragment or a token.

**Where Invariant 1 removed real machinery.** `/api/settings` purged everything and then
re-warmed several pages, because a cold ISR miss was expensive; a page now re-renders from
SQLite in well under a millisecond, so warming is work done to avoid work that is already
free. `/api/trash` revalidated selectively per kind and per action, and its media branch
had to remember `revalidateEverything()` in two separate places.

**`/api/cache/clear`** clears the Map and purges Cloudflare. The origin cache is already
empty by then; what is left is the edge, which this server neither controls nor can
re-render.

### The gate leaked, and the fix is the point

`ownerRouter()` first applied `requireOwner()` as `use('*')` on a sub-app. `app.route('/',
sub)` copies that into the parent as `/*`, so **every public page on the site returned
401.** Fifty-one tests failed and not one of them said why.

The gate is now attached per registration. Invariant 4 survives intact — protection is
still a property of WHERE a route is registered, not a line inside the handler — without
the blast radius. There is a test named after the leak, so a recurrence reads as one clear
failure instead of fifty-one mysterious ones.

`param()` throws on a name the route's path does not contain, so a typo becomes a logged
500 rather than a lookup for the empty slug that quietly 404s and reads as missing data.

**Two test fixtures were wrong before the code was**, and both are worth stating because
they are the shape Invariant 3 stores: media is keyed on `path`, not `url`, and the key
must live under `media/`, because that is the prefix `usedMediaKeys` scans content for. A
fixture that misses it makes the `in_use` guard look broken when it is fine.

## M3: the remaining API surface (2026-07-28)

| Destination | From | Routes |
|---|---|---|
| `web/admin/uploads.ts` | `app/api/{media,files}/**` | 13 |
| `web/admin/news.ts` | `app/api/{mail,broadcast,subscribers,comments,integrations}/**` | 11 |
| `web/admin/ops.ts` | `app/api/{cron,health,preview-link,import}/**` | 4 |
| `web/admin/mcp.ts` | `app/api/mcp/{authorize,token,register,tokens}`, `.well-known/*` | 6 + 2 |
| `import/wordpress.ts` | `lib/wordpress-import.ts` | the WXR parser, unchanged |
| `mcp/{auth,consent}.ts` | `lib/mcp/{auth,consent}.ts` | the thin OAuth layer |

**55 of 61 routes moved.** Details kept because each has a reason, not because the diff
was mechanical:

- The media library refuses the WHOLE batch on one bad type. A partial upload leaves the
  owner working out which of twenty images landed.
- Several media and file routes return the AUTHORITATIVE list after the write rather than
  an acknowledgement. The grid is on screen while the owner deletes.
- `GET /api/mail` returns `hasPass`, never `pass`, and `POST` patches field by field — so
  saving the form without retyping the password does not wipe it, which is every save,
  because the form cannot show it.
- The test send uses a deliberately FAKE token. A test must look exactly like the real
  thing and be completely inert to click.
- A failed test send is 502, not 500. That is what tells the owner to check SMTP rather
  than report a bug.
- `/api/broadcast` takes REPEATED `?slug=`: several posts go out as one digest, so the
  preview takes the same list the send will.
- The cron bearer check is constant-time, and `timingSafeEqual` throws on a length
  mismatch — so a wrong-length header would be a 500 rather than a 401 without the length
  compare in front of it. There is a test for that.
- The health probe checks the storage directory is WRITABLE, not merely present. A full
  disk and a read-only mount both pass an existence check, and both are what a probe is for.

### Two substitutions in the MCP OAuth layer

Both forced by next-auth leaving, both recorded in `06-auth.md`:

1. The code-signing secret was `MCP_OAUTH_SECRET || AUTH_SECRET`. The fallback is now a
   generated per-purpose secret. Codes live 300 seconds, so rotating it is not a migration
   concern — and the TOKEN hash format, which **is** one (00-plan.md risk register), is
   untouched.
2. The consent CSRF token was keyed to the next-auth session JWT; it is now keyed to the
   stored session ID (the SHA-256 of the cookie token). The property is the same or better:
   an attacker who can make the browser send the cookie still cannot READ it, so cannot
   derive the ID.

The account-takeover path the consent step exists to close is unchanged and now has a test
named after it, plus one proving a CSRF token minted for one session is refused from
another.

### New in 2.0

- Cron also purges expired sessions. They expire but their rows do not remove themselves,
  and the request path deliberately only deletes the one it already holds.
- `turndown-plugin-gfm` ships no types, so there is a hand-written 12-line declaration
  rather than a dependency on a community `@types` package that has to survive a decade.

## Nothing left to move

All four of the items this section used to list shipped in M3 (2026-07-28), and the section
went stale rather than being deleted, which made it the last thing in the repository still
claiming the port was unfinished:

- **`backup/*`** landed as `server/backup.ts` plus `GET /api/backup/export`. It does NOT
  round-trip through Google Drive: snapshots are written to `BACKUP_DIR` on the owner's own
  disk, which is what removed the OAuth problem rather than solving it. See `docs/backups.md`.
- **The MCP transport** is `src/mcp/` (nine files) wired through `web/mcp-wire.ts`, on the
  SDK directly. A rewrite, as expected.
- **The admin SPA** is `src/admin/`, 68 components across 12 pages.
- **Turnstile** is `auth/turnstile.ts` plus the `assets/js/turnstile.ts` island.

The port is closed. `LEDGER-M1.md` and `LEDGER-M2.md` are the earlier milestones and are
consistent as they stand.
