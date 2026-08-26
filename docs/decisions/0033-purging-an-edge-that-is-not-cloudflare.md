# 0033 — Purging an edge that is not Cloudflare

Date: 2026-08-27
Status: accepted

## Context

`server/edge-cache.ts` knows one CDN. Configure a Cloudflare token and a zone id and every
write flushes the edge; run Bunny, Fastly, KeyCDN, or your own nginx cache, and the setting
is not there — the origin cache empties and the edge goes on serving what it has until its
own TTL runs out.

The gap is small and the shape of it is the problem. Two of the three Cloudflare touchpoints
in this codebase were removed this week (the comment gate got a default that needs no
account, ADR 0032; nothing else ever required an account at all). Leaving "the CDN purge
works if your CDN is Cloudflare" is the same species of assumption, and it is the exact one
this project spends a page criticising in somebody else's software.

## Decision

**One webhook URL beside the Cloudflare pair.** When it is set, a purge POSTs
`{"purge":"everything","source":"quireink"}` to it. Both fire when both are configured, and
an unconfigured one is a no-op, exactly as before.

**Not a provider list.** Bunny, Fastly and KeyCDN each want a different URL, a different
header and a different body, and every one of them can be reached by something that answers
a POST — a two-line worker, a shell script behind nginx, an automation the owner already
runs. A provider list is four integrations to keep current, four sets of credentials to
store, and a fifth CDN still unsupported. A URL is none of those.

The URL is stored as a **secret**, because a purge endpoint almost always carries its own
token in the path or the query, and it is never logged for the same reason the Cloudflare
token is never logged.

## Consequences

- An install behind any CDN gets what a Cloudflare install has had: an edit that is live
  without a manual purge.
- Whoever writes the receiving end owns the mapping. The body says only "everything", which
  is what the origin cache does on every write (Invariant 1) and therefore the only promise
  this project can keep honestly.
- **A purge webhook is a URL the server will POST to.** It is owner-entered and
  owner-gated, like the Cloudflare token, and it is the same class of trust: an owner who
  pastes a wrong URL has told their blog to call it.
- Cloudflare keeps its own path rather than being folded into the webhook. Its API needs a
  bearer header and a zone id in the URL, and asking an owner to reconstruct that as a
  webhook would be a worse experience than the one they have.
