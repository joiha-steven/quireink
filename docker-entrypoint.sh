#!/bin/sh
# Make the mounted directories belong to whoever is going to write them, then stop being
# root. Nothing else.
#
# WHY THIS FILE EXISTS AT ALL, when the Dockerfile spent a paragraph explaining that it does
# not need one: the trick it describes — create and chown the directories IN the image, let
# Docker seed a fresh named volume from them, ownership included — is real and still does
# the work for `docker compose up`. It covers exactly one case, and that file says so: it
# "does NOT extend to bind mounts, which keep the host's ownership".
#
# Bind mounts are not an edge case for the audience this image is for. A Synology, a QNAP or
# an Unraid box mounts a real folder — `/volume1/docker/quireink/data` — because that is what
# their container UI offers and what their backup job can see. That folder belongs to root,
# the app runs as UID 1000, and MEASURED on a Linux daemon on 2026-08-21 the container does
# not degrade, it dies on boot:
#
#     SQLiteError: unable to open database file  (SQLITE_CANTOPEN)   → Exited (1)
#
# A stack trace through `bun:sqlite` is not a diagnosis anyone should have to make from a NAS
# web UI, and "chown 1000:1000 over SSH" is not an instruction that audience should need.
#
# PUID/PGID is the convention those users already know from the linuxserver.io images, so it
# is the one used here rather than a name of our own invention.
set -e

# Not root: there is nothing to adopt and nothing we are allowed to chown. This is the path
# `docker run --user 1000:1000` takes, and it behaves exactly as the image did before this
# file existed — no chown, no privilege drop, straight into the app.
if [ "$(id -u)" != 0 ]; then
  exec "$@"
fi

PUID="${PUID:-1000}"
PGID="${PGID:-1000}"

# ONLY when it is wrong, and that is a performance decision rather than a tidiness one: an
# uploads tree of a few hundred thousand files takes real minutes to walk on the small ARM
# box this is written for, and doing it on every restart would turn a container restart into
# an outage. The top directory's owner is the flag — first boot fixes the tree, later boots
# cost one stat each.
for dir in "$DATA_DIR" "$STORAGE_LOCAL_DIR"; do
  [ -n "$dir" ] || continue
  mkdir -p "$dir"
  if [ "$(stat -c %u "$dir")" != "$PUID" ] || [ "$(stat -c %g "$dir")" != "$PGID" ]; then
    echo "entrypoint: adopting $dir for ${PUID}:${PGID}"
    chown -R "$PUID:$PGID" "$dir"
  fi
done

# --clear-groups, not --init-groups: a NAS hands out UIDs like 1026 that have no entry in
# this image's /etc/passwd, and initgroups on an unknown user fails — which would turn a
# working PUID into a container that will not start. Nothing here needs a supplementary
# group. HOME follows the same logic: an arbitrary UID has no home in this image, and
# leaving it pointed at root's would be the one writable-by-nobody path in the process.
export HOME=/tmp
exec setpriv --reuid "$PUID" --regid "$PGID" --clear-groups -- "$@"
