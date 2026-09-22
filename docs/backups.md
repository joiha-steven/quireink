# Backups, and the way out

There are **four backups**, and they answer different questions. Losing track of which is which
is how an install ends up with two copies of the same protection and none of another. There is
also a **fifth download that is not a backup at all** — the Markdown export, which answers "take
my writing somewhere else" and is [its own section below](#the-markdown-export-not-a-backup).

| | Where | Answers | Source |
|:--|:--|:--|:--|
| **Export** | the owner's own machine | "give me a copy I hold" | `GET /api/backup/export` |
| **Snapshots** | this server, on a schedule | "I broke something an hour ago" | [`src/server/backup.ts`](../src/server/backup.ts) |
| **Off-server, built in** | any S3-compatible bucket (R2, S3, MinIO) | "the machine is gone" | [`src/server/backup-offsite.ts`](../src/server/backup-offsite.ts) (ADR 0035) |
| **Off-server, ops script** | R2, hourly + daily tiers | the same, for a fleet running its own shipping | [`scripts/ops/quire-backup.sh`](../scripts/ops/quire-backup.sh) |

All four take the same `VACUUM INTO` snapshot of both databases plus the uploads tree. They
differ only in where the file ends up and who decides when — and, since 2.2.13, in whether it
is [sealed](#encryption) on the way out, which the first three inherit from one switch and the
ops script takes as a variable.

A sibling under the same env-var convention, [`scripts/ops/quire-uptime.sh`](../scripts/ops/quire-uptime.sh),
watches a list of URLs from cron and announces DOWN/UP through the same webhook file the
backup script uses. It is not a backup, but it answers the question every backup story
skips: who notices, and when. Run it from a machine that is not the one being watched.

The frozen tree backed up to the owner's Google Drive from inside the application, with an
OAuth flow, a `backup_state` table and a destructive in-app restore. 2.0 dropped all of it
(parity exception 1, [`spec/00-rationale.md`](spec/00-rationale.md)): backup is an operational
concern, it should keep working when the application does not, and an application that can
overwrite every table in itself is a bigger risk than the one it removes.

## Export, and snapshots

Both live in **Settings → Server & connections → Backups**, and both are owner-only.

**Export** builds an archive into a temp directory and streams it to the browser, sweeping
the directory when the stream ends or the reader cancels. It is deliberately not kept on the
server, so taking a copy never pushes a scheduled snapshot out of the retention window. ⚠ It
did not stream until 2026-09-07: both the build and the send read the whole archive into
memory, so an export held two copies of it and the hourly snapshot held one. With
`STORAGE_QUOTA_GB` at its default of 5 that is the difference between a backup and an
OOM-killed process, and the only trace was a restart in the log.

**Snapshots** are written to `BACKUP_DIR` (default `<DATA_DIR>/backups`) by the cron tick,
every `intervalDays`, keeping the newest `keep`. Those two fields have been in Settings
since the port and drove nothing until 2026-07-29; they pointed at the Google Drive
destination that had already been removed.

**On by default since 2026-08-29** (every 4 days, keep 4). It shipped off, which meant the
install that never opens Settings — precisely the one this product is for — ran with no
snapshot at all. An owner who saved settings while it was off keeps their stored `false`;
the default reaches only installs that never chose.

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

**Settings → Server & connections → Off-server copy.** Paste a bucket, an access key pair, and (for
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

**An upgrade takes one of its own, and it is not one of these four.** A boot with a pending
migration writes `backups/pre-<step>-<stamp>-quire.db` before it changes anything, keeps the
two most recent, and refuses to migrate if it cannot ([ADR 0063](decisions/0063-an-upgrade-copies-first-and-gives-the-space-back.md)).
It is a bare `VACUUM INTO` of the database — no uploads, no archive, no encryption — so it is
a floor under an upgrade rather than a backup, and it does not replace any of the four below.

**Both render caches are emptied out of the copy, not backed up** (2026-09-13;
`body_cache` joined `render_cache` there with ADR 0062). Each is a pure function of the
Markdown beside it, keyed by a hash of that Markdown, so a restore rebuilds them on the first
read of each post. What it cost to carry was not small: measured on the
author's blog, `quire.db` was 538 MB of which the cache was 530.3 MB, so **98.5% of every
archive was a derived artifact** and the archives had grown 185 → 229 → 253 → 263 MB over
four weeks in which almost nothing was written. That matters beyond disk: the archive is the
thing somebody downloads on their worst day, and 263 MB through a CDN with a request timeout
is a download that can fail where a 30 MB one cannot.

`.env` is deliberately NOT in the backup, and in 2.0 that costs nothing: it holds the port,
the data directory and the site URL, all of which are reconstructed by following
[`self-host.md`](./self-host.md). The two secrets it used to hold are not there any more —
the session signing secret is generated INTO the database (`auth/secret.ts`) and the SMTP
password lives in Settings, so both are inside the snapshot already. A restore therefore
brings its own sessions and its own mail server back with it.

> The names below match [`self-host.md`](./self-host.md): service `quire`, data
> `/var/lib/quire`. If you named your service something else, everything here is an
> environment variable; see [Instance configuration](#instance-configuration).

## Encryption

Off at install and off on upgrade. **Settings → Server & connections → Backups.**
[ADR 0060](./decisions/0060-the-archive-leaves-sealed.md) has the format and the argument.

### What it is for, and what it is not for

The paragraph above is the case for it: the session secret and the SMTP password are *inside*
the snapshot, and so are `users.totp_secret`, the AI key, the Cloudflare token, the S3 pair, the
fediverse actor's private key and every subscriber's address. The archive is also the one thing
here that leaves the machine — into a bucket, onto a laptop, into a cloud drive.

It is not encryption at rest for the blog. The live database is untouched, and a reader with
root on the box reads it whether this switch is on or off. What this closes is the copy that
travels.

### The two keys

Both are X25519 **public** halves, so this server can lock an archive and cannot open one. That
is the point rather than a detail: a passphrase kept on the box so that the schedule can run
unattended is a passphrase whoever owns the box now also has.

| | What it is | Where it lives |
|:--|:--|:--|
| **Identity** | generated when you set encryption up | shown **once**, on screen. Save it. Nothing on the server keeps a copy |
| **Passphrase** | typed once, at setup | nowhere. A keypair is derived from it with scrypt; the public half and the salt are kept, the words are not |

**Either one opens any sealed archive.** There are two because a file can be lost and a memory
can be forgotten, and one recipient would have introduced exactly the failure this feature
exists to prevent.

⚠️ **Lose both and a sealed archive cannot be opened, by you or by anybody.** There is no
recovery path, no support address and no back door. That is what makes it worth switching on.

### Opening one

Encrypted archives are named `quire-<tag>.tar.gz.enc` and begin with the word `QUIREBAK1`.

```sh
bun scripts/backup-decrypt.ts quire-<tag>.tar.gz.enc --identity key.txt
bun scripts/backup-decrypt.ts quire-<tag>.tar.gz.enc --passphrase
```

Either writes `quire-<tag>.tar.gz` beside it, and from there the restore below is unchanged.
The script ships inside the image and needs nothing running. If it is gone too, ADR 0060
describes the format completely enough to rebuild a reader from it — which is why it is written
out there rather than pointed at in code.

### The ops script

[`quire-backup.sh`](../scripts/ops/quire-backup.sh) takes its recipients from
`QUIRE_BACKUP_TO`, one or more public keys separated by spaces, exactly as the admin printed
them. Unset means it ships in the clear, as it always has. Only public halves belong in that
variable: the box can then seal an archive and cannot open one.

⚠️ It seals the **database tar** only. That script syncs uploads as a tree with `rclone` rather
than putting them in the archive, so the images go up as themselves. Use `rclone crypt` for those
if they matter, or use the built-in off-site copy, which puts everything in the one sealed file.

## Schedule and retention

- **Hourly** (`:17`) and **daily** (`20:40`). Both take the same snapshot; only the tag
  differs, and only the daily run applies retention.
- Hourly copies kept 3 days, daily copies 30 days, deleted uploads 7 days.
- One run at a time, held by `flock`. An hourly run overlapping the daily one would have
  both writing the same staging file.
- Failure posts to a webhook, if `QUIRE_ALERT_HOOK_FILE` names one. A backup that fails
  silently is not a backup. Point it at whatever already tells you when something breaks.

## Restoring

The same procedure for all four, because all four produce the same archive. The service
has to stop: copying a database under a running process is the torn-state problem the
backup itself avoids, in the other direction. That is also why there is no restore button.

```sh
# If the name ends .enc, open it first (see Encryption above):
#   bun scripts/backup-decrypt.ts quire-<tag>.tar.gz.enc --passphrase
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


## The Markdown export, which is not a backup

`GET /api/export/markdown` — **Settings → Server & connections → Backups**, the second key.
[ADR 0055](decisions/0055-the-writing-leaves-as-markdown.md);
[`src/server/export-md.ts`](../src/server/export-md.ts).

**It does not restore this blog, and nothing above carries the writing anywhere else.** That is
the whole distinction, and the reason the two sit in one card with two sentences under them:

| | Restores this install | Readable without Quire Ink |
|:--|:--|:--|
| the backup archive | yes | no |
| the Markdown bundle | no | yes |

A ZIP:

    posts/<slug>.md    every post, drafts included, trash excluded
    pages/<slug>.md
    notes/<slug>.md
    uploads/…          the blob store, file for file
    site.json          the settings, whole
    README.md          what the bundle is

**Image paths are left exactly as the body holds them** (`/uploads/media/photo.webp`), because
rewriting them would be lossy one way and unround-trippable the other. Put `uploads/` at a web
root and every picture resolves; the bundle's own README says so, in English, for whoever opens
it years from now.

**What is not in it:** revisions, comments, subscribers, analytics, the activity log, sessions,
and every credential. Keys live in `integration_keys` and passwords in `users`, neither of which
this module reads — `export-md.test.ts` plants three secrets and looks for them, with a
counter-test that a value which *should* be there is found by the same search.

**It comes back.** [`src/import/quireink.ts`](../src/import/quireink.ts) reads the bundle and is
wired into `POST /api/import/archive` as a fourth recognised shape, sniffed structurally
(`site.json` beside Markdown under `posts/`) like the Substack and Medium ones. That reader
exists so that "everything survives the round trip" is a test rather than a hope: a field added
to a post is a field the writer starts emitting, and without a reader nothing notices it cannot
be read back.

**The ZIP is written by us** — [`src/import/zip-write.ts`](../src/import/zip-write.ts), no
dependency, checked by the reader this repository already had for Substack and Medium. Text is
deflated; an upload is stored, because a webp is already compressed and a stored entry's size is
known before its header is written, which is what lets a large file stream. Zip64 is written only
when a field overflows; the entry-count branch is tested and the four-gigabyte one is not, which
[the test says out loud](../src/import/zip-write.test.ts).
