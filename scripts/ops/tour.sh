#!/usr/bin/env bash
# The whole tour from nothing: seed a throwaway instance, serve it, drive it, tear it down.
#
# THE COMMAND IS THE POINT, for the same reason `shoot-readme.sh` exists. A tour that needs six
# remembered steps is a tour nobody runs twice, and this one has a real trap in it: the seeder
# prints the owner's session cookie on its last line, and the admin half of the tour is a tour of
# the sign-in page without it.
#
#   scripts/ops/tour.sh
#   ONLY=admin scripts/ops/tour.sh      # just the flows whose name contains "admin"
#
# Env: CHROME / CHROME_HEADLESS_SHELL — the browser binary, as drive.ts and shot.ts expect.
#
# It never touches a real instance: its own DATA_DIR, its own uploads, its own port, all under
# `.tmp/` and all deleted on the way out. The tour DOES write — drafts, an upload, a settings
# round-trip — and every flow cleans up after itself, because a tour that leaves rows behind
# changes what the next run is testing.
set -euo pipefail
cd "$(dirname "$0")/../.."

TMP=.tmp/tour
PORT=${PORT:-3399}

# THE PORT MUST BE FREE, and this check is worth its five lines.
#
# 3399 is also the port a dev instance runs on. With one already bound, the tour's own server
# loses the bind and dies in the background, the health check below is answered by the OTHER
# instance, and forty flows then run against a database the tour never seeded. The reader-side
# half passes (same fixture), and all twenty-six admin flows fail 401 because the session the
# seeder minted belongs to a different database. Nothing says so: it reads as a real, specific
# regression, and it cost an hour of bisecting one before anybody checked what was on the port.
#
# `-sTCP:LISTEN`, and it is not a detail. Without it `lsof` matches ANY socket touching the
# port, including a browser's own CLOSED client connections to a dev server that has already
# been stopped — so the tour refused to start with nothing listening, and the message sent
# whoever read it hunting for a server that was not there. Refuse for a LISTENER, which is
# the thing that would actually steal the bind.
if lsof -ti:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "✗ port $PORT is already in use — stop it, or run with PORT=<free port>." >&2
  echo "  A tour on a busy port silently tours the OTHER instance and fails every admin flow." >&2
  exit 1
fi

rm -rf "$TMP"
mkdir -p "$TMP"

# Assets first: the server reads the island bundles and the admin SPA off disk, so a tour on a
# stale build is a tour of the last change rather than this one.
bun run build:assets >/dev/null
bun run build:admin >/dev/null

# STORAGE_LOCAL_DIR on the SEEDER too, and it is not decoration. Without it the seeder
# resolves `./uploads` (the repo's own) while the server below is told to serve
# "$TMP/uploads" — so every one of the twenty-one seeded pictures 404s for the whole tour,
# on every page that has one. Sixty flows passed anyway, because none of them asserts that
# an image loads, which is exactly how a hole like this stays open: the harness was blind
# to the thing it was standing in front of. Measured 2026-08-25.
SEED_OUT=$(STORAGE_LOCAL_DIR="$TMP/uploads" bun scripts/seed-showcase.ts "$TMP/data" 2>&1 | tail -3)
echo "$SEED_OUT" | sed 's/^/  seed: /'
SESSION=$(printf '%s' "$SEED_OUT" | sed -n 's/^QUIRE_SESSION=//p' | tail -1)
if [ -z "$SESSION" ]; then
  echo "✗ the seeder printed no QUIRE_SESSION — the admin flows would tour the login page" >&2
  exit 1
fi

# UPDATE_CHECK=0 because this IS a real server started the real way: since 2026-08-22 the
# check reports from a plain `bun src/index.ts` (that is the from-source install), and a tour
# would otherwise put a real request on check.quireink.com on every run.
DATA_DIR="$TMP/data" STORAGE_LOCAL_DIR="$TMP/uploads" PORT="$PORT" UPDATE_CHECK=0 \
  SITE_URL="http://127.0.0.1:$PORT" bun src/index.ts > "$TMP/server.log" 2>&1 &
SERVER=$!
# Kill the server whatever happens, including a failing tour: `set -e` plus a background process
# is how a stray `bun` ends up holding the port until somebody notices.
trap 'kill $SERVER 2>/dev/null || true; rm -rf "$TMP"' EXIT

for _ in $(seq 1 60); do
  if curl -fsS -o /dev/null "http://127.0.0.1:$PORT/api/health" 2>/dev/null; then break; fi
  sleep 0.25
done

status=0
QUIRE_SESSION="$SESSION" bun scripts/tour.ts "http://127.0.0.1:$PORT" || status=$?

# The browser cannot untar an archive or open a SQLite file, so the backup's other half runs
# here: the tour proves the export is gzip, this proves what is inside it would restore.
# Deliberately NOT gated on the tour passing — a red flow says nothing about the backup, and
# the one question worth never leaving unanswered is whether the owner's data comes back.
echo
QUIRE_SESSION="$SESSION" DATA_DIR="$TMP/data" STORAGE_LOCAL_DIR="$TMP/uploads" \
  bun scripts/restore-check.ts "http://127.0.0.1:$PORT" || status=$?

exit $status
