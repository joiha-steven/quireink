# 0071 — A passkey is a second door beside the password and the code, never the only one

Date: 2026-10-04
Status: accepted; takes up what [0007](0007-self-hosted-password-totp-auth.md) deferred ("Passkeys were considered and deferred") and answers the question [0030](0030-two-factor-can-wait-until-there-is-an-address.md) left for this day
In force: see the [index](README.md). The index is maintained; this file is not.

## Context

Signing in is a password, then a six-digit code from a phone (or a recovery code). It works, and
it is two screens and a phone every time. A passkey is one gesture: the device asks for a
fingerprint, a face or its PIN, and signs a challenge with a key that never leaves it. The browser
will only use it on the origin it was made for, so it cannot be phished the way a password and a
code can be typed into a copy of the sign-in page.

There is one owner per blog, and that does not change.

## Decision

1. **A passkey is an alternative door, never the only one.** Adding one changes nothing about the
   password, the second factor or the recovery codes; removing the last one changes nothing either.
   There is no "passkey only" mode.
2. **A passkey sign-in is both factors.** Registration and sign-in require
   `userVerification: 'required'`, and the server refuses an answer without the UV flag. A key that
   was only touched is one factor, and the password + code door is the one for that.
3. **Discoverable credentials, conditional UI.** The sign-in page sends an empty `allowCredentials`
   (it never lists the owner's credential ids to a stranger) and offers the passkey in the username
   box's autofill where the browser can, with a button beside the form for the rest. The button is
   only drawn when a passkey exists and the browser has WebAuthn.
4. **Adding and removing ask for the password**, like every change in the security card. A stolen
   session that could add a passkey would keep a way in after the password was changed and every
   device signed out.
5. **The RP ID is the blog's host** from its address (`SITE_URL`, or the address in Settings),
   falling back to the request's host when no address is set — or when the address is an IP, which
   no browser accepts as an RP ID.
6. **Verified with Web Crypto on both runtimes**, ES256, EdDSA and RS256; CBOR and COSE are read by
   a small decoder of our own (`src/auth/cbor.ts`) that refuses everything outside the subset
   WebAuthn uses. No dependency ([0053](0053-a-dependency-is-a-decision.md)). Attestation is asked
   as `none` and not verified: it proves a model of authenticator, not the owner.
7. **Challenges are single-use and live five minutes**, in memory like the pending sign-in ticket.
   A registration challenge is bound to the session that asked for it. The origin, the RP ID hash,
   and the user-present and user-verified flags are checked; a sign count that does not go up
   against a non-zero stored count is refused and logged as a possible clone.
8. **Passkeys travel in the backup.** The `passkeys` table is not skipped: a restore that brings the
   blog back brings back the way its owner signs in.

## What it costs

- **A blog that moves domain loses its passkeys.** The authenticator binds a passkey to the RP ID it
  was made for; no setting can carry it to a new name, and the browser will not offer it there. The
  password, the code and the recovery codes work on any address, which is the reason for rule 1.
  The security card names the host the passkeys belong to and says this before the move, and
  [`docs/account.md`](../account.md) says it too.
- **Reaching the admin by another name than the address does not work for passkeys** (a
  `workers.dev` URL, a LAN IP). That is the same binding, seen from the other side.
- **An owner who skipped two-factor on a laptop ([0030](0030-two-factor-can-wait-until-there-is-an-address.md))
  can add a passkey and sign in with it there**, and once an address is set the password still leads
  to the enrolment screen. 0030 said a passkey on the laptop would be a better answer than the skip;
  this ADR does not remove the skip, because a passkey made for `localhost` is bound to `localhost`
  and stops working the moment the blog gets its real name.
- In memory, a challenge does not survive a restart, or a Durable Object put to sleep between the
  two halves of a ceremony. The answer is "try again", the same as for an expired pending ticket.
- Synced passkeys send a sign count of 0 for ever, so for them the counter check is no check at all.
  That is the spec's position too: the counter detects cloned hardware keys, not copied synced ones.
