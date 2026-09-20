#!/usr/bin/env bash
# Off-box backup for Quire Ink: both SQLite databases and the uploads tree, to R2.
#
# ONE script, any number of instances. Every value that describes an installation is an
# environment variable, so two blogs on the same box run the same file with two crontabs.
# It was called `quire2-backup.sh` and defaulted to `/var/lib/quire2` until 2026-08-01,
# which is one installation's service name on a script the whole world can read; worse, it
# invited a second copy per instance, and a second copy is what actually happened.
#
# This is parity exception 1 made real. Google Drive backup was dropped on the argument that
# replication would replace it, and until this ran the only copy of everything the owner had
# written lived in one directory on one machine.
#
# If the box already backs up other things, resist bolting this onto that script. A working,
# monitored backup is worth more than a tidy one, and adding an engine to it puts what already
# works at risk to save a file. Point this at the same remote and the same alert hook instead;
# that is all the sharing worth having.
#
#   Databases : VACUUM INTO, never a file copy. A live SQLite database has a write-ahead log
#               and copying the file can capture a torn state that only fails on restore.
#   Uploads   : rclone sync with --backup-dir, so a deleted file is recoverable for 7 days.
#   Retention : hourly copies for 3 days, daily copies for 30.
#
# Install once per BOX, then one crontab per instance:
#   install -m 755 quire-backup.sh /usr/local/bin/
#   /etc/cron.d/<instance>-backup, with the QUIRE_* names below set at the top of the file:
#     17 * * * * root /usr/local/bin/quire-backup.sh
#     40 20 * * * root /usr/local/bin/quire-backup.sh daily

set -uo pipefail

# ---- this machine ------------------------------------------------------------
# Everything that describes ONE installation. Set them here, or in the environment, and
# nothing below needs reading. They are variables rather than literals because this file
# is in a public repository: a script that names somebody's data directory, their bucket
# and their alert endpoint publishes all three to everyone who reads it.
DATA="${QUIRE_DATA:-/var/lib/quire/data}"
UPLOADS="${QUIRE_UPLOADS:-/var/lib/quire/uploads}"
BUN="${QUIRE_BUN:-$HOME/.bun/bin/bun}"
# Where the checkout is, needed only to reach `scripts/backup-decrypt.ts` when sealing.
APP="${QUIRE_APP:-/home/quire/app}"
# One or more PUBLIC keys, space separated, as the Backups card printed them. Empty means the
# archive goes up in the clear, which is what this script has always done. Only public halves
# belong here: this box can then lock an archive and cannot open one (ADR 0060).
BACKUP_TO="${QUIRE_BACKUP_TO:-}"
# An rclone remote and a path under it: `rclone config` names the remote, this points into
# it. There is no default worth guessing, so an unset value stops the run.
REMOTE="${QUIRE_BACKUP_REMOTE:?set QUIRE_BACKUP_REMOTE, e.g. r2:my-bucket/my-blog}"
# Per instance, all four, or two blogs on one box will fight over a lock and a log file.
STAGE="${QUIRE_BACKUP_STAGE:-/var/tmp/quire-backup}"
LOG="${QUIRE_BACKUP_LOG:-/var/log/quire-backup.log}"
LOCK="${QUIRE_BACKUP_LOCK:-/var/lock/quire-backup.lock}"
# A file holding one webhook URL. Absent, a failure is logged and not announced.
ALERT_HOOK_FILE="${QUIRE_ALERT_HOOK_FILE:-/etc/quire/alert-webhook}"
# The name this installation calls itself in an alert.
ALERT_ALIAS="${QUIRE_ALERT_ALIAS:-quire backup}"
# ------------------------------------------------------------------------------

MODE="${1:-hourly}"
TAG="$(date +%Y%m%d-%H%M)"
[ "$MODE" = daily ] && TAG="$(date +%Y%m%d)-daily"

mkdir -p "$STAGE" "$(dirname "$LOG")"
log(){ echo "[$(date +'%F %T')] $*" >>"$LOG"; }

