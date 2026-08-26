# 0031 — The blog winds its own clock

Date: 2026-08-27
Status: accepted

## Context

Nothing inside the process schedules anything. `/api/cron` is the entry point and an
external scheduler has to call it, twice on two cadences, or scheduled posts never go live,
image variants are never finalised, expired sessions and `render_cache` rows accumulate, and
the on-server snapshots never run. [`self-host.md`](../self-host.md) §8 says so in bold and
prints the two crontab lines.

That design is inherited, not chosen. The 1.x tree ran on Vercel, where a process cannot
keep a timer and the platform's cron is the only clock there is. The rewrite carried the
route across and never revisited the assumption, and **no ADR ever decided it** — the
parity list simply marks the behaviour `⚠`.

What it costs is not theoretical, and it is worse than "scheduled posts are late" because
of how the page cache works. There is no `scheduled` status: a post with a future date is
simply hidden by the read layer, so when its time arrives the DATA is already public. What
is stale is the cache in front of it, and the cache has no TTL by design (Invariant 1: one
`Map`, emptied whole on every write). With no tick and no other edit, the front page, the
list, the feed and the sitemap keep serving the version that did not have that post in it,
**while the admin shows it published**. It is not late. It is invisible, until the owner
happens to save something else.

The rest goes the same way, quietly: image variants stay unfinalised so a `<picture>` never
gains its sources, expired sessions and `render_cache` rows accumulate, unconfirmed sign-ups
pile up, and the on-server snapshots never run.

Installing is now one command ([`install.sh`](../../install.sh)) and claiming the blog is a
link in the log, so the whole setup can be done without a terminal. Then the guide asks for
a crontab. A missing clock is the worst kind of misconfiguration: everything looks healthy.

## Decision

**The process runs its own clock by default.** Two timers, the same two cadences the
documented crontab uses, calling exactly the same functions the route calls.

`CRON_INTERNAL=0` turns it off, for an operator who prefers an external scheduler and does
not want both running.

Three things this deliberately does NOT change:

1. **`/api/cron` stays**, unchanged, with its bearer check and its rate limit. An external
   scheduler is still a first-class way to run this, and the route is also how a deploy
   hook asks for a purge (`?purge=1`).
2. **The work moves, the route does not own it.** The tick's body becomes
   [`src/server/tick.ts`](../../src/server/tick.ts) and both callers use it, so there is one
   description of what a tick does rather than two that drift.
3. **The clock is quiet where a clock would be wrong**: `bun test` and `bun --watch` do not
   start it, by the same rule and the same helper the update check already uses
   (`NODE_ENV`, plus Bun's own `--watch`/`--hot` flags). A test suite that starts a
   background timer is a test suite that fails somewhere else, later, for no visible reason.

The timers are `unref`'d, so they never hold the process open at shutdown.

## Measured, not assumed

Two identical instances, one command apart. A post was saved with a date 45 seconds in the
future, a reader loaded the front page before that moment (warming the cache the way a real
visitor does), and the same page was read again 110 seconds later with nothing else
touching the blog:

| | front page before it was due | 110 seconds later |
|---|---:|---:|
| clock on (the default) | not there | **there** |
| `CRON_INTERNAL=0`, no external scheduler | not there | **still not there** |

The second row is what every install without a crontab has been doing.

## Consequences

- **A fresh install is complete.** Install, claim it, write. Nothing is scheduled to be
  remembered, and nothing fails silently a week later.
- **The hosted profile has to say `CRON_INTERNAL=0`**, or it gives up scale-to-zero:
  [ADR 0021](0021-hosted-quire-ink-one-process-per-blog.md) is one process per blog, and a
  process with a 60-second timer never idles the way a sleeping one does. That is the real
  cost of this decision and it is paid by the deployment that has the scheduler anyway.
- **Two clocks are possible** if somebody keeps their crontab and does not set the variable.
  It is harmless — the sweeps are idempotent and the frequent one is a single indexed query
  — but the self-hosting guide now says which to keep.
- **The clock says so once.** A running clock and a stopped one looked identical from
  outside — the only evidence was the absence of the `clock off` line, which proves a timer
  was created and nothing about whether it ever fired. The first sweep now prints one line
  with what it did, and every sweep after it is silent. Added the same day this shipped,
  after the deployment check could only infer the answer.
- **The first full tick runs two minutes after boot**, not at boot: a restart loop would
  otherwise run backups and image sweeps on every crash. After that it is hourly, so a
  process that restarts more often than once an hour still gets its hourly work done.
