# Backups

There are **three**, and they answer different questions. Losing track of which is which is
how an install ends up with two copies of the same protection and none of another.

| | Where | Answers | Source |
|:--|:--|:--|:--|
| **Export** | the owner's own machine | "give me a copy I hold" | `GET /api/backup/export` |
| **Snapshots** | this server, on a schedule | "I broke something an hour ago" | [`src/server/backup.ts`](../src/server/backup.ts) |
| **Off-box** | R2, hourly + daily | "the machine is gone" | [`scripts/ops/quire2-backup.sh`](../scripts/ops/quire2-backup.sh) |

All three take the same `VACUUM INTO` snapshot of both databases plus the uploads tree. They
differ only in where the file ends up and who decides when.

The frozen tree backed up to the owner's Google Drive from inside the application, with an
OAuth flow, a `backup_state` table and a destructive in-app restore. 2.0 dropped all of it
(parity exception 1, [`spec/07-parity.md`](spec/07-parity.md)): backup is an operational
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
  import and a bad delete. They do not survive the disk, which is what the off-box copy is
  for. The admin says so, in `exportReplicationNote`.

## Off-box

Everything below is the cron script beside the process, and it is the one that happens
whether or not anyone remembers.

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

> The service name and paths below (`quire2`, `/var/lib/quire2`) are **this installation's**,
> because they are the defaults compiled into the script that runs on this box.
> [`self-host.md`](./self-host.md) uses the generic `quire` and `/var/lib/quire`. Reading both
> and mixing them gives you a backup pointed at a directory that does not exist; take the
> names from whichever one you actually followed. Making the script read them from an env file
> instead is queued.

## Schedule and retention

- **Hourly** (`:17`) and **daily** (`20:40`). Both take the same snapshot; only the tag
  differs, and only the daily run applies retention.
- Hourly copies kept 3 days, daily copies 30 days, deleted uploads 7 days.
- One run at a time, held by `flock`. An hourly run overlapping the daily one would have
  both writing the same staging file.
- Failure posts to the alert webhook the other backups on the box already use. A backup
  that fails silently is not a backup.

## Restoring

The same procedure for all three, because all three produce the same archive. The service
has to stop: copying a database under a running process is the torn-state problem the
backup itself avoids, in the other direction. That is also why there is no restore button.

```sh
tar -xzf quire2-<tag>.tar.gz -C /tmp/restore
sqlite3 /tmp/restore/quire.db 'pragma integrity_check;'   # expect: ok
sqlite3 /tmp/restore/quire.db 'select count(*) from posts;'
systemctl stop quire2 && cp /tmp/restore/*.db /var/lib/quire2/data/ && systemctl start quire2
```

**Do this on a schedule, not only when something is on fire.** The restore was exercised
end to end when the script was installed — `integrity_check: ok`, 74 posts, 4 pages — and
an untested backup is a belief, not a backup.

## Instance configuration

One block at the top of the script, and the only part worth reading before installing it
somewhere else. Every value is `${QUIRE_…:-default}`, so it can be set in the file, in the
crontab, or in a systemd `EnvironmentFile` — whichever the machine already uses.

| | Default |
|:--|:--|
| `QUIRE_DATA` / `QUIRE_UPLOADS` | `/var/lib/quire2/{data,uploads}` |
| `QUIRE_BUN` | `$HOME/.bun/bin/bun` |
| `QUIRE_BACKUP_REMOTE` | **none — the run stops without it.** An rclone remote and a path, e.g. `r2:my-bucket/quire2` |
| `QUIRE_BACKUP_STAGE` / `_LOG` / `_LOCK` | `/var/tmp/quire2-backup`, `/var/log/quire2-backup.log`, `/var/lock/quire2-backup.lock` |
| `QUIRE_ALERT_HOOK_FILE` | `/etc/quire2/alert-webhook` — a file holding one URL. Absent, a failure is logged and not announced |
| `QUIRE_ALERT_ALIAS` | `quire2 backup` — what this installation calls itself in that alert |

They are variables rather than literals because **this repository is public**. A script that
names somebody's data directory, their bucket and their alert endpoint publishes all three
to everyone who reads it.
