# 0030 — Two-factor can wait, but only until the blog has an address

Date: 2026-08-25
Status: accepted
Amends: [0007](0007-self-hosted-password-totp-auth.md), whose **mandatory** TOTP now has one
named exception

## Context

ADR 0007 made TOTP mandatory, flatly, and that was right for the blog it was written for: a
live site on a public domain, one owner, one account, no recovery path but the codes.

On 2026-08-25 setup moved into the browser — a blog nobody owns prints a one-time `/setup`
link at boot, and claiming it hands straight to the enrolment screen. That put the rule in
front of a new person at a new moment: **thirty seconds after `docker compose up`, on a
laptop, before there is a single post.** They are asked to fetch a phone, install an
authenticator, scan a QR and store ten recovery codes in order to look at the software.

The honest question is not whether two-factor is good. It is what the second factor is
protecting **at that moment**, and the answer is nothing:

- Before anybody has enrolled, whoever reaches the enrolment screen with the password
  enrols **their own** authenticator. The second factor is not a door that is shut; it is a
  door being fitted, by whoever is standing there.
- A blog with no public address is not reachable by the people two-factor defends against.

Skipping it there widens no door that was shut. Skipping it on a live site does.

## Decision

**TOTP stays mandatory, with one exception, and the exception is gated on a fact rather than
on a preference:** while `siteUrlIsUnset(settings)` is true — no `SITE_URL`, no address in
Settings — the enrolment screen offers *"Set this up later"*.

Three things keep it narrow:

1. **The ROUTE refuses, not just the button.** `POST /api/auth/enrol/skip` re-reads the
   setting and answers 401 once an address is set. A button that is not rendered is not a
   check: anyone can read the HTML of a different install.
2. **Nothing is written.** No "skipped" flag, no grace period, no expiry to get wrong. The
   next sign-in asks for enrolment again, and the one after that. *Later* keeps meaning
   later rather than quietly meaning never.
3. **Setting an address closes it**, and setting an address is step three of the same setup
   flow — so the ordinary path is: skip on the laptop, name your domain, and be asked again
   with the offer gone.

## Consequences

- The rule ADR 0007 states in one word now needs two sentences, which is a real cost: an
  exception that must be explained is an exception that can be misread. It is written into
  `src/web/auth-routes.ts` next to `enrolmentSkippable`, and held by `src/web/setup.test.ts`
  — including the case that matters, which is the route refusing rather than the button
  being absent.
- An owner who never sets an address can run indefinitely on a password alone. That is a
  local install by definition, and its threat model is whoever can reach the machine —
  which is the same threat model as the `/setup` link itself.
- Recovery codes are unaffected: they are issued at enrolment, and an owner who has not
  enrolled has none to lose.
- Passkeys remain deferred (ADR 0007). If they land, this exception is the first thing to
  re-examine — a passkey on the laptop is a better answer than a skip.
