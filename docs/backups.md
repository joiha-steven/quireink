# Backups

There are **three**, and they answer different questions. Losing track of which is which is
how an install ends up with two copies of the same protection and none of another.

| | Where | Answers | Source |
|:--|:--|:--|:--|
| **Export** | the owner's own machine | "give me a copy I hold" | `GET /api/backup/export` |
| **Snapshots** | this server, on a schedule | "I broke something an hour ago" | [`src/server/backup.ts`](../src/server/backup.ts) |
| **Off-server, built in** | any S3-compatible bucket (R2, S3, MinIO) | "the machine is gone" | [`src/server/backup-offsite.ts`](../src/server/backup-offsite.ts) (ADR 0035) |
| **Off-server, ops script** | R2, hourly + daily tiers | the same, for a fleet running its own shipping | [`scripts/ops/quire-backup.sh`](../scripts/ops/quire-backup.sh) |

All three take the same `VACUUM INTO` snapshot of both databases plus the uploads tree. They
differ only in where the file ends up and who decides when.

The frozen tree backed up to the owner's Google Drive from inside the application, with an
OAuth flow, a `backup_state` table and a destructive in-app restore. 2.0 dropped all of it
(parity exception 1, [`spec/00-rationale.md`](spec/00-rationale.md)): backup is an operational
concern, it should keep working when the application does not, and an application that can
overwrite every table in itself is a bigger risk than the one it removes.

## Export, and snapshots

Both live in **Settings → System → Backups**, and both are owner-only.

**Export** builds an archive into a temp directory and streams it to the browser. It is
deliberately not kept on the server, so taking a copy never pushes a scheduled snapshot out
of the retention window.

**Snapshots** are written to `BACKUP_DIR` (default `<DATA_DIR>/backups`) by the cron tick,
every `intervalDays`, keeping the newest `keep`. Those two fields have been in Settings
since the port and drove nothing until 2026-07-29; they pointed at the Google Drive
destination that had already been removed.

- **Due-ness is measured from the newest file on disk**, not from a recorded run time. There
  is no state table, so nothing can go stale, deleting every snapshot asks for a fresh one,
  and a machine restored from a copy does not believe it already has today's.
- **A snapshot cannot be restored from the admin**, and that is the design. Restoring means
  replacing the database files the running process holds open; doing it correctly means
  stopping the service, which is the shell procedure below. An application that can
  overwrite itself is the risk parity exception 1 removed, and it is not coming back through
  this door.
- Retention prunes **after** the new archive is written. Pruning first would use less peak
  disk and would delete a good backup to make room for one that then failed.
- **These are on the same disk as the thing they copy.** They survive a bad edit, a bad
  import and a bad delete. They do not survive the disk, which is what the off-server copy is
  for. The admin says so, in `exportReplicationNote`.

## Off-server, built in (ADR 0035)

**Settings → System → Off-server copy.** Paste a bucket, an access key pair, and (for
R2/MinIO) the endpoint — every archive the schedule or the "take one now" button writes is
also PUT into the bucket, and the remote copies are pruned to the same `keep` as the local
directory. Env fallbacks exist for a fleet: `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`,
`S3_PREFIX`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (the stored value wins).

