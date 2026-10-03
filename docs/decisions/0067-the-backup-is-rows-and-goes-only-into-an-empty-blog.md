# 0067 — The backup is rows, and it is loaded only into an empty blog

Date: 2026-10-03
Status: accepted; amends [0060](0060-the-archive-leaves-sealed.md) (what is inside the archive) and [0035](0035-the-snapshot-leaves-the-machine.md) (how a restore happens)
In force: see the [index](README.md). The index is maintained; this file is not.

## The problem

The archive is a tar of `quire.db` and `analytics.db`, each taken with `VACUUM INTO`, plus the
uploads. `restore-check` opens it with `pragma integrity_check`. On Cloudflare
([0066](0066-cloudflare-is-a-second-runtime.md)) a Durable Object refuses both: `VACUUM` fails
inside the transaction every statement runs in, and `integrity_check` is not authorised. There is
no file to copy and no shell to copy it with.

Rebuilding a SQLite file inside the Durable Object with a WASM SQLite was the other road. It keeps
today's format, and it puts the whole database in memory beside a ~46 MB heap under a 128 MB
limit: a blog with two million analytics events could not be backed up at all.

There is also a rule to keep. [0035](0035-the-snapshot-leaves-the-machine.md) and
`docs/backups.md` say a snapshot cannot be restored from the admin, and why: restoring means
replacing the database a running process holds open, and an application that can overwrite itself
is the risk that parity exception 1 removed. Cloudflare has no shell, so "stop the service and copy
the files" has no equivalent there.

## The decision

1. **The archive holds rows, not database files, on both runtimes.** One stream per table, written
   row by row, so its size is never bounded by memory. Uploads are carried as today. The archive is
   still a tar, and still sealed exactly as [0060](0060-the-archive-leaves-sealed.md) describes; only
   what sits inside the seal changes. One writer, in plain JS, serves both runtimes.
2. **Restoring reads both formats.** `scripts/restore.ts` rebuilds the two databases from either an
   old file-based archive or a new row-based one, offline, on a stopped service — the shell procedure
   in `docs/backups.md`, with one command where `cp` used to be.
3. **`restore-check` checks rows**: every table's count and a hash of its rows, before the snapshot
   and after the restore. That is a stronger statement than `integrity_check`, which proves a file is
   a valid database and says nothing about whether it holds what was written.
4. **A backup is loaded into a running Quire Ink only when that blog is empty**, from the first setup
   screen, on both runtimes. Nothing is ever overwritten, so 0035's reason stands untouched: the
   application still cannot replace a database it already holds. Moving a blog from Bun to
   Cloudflare, or the reverse, is this: a fresh install, and the backup loaded into it.
5. **Recovering a live Cloudflare blog from a mistake is Cloudflare's point-in-time restore** (any
   moment in the last 30 days), outside the application, the way recovering a VPS from a bad
   `rm` is the operator's job and not the blog's.

## What it costs

- A row-based archive is larger than a compressed SQLite file before compression, and about the same
  after it; it is slower to restore by hand, because the databases are rebuilt instead of copied.
- `docs/backups.md`, `restore-check`, the offsite upload and the tour's backup flows all change in the
  same piece of work, and the old format must stay readable for as long as old archives exist.
