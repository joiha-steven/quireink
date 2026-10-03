# 0066 — Cloudflare is a second runtime: one codebase, Workers Paid only, source only

Date: 2026-10-03
Status: accepted
In force: see the [index](README.md). The index is maintained; this file is not.

## The problem

Every way to run Quire Ink today needs a machine: a VPS, a NAS, a cluster. The people this product
is for — one person, one blog they mean to keep — are exactly the people least able to keep a
machine patched, its disk from filling, its certificate renewed. A blog that runs entirely on
Cloudflare, in the owner's own account, removes the machine.

Measured on 2026-10-03 (Quire Ink 2.2.16, shimmed into a Durable Object under workerd, and a probe
Worker on a real Workers Paid account):

- startup 64–75 ms of CPU against a 1 s limit; first render p90 8 ms; heap peak 58–66 MB reading;
- `schema.sql` and all 23 migrations run on Durable Object SQLite; FTS5 (with
  `remove_diacritics`), triggers, JSON and `quick_check` work; `ATTACH`, `VACUUM`,
  `integrity_check` and the configuration PRAGMAs are refused;
- shiki's Oniguruma engine, loaded from a static `.wasm`, produces byte-identical HTML to Bun on
  174 of 174 samples; the default engine silently falls back to uncoloured code;
- a Worker with a Durable Object, R2, static assets and a secret deploys through the REST API
  alone in 8.4 s; the Images binding produces AVIF and WebP;
- a Durable Object accrues duration only while handling requests: minutes with no request cost 0.

## The decision

1. **Cloudflare is a second runtime of the same product, not a port and not a fork.** One
   codebase. Code that touches I/O goes through a port with one implementation per runtime under
   `src/runtime/bun/` and `src/runtime/cf/`; outside those directories nothing may import `bun:*`,
   `node:fs`, `node:net`, `node:tls`, `node:child_process` or `cloudflare:*`, or touch the `Bun`
   global. Where one pure-JS implementation can serve both (the tar writer, the SMTP protocol,
   the maintenance tick), it does, because one implementation cannot drift from itself.
2. **Every difference has a name.** A capability that differs between runtimes is a flag in code
   and a row in `docs/runtimes.md`, and the admin says why. Nothing degrades silently.
3. **Both runtimes are tested on every push**: the contract tests of every port on both adapters,
   the tour on Bun and on workerd, and a parity crawl that serves the same backup from both and
   diffs every public page and admin screen to zero.
4. **Only Workers Paid ($5 a month per account) is supported.** The Free plan fails closed: a hard
   100,000 requests a day (one view is two requests, so about 50,000 views, then errors until
   00:00 UTC), no outbound email, writes refused past 100,000 rows a day (autosave included), 50
   subrequests per invocation. Supporting it would mean a second set of failure paths to test for
   a plan that still needs a card on file for R2. The installer reads the plan and stops with this
   explanation.
5. **The project provides source and nothing else.** No machine run by this project stands in the
   path of an install or an upgrade, and no owner's token ever reaches one. The ways in are
   Cloudflare's own Deploy button (Cloudflare builds the public repository into the owner's
   account), and the owner's own running Quire Ink moving itself to Cloudflare with a token the
   owner pastes. A hosted install page was considered and rejected for this reason: the Cloudflare
   API sends no CORS headers, so such a page would need a server of ours in the middle.
6. **`SETUP_CODE` is required on Cloudflare.** Without it, whoever reaches a fresh blog first can
   claim it, and an owner who installed with a button will not know where a Worker's log is.
7. **Upgrading needs no token by default**: sync the fork, and Workers Builds deploys. A token
   pasted into the admin enables a one-click upgrade with automatic rollback; while one is held,
   two-factor sign-in is mandatory, because Workers Scripts · Edit cannot be scoped to one script.

## What it costs

- Every change that touches I/O is written twice, and CI runs twice. The cost is held down by
  rule 1's preference for shared implementations, not by trusting anyone to remember.
- 128 MB per isolate is the tightest limit. Argon2 at Bun's default 64 MiB and shiki grammars
  that are never released both threaten it; [0068](0068-new-password-hashes-use-19-mib.md) and a
  bounded grammar cache are part of this decision's price.
- The backup could no longer be a pair of SQLite files, because a Durable Object cannot
  `VACUUM INTO`. That is [0067](0067-the-backup-is-rows-and-goes-only-into-an-empty-blog.md).
