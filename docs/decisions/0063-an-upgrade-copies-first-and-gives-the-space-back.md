# 0063 — An upgrade copies the database before it changes it, and gives the space back after

Date: 2026-09-22
Status: accepted
In force: see the [index](README.md). The index is maintained; this file is not.

## The problem

Two halves of the same sentence, both found while shipping ADR 0062.

**Nothing takes a copy before a migration runs.** The schema is applied at boot, migrations
run against whatever the operator already had, and the only protection is a line in
`self-host-docker.md` telling them to take a backup first. That is a rule kept by memory, on
somebody else's machine, on the one day it matters. This product does not accept that
anywhere else: the reason `check.py`, `check:docs` and the restore check exist is that a rule
a machine can hold should not be left to a person.

**And nothing gives the space back.** SQLite does not return freed pages to the operating
system; they go on a freelist and wait to be reused. After the 0062 migration, measured on a
copy of a real 618 MB database, **148,824 of 150,985 pages are free** — the live content is
8.9 MB and the file is still 618 MB. Someone who upgrades, reads a changelog entry about half
a gigabyte of dead cache, and then looks at their disk, sees the same number as yesterday.
They would be right to conclude it did not work.

## The decision

**A pending migration on an existing database writes a copy first.** `VACUUM INTO`, into
`<data>/backups/`, named for the first step it is about to run. Measured: **85 ms**, and
8,847,360 B out of that 618 MB file. Fresh databases skip it — there is nothing to protect.

**If the copy cannot be written, the migration does not run and the process exits.** No
environment variable turns this off, deliberately. An escape hatch here is a thing set once
during an unrelated emergency and never unset, and the only effect of setting it is to remove
the protection on the day something needs protecting. Every cause of a failed copy — a full
disk, a read-only mount, wrong ownership on the data directory — is also a reason not to
change the shape of somebody's database, and all three are fixable in a minute by the person
who sees the message.

**Two copies are kept.** The one from this upgrade and the one before it, because a person
who upgrades twice on a bad afternoon may not notice until the second. Older ones are deleted
as they are made. An upgrade that leaves a file behind every time is the garbage this ADR
exists to be against, and the scheduled snapshots in `backups.md` are what covers the longer
history.

**When migrations leave the file mostly empty, it is compacted once.** Only after a migration
actually ran in this boot, and only when the freelist is over a quarter of the file AND more
than 64 MB — so an ordinary upgrade on an ordinary blog does nothing at all. `VACUUM INTO` a
temporary file, `integrity_check` it, close the database so SQLite retires its `-wal` and
`-shm` cleanly, rename, reopen.

⚠️ **Rename, and never `VACUUM` in place.** The repository has carried "there is deliberately
no VACUUM" in `render-cache.ts` since the sweep was written, and the reason is that a VACUUM
has cost this project a database before. A rename is atomic on POSIX; a crash before it
leaves the original file fully checkpointed and untouched; a crash after it leaves a file that
was verified before it was moved. Nothing is deleted until the replacement has passed
`integrity_check`.

## Consequences

- A self-hoster's upgrade is unchanged to type and now takes a copy on the way through. On
  the measured database that is 85 ms and 8.8 MB.
- An upgrade that cannot write that copy **fails loudly at boot** instead of proceeding.
  The message names the path and the reason; the blog does not start until it is fixed.
- The 0062 upgrade returns the disk: 618 MB becomes about 9 MB on the first boot after it.
- Two files live in `<data>/backups/` that did not before, and are replaced rather than
  accumulated.
- The compaction reopens the database once at boot, before anything is served.

## What would make us change our mind

**A database where the copy is not cheap.** `VACUUM INTO` writes the live content, so the
cost is the blog's own size: 8.8 MB here because a post is text. An instance that put large
binaries in SQLite rather than on the filesystem would make this a minute rather than a
moment, and the answer would then be a copy the operator schedules rather than one the boot
takes. Binaries are store-relative files today ([ADR 0022](0022-ship-from-source-not-a-compiled-binary.md),
`collapseBlob`), so this holds while that does.

**Refusing to boot turning out to strand people.** The reasoning above says every cause is
fixable in a minute. If real reports say otherwise — a hosting panel that cannot chown a
volume, say — the answer is to make the copy land somewhere else, not to make it optional.
