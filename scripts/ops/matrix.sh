#!/usr/bin/env bash
# The release matrix (ADR 0065): install this commit, and upgrade to it from the release before,
# through each package, and smoke-test what comes up.
#
#   scripts/ops/matrix.sh source-fresh | source-upgrade | docker-fresh | docker-upgrade | server-http | cloudflare-dev
#
# `server-http` runs server.sh for real, so it needs a disposable Linux machine with sudo: a CI
# runner, never a workstation. It writes /opt/quireink and /var/lib/quireink and removes them.
#
# `cloudflare-dev` is the Cloudflare package under `wrangler dev`: a Bun blog moved into the real
# worker through `/setup/restore`, crawled against Bun page by page, toured in full (286 flows on
# 2026-10-03) and smoked like the rest (`scripts/ops/cloudflare-dev.ts`). It builds this tree; installing it on Cloudflare for real is L10, from the release manager's machine.
#
# Run from the repository root, with the tags fetched (`git fetch --tags`). Each cell builds its
# own world under a temporary directory and tears it down, so cells can run side by side.
#
# WHAT "THIS COMMIT" IS. On a tag (`vX.Y.Z` pointing at HEAD) it is that release. Anywhere else
# there is no release to install, so the cell makes one: a scratch commit on top of HEAD whose
# only change is the version, set to 9999.0.0, tagged in a throwaway copy of the repository that
# plays the remote. Nothing is pushed; the real repository is only read. The release before is
# the newest real tag older than "this commit".
#
# THE OLD DATA IS WRITTEN BY THE OLD CODE. An upgrade cell seeds its blog with the seeder of the
# release it upgrades FROM, because that is what an owner actually has on disk; seeding with
# today's seeder would test an upgrade nobody performs.
set -euo pipefail

CELL=${1:?usage: matrix.sh source-fresh|source-upgrade|docker-fresh|docker-upgrade|server-http|cloudflare-dev}
REPO=$(pwd)
[ -f "$REPO/install.sh" ] || { echo "run from the repository root" >&2; exit 2; }
WORK=$(mktemp -d "${TMPDIR:-/tmp}/quire-matrix-XXXXXX")
CODE=matrix-setup-code-0123
PIDS=()
CONTAINERS=()

