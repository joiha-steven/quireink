# 0032 — The comment gate needs no account

Date: 2026-08-27
Status: accepted
Amends: nothing. Turnstile keeps working exactly as it does today, and gains a default
underneath it.

## Context

A blog installed from [`install.sh`](../../install.sh) has comments and no bot defence worth
the name. What it has: a per-IP rate limit, and — only if the owner has plugged in an AI
key — a classifier that moves a spam comment to the Trash *after* it has been posted.

The one real gate is **Cloudflare Turnstile**, and it costs an account. Open one, add the
site, copy two keys, paste them into Settings. That is a small thing to ask and a large
thing to say: the README's whole claim is a blog with **no third-party request on any
reader-facing page and no account anywhere in the path**, and the moment an owner wants
their comments protected, both halves of that stop being true. The widget also fetches a
script from `challenges.cloudflare.com` on every page that renders the form.

It is also the exact criticism EmDash drew — that the feature you actually need only works
if you bring Cloudflare — and it would be strange to charge them for it and quietly do the
same thing.

## Decision

**Ship a gate the blog can run on its own, and make it the default.** Turnstile stays, and
takes over whenever its keys are configured; that is the owner's explicit call
(2026-08-27): *whoever enters a Turnstile key gets Turnstile, everybody else gets ours, and
Settings says which one is running.*

The default gate is a signed challenge, solved in the reader's browser:

1. The page that renders the comment form carries a challenge the server signed with its own
   secret: a random salt, the hash of an answer it picked, and the minute it was issued.
   **No state is stored** — the signature is the storage, the same trick the preview links
   already use.
2. The island starts solving as soon as the form exists, not when the reader presses send.
   It hashes candidate numbers with the browser's own `crypto.subtle` until one matches. A
   fraction of a second, spent while somebody is typing, so nobody ever waits for it.
3. Sending carries the answer. The server re-checks the signature, the age and the hash, and
   spends the salt so the same solution cannot be replayed.

Two consequences of the shape are the reason for it: **the work is on the sender**, which is
what makes a thousand comments cost a bot a thousand times more than one, and **nothing
leaves the server** — no script from anybody, no verification call, no account.

The issue time in the signature does a second job for free: a form submitted in under three
seconds was not typed, and one submitted after two hours was left open, and both are refused
with the same clarity as a wrong answer.

**Where `crypto.subtle` does not exist** — a site served over plain HTTP, which is not a
secure context — the browser cannot solve anything. The gate then falls back to the age
check alone, and the admin says so rather than pretending to a protection it does not have.
The fix for that install is TLS, which it needs anyway.

## Consequences

- **A fresh install has a real gate**, and the "no account anywhere" claim survives contact
  with the first spam comment.
- **Turnstile is now a choice, not the only door.** An owner who already has it, or who
  wants Cloudflare's risk scoring rather than arithmetic, sets the keys and nothing changes
  for them.
- **This stops a bot that will not run JavaScript, which is most of them, and not one that
  will.** A headless browser solves the challenge like anyone else, just slower and at a
  cost. That is the honest ceiling of every proof-of-work gate, Turnstile included, and the
  AI classifier behind it remains the answer to what gets through.
- **The page cache is untouched.** The challenge rides in the comments mount point, which is
  already per-page HTML, and the signature makes it verifiable without a lookup — so cached
  pages stay cacheable and there is no per-visitor render.
- A stale cached page can carry an expired challenge. The island asks for a fresh one when
  the server says the stamp is too old, which is one request on an unusual path rather than
  a request on every page.
