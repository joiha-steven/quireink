# 0035 — The snapshot leaves the machine

Date: 2026-08-27
Status: accepted

## Context

A snapshot beside its data answers "I broke something an hour ago" and says nothing to
"the machine is gone" — and machines go. The off-box answer was real but external: an ops
script (`scripts/ops/quire-backup.sh`) with a crontab, written for this project's own
fleet, documented in `docs/backups.md`, and never once installed by anyone who arrived
through `install.sh`. The install-and-it-works arc (the clock, ADR 0031; the comment gate,
ADR 0032; the purge, ADR 0033) had one door left where the software's answer was "now go
write a cron job": the one protecting everything the owner ever wrote.

Parity exception 1 is why it was outside. 2.0 dropped Google Drive backup deliberately: an
OAuth flow, a state table, and — the real danger — an in-app restore that could overwrite
every table in the running process.

## Decision

**The shipping moves in; the restore stays out.** Every archive the schedule or the
"take one now" button writes is also PUT into any S3-compatible bucket — R2, S3, MinIO,
one protocol — and the remote copies are pruned to the same `keep` as the local directory.
`server/backup-offsite.ts` needs three verbs (write, list, delete) and Bun's own S3 client
provides them: no SDK, no new dependency.

What Google Drive got wrong is not repeated:

- **No OAuth, no state table.** Four pasted values (endpoint optional — empty is AWS;
  region optional — empty is R2's `auto`), stored in `integration_keys` like every other
  secret, env fallbacks for the fleet case. Due-ness still derives from the newest file on
  disk; the bucket holds copies, never state.
- **No in-app restore.** Restore remains a shell act on a stopped service. The bucket is
  written and pruned, never read back into the application.
- **A failed upload never fails the backup.** The local archive is already on disk and is
  the likelier one to be needed; the failure is logged (`backup.offsite`) where the owner
  reads, not thrown where the tick would die.
- **Pruning trusts nothing but its own shape.** Only keys under this blog's prefix whose
  basename is a snapshot name are counted or deleted, so a shared bucket keeps everything
  else it holds.
- **A Test button** writes and deletes one marker object, so a wrong paste is discovered
  while the owner is at the keyboard, not on the day of the fire.

The ops script stays, for fleets that already run their own shipping and alerting; the two
paths write the same archives and do not know about each other.

## Consequences

- The last "now go write a cron job" in the product is gone: a one-command install can be
  fully protected by pasting four values from the R2 dashboard.
- Retention in the bucket mirrors `keep`. An owner who wants deeper offsite history than
  local history has one number to raise — or the ops script, which keeps hourly/daily tiers.
- The upload happens inside the backup run, so an hourly tick can hold a connection for as
  long as a full archive takes to travel. Backups default to daily; the tick already runs
  jobs of this size (image variants, the archive itself).