cleanup() {
  local status=$?
  # A red cell says WHY: the last of every log it started, before the evidence is deleted.
  if [ "$status" -ne 0 ]; then
    for c in "${CONTAINERS[@]:-}"; do [ -n "$c" ] && { echo "--- docker logs $c" >&2; docker logs --tail 80 "$c" >&2 2>&1 || true; }; done
    for f in "$WORK"/*/server.log; do [ -f "$f" ] && { echo "--- $f" >&2; tail -n 80 "$f" >&2; }; done
  fi
  for p in "${PIDS[@]:-}"; do [ -n "$p" ] && kill "$p" 2>/dev/null || true; done
  for c in "${CONTAINERS[@]:-}"; do [ -n "$c" ] && docker rm -f "$c" >/dev/null 2>&1 || true; done
  if [ "${KEEP:-}" = "1" ]; then echo "kept: $WORK" >&2; else rm -rf "$WORK" 2>/dev/null || true; fi
}
trap cleanup EXIT

say() { printf '\n\033[1m[%s] %s\033[0m\n' "$CELL" "$*"; }
version_of() { sed -n 's/^  "version": "\([^"]*\)".*/\1/p' "$1/package.json" | head -n 1; }
older_than() { # newest X.Y.Z tag strictly older than $1
  git -C "$REPO" tag --list 'v*' | sed -n 's/^v\([0-9]*\.[0-9]*\.[0-9]*\)$/\1/p' \
    | sort -t. -k1,1n -k2,2n -k3,3n | awk -v n="$1" '
      function lt(a, b,   x, y, i) { split(a, x, "."); split(b, y, ".");
        for (i = 1; i <= 3; i++) { if (x[i] + 0 < y[i] + 0) return 1; if (x[i] + 0 > y[i] + 0) return 0 } return 0 }
      lt($0, n) { last = $0 } END { print last }'
}

# --- the remote, with "this commit" as its newest release -----------------------------------

say "preparing the remote"
git clone --quiet "$REPO" "$WORK/next"
git -C "$WORK/next" checkout --quiet --detach "$(git -C "$REPO" rev-parse HEAD)"
HEAD_VERSION=$(version_of "$WORK/next")
if git -C "$REPO" tag --points-at HEAD | grep -qx "v$HEAD_VERSION"; then
  NEXT=$HEAD_VERSION
else
  NEXT=9999.0.0
  sed -i.bak "s/^  \"version\": \"$HEAD_VERSION\"/  \"version\": \"$NEXT\"/" "$WORK/next/package.json"
  rm -f "$WORK/next/package.json.bak"
  git -C "$WORK/next" -c user.name=matrix -c user.email=matrix@localhost commit --quiet -am "matrix: $NEXT"
  git -C "$WORK/next" tag "v$NEXT"
fi
git clone --quiet --bare "$WORK/next" "$WORK/remote.git"
for t in $(git -C "$REPO" tag --list 'v*'); do git -C "$WORK/remote.git" fetch --quiet "$REPO" "refs/tags/$t:refs/tags/$t" 2>/dev/null || true; done
PREV=$(older_than "$NEXT")
echo "  this commit installs as $NEXT; the release before it is ${PREV:-none}"

# --- helpers -------------------------------------------------------------------------------

# Start a checkout as a blog, in the background, on a port. Writes its pid to <dir>/.pid.
serve_source() { # dir port [extra env...]
  local dir=$1 port=$2; shift 2
  # `exec`, so the background job IS bun and its pid is the one to kill. `cd x && bun … &` would
  # background the whole list, and `$!` would be a subshell that dies leaving bun on the port.
  ( cd "$dir" && exec env DATA_DIR=./data STORAGE_LOCAL_DIR=./uploads PORT="$port" UPDATE_CHECK=0 \
      SITE_URL="http://127.0.0.1:$port" "$@" bun src/index.ts > "$dir/server.log" 2>&1 ) &
  echo $! > "$dir/.pid"
  PIDS+=("$!")
}
stop_source() { # and wait until the port is free, or the next start fails to bind
  local pid; pid=$(cat "$1/.pid"); kill "$pid" 2>/dev/null || true
  for _ in $(seq 1 50); do kill -0 "$pid" 2>/dev/null || return 0; sleep 0.2; done
  kill -9 "$pid" 2>/dev/null || true
}

seed() { # checkout-dir data-root  -> prints the owner session
  ( cd "$1" && bun install --frozen-lockfile >/dev/null 2>&1 \
      && STORAGE_LOCAL_DIR="$2/uploads" bun scripts/seed-showcase.ts "$2/data" 2>&1 ) \
    | sed -n 's/^QUIRE_SESSION=//p' | tail -n 1
}

smoke() { # url package [session data-root]
  ( cd "$REPO" && EXPECT_VERSION="$NEXT" EXPECT_PACKAGE="$2" SETUP_CODE="$CODE" \
      QUIRE_SESSION="${3:-}" DATA_DIR="${4:-}/data" STORAGE_LOCAL_DIR="${4:-}/uploads" \
      bun scripts/smoke.ts "$1" )
}

run_image() { # name image port data-root [extra docker args...]
  local name=$1 image=$2 port=$3 root=$4; shift 4
  mkdir -p "$root/data" "$root/uploads"
  docker run -d --name "$name" -p "127.0.0.1:$port:3000" \
    -e PUID="$(id -u)" -e PGID="$(id -g)" -e UPDATE_CHECK=0 -e SITE_URL="http://127.0.0.1:$port" \
    -v "$root/data:/var/lib/quire/data" -v "$root/uploads:/var/lib/quire/uploads" "$@" "$image" >/dev/null
  CONTAINERS+=("$name")
}

# A snapshot taken by the blog itself, through the owner's own button, into <DATA_DIR>/backups.
snapshot() { # port session
  curl -fsS -X POST -H "cookie: __Host-quire_session=$2" -H "origin: http://127.0.0.1:$1" \
    -H 'content-type: application/json' -d '{}' "http://127.0.0.1:$1/api/backup/run" >/dev/null
}

# EVERY snapshot in the volume, restored INSIDE the container by the image's own scripts/restore.ts.
# `smoke` restores a backup too, but with the checkout's script: that is how 2.2.16's image could
# leave restore.ts out entirely and every cell stay green. An upgrade cell's volume holds the old
# release's archive beside the new one, so the new restore reads the format the old one wrote.
restore_in_image() { # container
  docker exec "$1" sh -c 'set -e; n=0
    for a in /var/lib/quire/data/backups/quire-*.tar.gz; do
      n=$((n + 1)); rm -rf /tmp/restored
      bun scripts/restore.ts "$a" --data-dir /tmp/restored/data --uploads-dir /tmp/restored/uploads
    done
    [ "$n" -gt 0 ] || { echo "no snapshot to restore" >&2; exit 1; }'
}

# --- the cells -----------------------------------------------------------------------------

case "$CELL" in
  source-fresh)
    say "install.sh on an empty directory"
    QUIREINK_SOURCE="$WORK/remote.git" NO_RUN=1 bash "$REPO/install.sh" "$WORK/blog"
    [ "$(version_of "$WORK/blog")" = "$NEXT" ] || { echo "install.sh did not install $NEXT" >&2; exit 1; }
    grep -qx 'QUIREINK_PACKAGE=source' "$WORK/blog/.env"
    say "unclaimed, with a SETUP_CODE"
    serve_source "$WORK/blog" 3501 SETUP_CODE="$CODE" QUIREINK_PACKAGE=source
    smoke http://127.0.0.1:3501 source
    stop_source "$WORK/blog"
    say "with an owner and content"
    rm -rf "$WORK/blog/data" "$WORK/blog/uploads"
    SESSION=$(seed "$WORK/blog" "$WORK/blog")
    serve_source "$WORK/blog" 3501 QUIREINK_PACKAGE=source
    smoke http://127.0.0.1:3501 source "$SESSION" "$WORK/blog"
    ;;

  source-upgrade)
    [ -n "$PREV" ] || { echo "no release before $NEXT to upgrade from" >&2; exit 1; }
    say "installing $PREV and filling it with $PREV's own seeder"
    QUIREINK_SOURCE="$WORK/remote.git" QUIREINK_VERSION="$PREV" NO_RUN=1 bash "$REPO/install.sh" "$WORK/blog"
    SESSION=$(seed "$WORK/blog" "$WORK/blog")
    [ -n "$SESSION" ] || { echo "the $PREV seeder printed no session" >&2; exit 1; }
    serve_source "$WORK/blog" 3502 QUIREINK_PACKAGE=source
    say "upgrading $PREV -> $NEXT the way an owner on $PREV would"
    cat > "$WORK/restart.sh" <<EOF