What Google Drive got wrong is deliberately not repeated: no OAuth, no state table, **no
in-app restore** — the bucket is written and pruned, never read back into the application;
restoring from it means downloading the archive and following [Restoring](#restoring)
exactly as for a local snapshot. A failed upload is logged (`backup.offsite` in the
activity log) and never fails the backup: the local archive is already on disk. Pruning
touches only keys under this blog's prefix whose basename is a snapshot name, so a shared
bucket keeps everything else it holds. The **Test** button writes and deletes one marker
object — a wrong paste is found while you are at the keyboard.

## Off-server, the ops script

Everything below is the cron script beside the process — for a fleet that already runs its
own shipping, alerting and retention tiers. The two paths write the same archives and do
not know about each other; running both against one bucket is harmless but pointless.

## What it copies

| | How | Why that way |
|---|---|---|
| `quire.db`, `analytics.db` | `VACUUM INTO` a temporary file, then `tar -czf` | **Never a file copy.** A live SQLite database has a write-ahead log, and copying the file can capture a torn state that only reveals itself on restore |
| `uploads/` | `rclone sync` with `--backup-dir` | A deleted or overwritten file stays recoverable for 7 days instead of vanishing on the next run |

`.env` is deliberately NOT in the backup, and in 2.0 that costs nothing: it holds the port,
the data directory and the site URL, all of which are reconstructed by following
[`self-host.md`](./self-host.md). The two secrets it used to hold are not there any more —
the session signing secret is generated INTO the database (`auth/secret.ts`) and the SMTP
password lives in Settings, so both are inside the snapshot already. A restore therefore
brings its own sessions and its own mail server back with it.

> The names below match [`self-host.md`](./self-host.md): service `quire`, data
> `/var/lib/quire`. They used to disagree — the script defaulted to `quire2`, one
> installation's service name — and reading both and mixing them gave you a backup pointed at
> a directory that does not exist. If you named your service something else, everything here
> is an environment variable; see [Instance configuration](#instance-configuration).

## Schedule and retention

- **Hourly** (`:17`) and **daily** (`20:40`). Both take the same snapshot; only the tag
  differs, and only the daily run applies retention.
- Hourly copies kept 3 days, daily copies 30 days, deleted uploads 7 days.
- One run at a time, held by `flock`. An hourly run overlapping the daily one would have
  both writing the same staging file.
- Failure posts to a webhook, if `QUIRE_ALERT_HOOK_FILE` names one. A backup that fails
  silently is not a backup. Point it at whatever already tells you when something breaks.

## Restoring

The same procedure for all three, because all three produce the same archive. The service
has to stop: copying a database under a running process is the torn-state problem the
backup itself avoids, in the other direction. That is also why there is no restore button.

```sh
tar -xzf quire-<tag>.tar.gz -C /tmp/restore
sqlite3 /tmp/restore/quire.db 'pragma integrity_check;'   # expect: ok
sqlite3 /tmp/restore/quire.db 'select count(*) from posts;'
systemctl stop quire && cp /tmp/restore/*.db /var/lib/quire/data/ && systemctl start quire
```

> Archives written before 2026-08-01 are named `quire2-<tag>.tar.gz`. Same contents; only the
> prefix changed when the script stopped being named after one installation.

**Do this on a schedule, not only when something is on fire.** Run the two `sqlite3` lines
above against a real archive and check the post count against what the site actually shows:
an untested backup is a belief, not a backup.

### The same questions, asked automatically

`bun run tour` ends with [`scripts/restore-check.ts`](../scripts/restore-check.ts), which
takes the export from a throwaway instance and asks what the lines above ask: both databases
pass `integrity_check`, no table came back with fewer rows than it had before the snapshot,
and every upload is byte-identical. It uploads one image first, because the seeded fixture
writes `media` ROWS and no files — without that, the uploads assertion passes over an empty
directory forever, which reads as coverage and is not.

It is not a substitute for restoring a REAL archive onto a real machine. It is the part that
can run on every change, so that the part that cannot is the only one left to remember.

## Instance configuration

One block at the top of the script, and the only part worth reading before installing it
somewhere else. Every value is `${QUIRE_…:-default}`, so it can be set in the file, in the
crontab, or in a systemd `EnvironmentFile` — whichever the machine already uses.

| | Default |
|:--|:--|
| `QUIRE_DATA` / `QUIRE_UPLOADS` | `/var/lib/quire/{data,uploads}` |
| `QUIRE_BUN` | `$HOME/.bun/bin/bun` |
| `QUIRE_BACKUP_REMOTE` | **none — the run stops without it.** An rclone remote and a path, e.g. `r2:my-bucket/my-blog` |
| `QUIRE_BACKUP_STAGE` / `_LOG` / `_LOCK` | `/var/tmp/quire-backup`, `/var/log/quire-backup.log`, `/var/lock/quire-backup.lock` |
| `QUIRE_ALERT_HOOK_FILE` | `/etc/quire/alert-webhook` — a file holding one URL. Absent, a failure is logged and not announced |
| `QUIRE_ALERT_ALIAS` | `quire backup` — what this installation calls itself in that alert |

**Running more than one blog on a server: install the script once, and give each instance its
own crontab with its own `QUIRE_*` block.** Set all four of `_REMOTE`, `_STAGE`, `_LOG` and
`_LOCK` per instance — sharing a lock means one blog's backup silently skips because the
other holds it, and sharing a staging path means they overwrite each other's archive.
Copying the script per instance also works and is what happens by accident; then a fix
lands on one copy and not the other, which is exactly how the two diverged here.

They are variables rather than literals because **this repository is public**. A script that
names somebody's data directory, their bucket and their alert endpoint publishes all three
to everyone who reads it.