fail(){
  log "FAIL: $*"
  local url; url="$(cat "$ALERT_HOOK_FILE" 2>/dev/null)" || true
  if [ -n "${url:-}" ] && command -v jq >/dev/null 2>&1; then
    jq -n --arg a "$ALERT_ALIAS" --arg t ":red_circle: *$ALERT_ALIAS* FAIL" --arg d "$1" \
      '{alias:$a,emoji:":floppy_disk:",text:$t,attachments:[{color:"#e01b1b",text:$d}]}' \
      | curl -sS -m 15 -X POST -H 'Content-Type: application/json' --data @- "$url" >/dev/null 2>&1 || true
  fi
  exit 1
}

# One at a time. An hourly run overlapping the daily one would have them both writing the
# same staging file.
exec 9>"$LOCK" || fail "lock"
flock -n 9 || { log "another run holds the lock; skipping"; exit 0; }

ARCHIVE="$STAGE/quire-${TAG}.tar.gz"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP" "$ARCHIVE"' EXIT

for db in "$DATA"/*.db; do
  [ -e "$db" ] || continue
  # Paths go in through the ENVIRONMENT, not argv: `bun -e` starts its arguments at argv[1],
  # so reading them from argv[2] handed the database an undefined path.
  SRC="$db" DEST="$TMP/$(basename "$db")" "$BUN" -e \
    'import{Database}from"bun:sqlite";const d=new Database(process.env.SRC,{readonly:true});d.exec(`vacuum into ${JSON.stringify(process.env.DEST)}`);d.close()' \
    2>>"$LOG" || fail "vacuum $(basename "$db")"
done
[ -n "$(ls -A "$TMP")" ] || fail "no databases found in $DATA"

# SEALED, WHEN THE OPERATOR HAS SAID SO (ADR 0060).
#
# QUIRE_BACKUP_TO holds one or more public keys, space separated, exactly as the admin's
# Backups card printed them. Only PUBLIC halves are ever named here: this script can lock an
# archive and cannot open one, which is the property worth having on a box running cron.
#
# A PIPE, not a second file. The tar is the whole blob store and this runs on the machine that
# is already short of disk; staging a plaintext copy first would also leave one lying in $STAGE
# for as long as the encrypt took.
#
# ⚠️ `set -o pipefail` IS ALREADY ON at the top of this file, which is what makes `|| fail`
# below see a tar that died mid-stream. Without it the exit status would be bun's alone and a
# truncated archive would ship reporting success.
if [ -n "$BACKUP_TO" ]; then
  ARCHIVE="$STAGE/quire-${TAG}.tar.gz.enc"
  REMOTE_NAME="quire-${TAG}.tar.gz.enc"
  # shellcheck disable=SC2086
  TO=""; for k in $BACKUP_TO; do TO="$TO --to $k"; done
  # shellcheck disable=SC2086
  tar -C "$TMP" -cz . 2>>"$LOG" \
    | "$BUN" "$APP/scripts/backup-decrypt.ts" --encrypt $TO > "$ARCHIVE" 2>>"$LOG" \
    || fail "tar | encrypt"
else
  REMOTE_NAME="quire-${TAG}.tar.gz"
  tar -C "$TMP" -czf "$ARCHIVE" . 2>>"$LOG" || fail "tar"
fi
rclone copyto "$ARCHIVE" "$REMOTE/db/$REMOTE_NAME" 2>>"$LOG" || fail "rclone db"
log "db ($TAG) -> $(du -h "$ARCHIVE" | cut -f1)"

if [ -d "$UPLOADS" ]; then
  rclone sync "$UPLOADS" "$REMOTE/uploads/current" \
    --backup-dir "$REMOTE/uploads/_archive/$(date +%Y%m%d)" \
    --transfers 32 --checkers 64 --fast-list --retries 4 2>>"$LOG" || fail "rclone uploads"
  log "uploads synced"
fi

# Retention, on the daily run only: hourly copies for 3 days, dailies for 30, and a deleted
# upload recoverable for 7.
if [ "$MODE" = daily ]; then
  rclone delete "$REMOTE/db/" --min-age 3d  --exclude "*-daily.tar.gz" 2>>"$LOG" || true
  rclone delete "$REMOTE/db/" --min-age 30d --include "*-daily.tar.gz" 2>>"$LOG" || true
  rclone delete "$REMOTE/uploads/_archive/" --min-age 7d 2>>"$LOG" || true
  rclone rmdirs "$REMOTE/uploads/_archive/" --leave-root 2>>"$LOG" || true
fi

log "ok ($MODE)"