#!/usr/bin/env bash
pid=\$(cat "$WORK/blog/.pid"); kill "\$pid" 2>/dev/null || true
for _ in \$(seq 1 50); do kill -0 "\$pid" 2>/dev/null || break; sleep 0.2; done
( cd "$WORK/blog" && exec env DATA_DIR=./data STORAGE_LOCAL_DIR=./uploads PORT=3502 UPDATE_CHECK=0 QUIREINK_PACKAGE=source \
  SITE_URL=http://127.0.0.1:3502 nohup bun src/index.ts > "$WORK/blog/server.log" 2>&1 ) &
echo \$! > "$WORK/blog/.pid"
EOF
    chmod +x "$WORK/restart.sh"
    if [ -f "$WORK/blog/scripts/upgrade.ts" ]; then
      ( cd "$WORK/blog" && QUIREINK_RESTART="$WORK/restart.sh" PORT=3502 bun scripts/upgrade.ts )
    else
      # A release from before `bun run upgrade` existed: its owner runs install.sh again.
      QUIREINK_SOURCE="$WORK/remote.git" NO_RUN=1 bash "$REPO/install.sh" "$WORK/blog"
      "$WORK/restart.sh"
    fi
    PIDS+=("$(cat "$WORK/blog/.pid")")
    smoke http://127.0.0.1:3502 source "$SESSION" "$WORK/blog"
    ;;

  docker-fresh)
    say "building the image of $NEXT"
    docker build --quiet -t "quireink:matrix-$NEXT" "$WORK/next" >/dev/null
    say "an empty volume, with a SETUP_CODE"
    run_image quire-matrix-fresh "quireink:matrix-$NEXT" 3503 "$WORK/empty" -e SETUP_CODE="$CODE"
    smoke http://127.0.0.1:3503 docker
    docker rm -f quire-matrix-fresh >/dev/null
    say "with an owner and content"
    SESSION=$(seed "$WORK/next" "$WORK/full")
    run_image quire-matrix-full "quireink:matrix-$NEXT" 3503 "$WORK/full"
    smoke http://127.0.0.1:3503 docker "$SESSION" "$WORK/full"
    say "a snapshot it took, restored inside the image"
    snapshot 3503 "$SESSION"
    restore_in_image quire-matrix-full
    ;;

  docker-upgrade)
    [ -n "$PREV" ] || { echo "no release before $NEXT to upgrade from" >&2; exit 1; }
    say "the $PREV image on data its own seeder wrote"
    git -C "$WORK/next" worktree add --quiet --detach "$WORK/prev" "v$PREV"
    SESSION=$(seed "$WORK/prev" "$WORK/blog")
    [ -n "$SESSION" ] || { echo "the $PREV seeder printed no session" >&2; exit 1; }
    run_image quire-matrix-old "quireink/quireink:$PREV" 3504 "$WORK/blog"
    OLD=""
    for _ in $(seq 1 90); do
      OLD=$(curl -fsS http://127.0.0.1:3504/api/health 2>/dev/null | sed -n 's/.*"version":"\([^"]*\)".*/\1/p') && [ -n "$OLD" ] && break
      # A release older than the version field in /api/health says only 200, and that is all it can say.
      curl -fsS -o /dev/null http://127.0.0.1:3504/api/health 2>/dev/null && { OLD=$PREV; break; }
      sleep 1
    done
    [ "$OLD" = "$PREV" ] || { echo "the $PREV image never came up (or came up as ${OLD:-nothing})" >&2; exit 1; }
    snapshot 3504 "$SESSION"
    docker rm -f quire-matrix-old >/dev/null
    say "the $NEXT image on the same volume"
    docker build --quiet -t "quireink:matrix-$NEXT" "$WORK/next" >/dev/null
    run_image quire-matrix-new "quireink:matrix-$NEXT" 3504 "$WORK/blog"
    smoke http://127.0.0.1:3504 docker "$SESSION" "$WORK/blog"
    say "the $PREV snapshot and a $NEXT one, restored inside the $NEXT image"
    snapshot 3504 "$SESSION"
    restore_in_image quire-matrix-new
    ;;

  cloudflare-dev)
    say "the Cloudflare build of this tree, a Bun blog moved into it, smoked"
    ( cd "$REPO" && bun run build >/dev/null && bun run build:worker && FULL_TOUR=1 bun scripts/ops/cloudflare-dev.ts )
    ;;

  server-http)
    [ "$(uname -s)" = "Linux" ] && [ "${CI:-}" = "true" ] || { echo "server-http runs server.sh as root: CI runners only" >&2; exit 2; }
    say "building the image of $NEXT"
    docker build --quiet -t "quireink:matrix-$NEXT" "$WORK/next" >/dev/null
    teardown() { sudo docker compose -f /opt/quireink/compose.yml down -v >/dev/null 2>&1 || true; sudo rm -rf /opt/quireink /var/lib/quireink; }
    CONTAINERS+=("quireink-quire-1")
    say "server.sh on a blank machine, no domain"
    sudo env QUIREINK_IMAGE=quireink QUIREINK_IMAGE_TAG="matrix-$NEXT" bash "$WORK/next/server.sh" --version "$NEXT" --setup-code "$CODE" \
      || { teardown; exit 1; }
    smoke http://127.0.0.1 docker || { teardown; exit 1; }
    say "server.sh again: an update, and .env untouched"
    before=$(sudo sha256sum /opt/quireink/.env)
    sudo env QUIREINK_IMAGE=quireink QUIREINK_IMAGE_TAG="matrix-$NEXT" bash /opt/quireink/server.sh --version "$NEXT" \
      || { teardown; exit 1; }
    [ "$(sudo sha256sum /opt/quireink/.env)" = "$before" ] || { echo ".env changed on an update" >&2; teardown; exit 1; }
    smoke http://127.0.0.1 docker || { teardown; exit 1; }
    say "server.sh refuses a machine that already serves something"
    if sudo bash -c "mv /opt/quireink/compose.yml /opt/quireink/compose.yml.off && bash $WORK/next/server.sh --version $NEXT" >/dev/null 2>&1; then
      echo "server.sh ran on a machine with port 80 taken" >&2; teardown; exit 1
    fi
    sudo mv /opt/quireink/compose.yml.off /opt/quireink/compose.yml
    teardown
    ;;

  *) echo "unknown cell: $CELL" >&2; exit 2 ;;
esac

say "ok"
