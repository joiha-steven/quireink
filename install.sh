#!/usr/bin/env bash
# Quire Ink — from nothing to a running blog, in one command.
#
#   curl -fsSL https://raw.githubusercontent.com/joiha-steven/quireink/main/install.sh | bash
#
# It clones the repository, installs, builds the two artefacts the server reads at runtime,
# and starts the blog in the foreground so the log prints the link that claims it. That log
# line IS the account step (docs/self-host.md §6): there is no shell command to run after.
#
# What it deliberately does NOT do: install Bun, touch systemd, write an nginx vhost, ask
# for a password, or use sudo. Those are decisions with consequences on a server somebody
# else owns, and docs/self-host.md walks through them with the reasons attached. This
# script only does the mechanical part, and it is idempotent: run it again on the same
# directory and it updates and rebuilds instead of failing.
#
# Options, all through the environment so the pipe above keeps working:
#   QUIREINK_DIR=./quireink     where to put it (or pass it as the first argument)
#   SITE_URL=                   your public address; empty is fine while trying it locally
#   PORT=3000
#   NO_RUN=1                    install and build, but do not start it
#   QUIREINK_SOURCE=            clone from somewhere else (a fork, or a local path)
set -euo pipefail

SOURCE=${QUIREINK_SOURCE:-https://github.com/joiha-steven/quireink.git}
DIR=${1:-${QUIREINK_DIR:-./quireink}}
PORT=${PORT:-3000}
SITE_URL=${SITE_URL:-}

say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
step() { printf '  %s\n' "$*"; }
die()  { printf '\n\033[31mStopped:\033[0m %s\n\n' "$*" >&2; exit 1; }

# --- what has to be true before anything is written ------------------------------------

# Running the blog as root is the one mistake that cannot be undone by editing a file: every
# path it creates from then on belongs to root, and the unprivileged user it should have been
# cannot read its own database. Refuse early rather than half-way through.
if [ "$(id -u)" = "0" ] && [ "${QUIREINK_ALLOW_ROOT:-}" != "1" ]; then
  die "this is running as root. Make an unprivileged user for the blog and run it as them
  (docs/self-host.md §1). Set QUIREINK_ALLOW_ROOT=1 only if you know why you want this."
fi

command -v git >/dev/null 2>&1 || die "git is not installed."

if ! command -v bun >/dev/null 2>&1; then
  die "Bun is not installed. Get it with:

  curl -fsSL https://bun.sh/install | bash

  then open a new shell and run this again."
fi

# 1.3 is the floor in package.json's engines field, and the failure without it is a runtime
# error deep in the server rather than anything that names the version.
BUN_VERSION=$(bun --version)
BUN_MAJOR=${BUN_VERSION%%.*}
BUN_REST=${BUN_VERSION#*.}
BUN_MINOR=${BUN_REST%%.*}
if [ "$BUN_MAJOR" -lt 1 ] || { [ "$BUN_MAJOR" -eq 1 ] && [ "$BUN_MINOR" -lt 3 ]; }; then
  die "Bun $BUN_VERSION is too old; 1.3 or newer is required. Upgrade with: bun upgrade"
fi

# --- get the code ----------------------------------------------------------------------

if [ -d "$DIR/.git" ]; then
  say "Updating the checkout in $DIR"
  git -C "$DIR" pull --ff-only
elif [ -e "$DIR" ] && [ -n "$(ls -A "$DIR" 2>/dev/null)" ]; then
  die "$DIR exists and is not an empty directory or a Quire Ink checkout.
  Pick another with: QUIREINK_DIR=/path/to/blog"
else
  say "Cloning Quire Ink into $DIR"
  git clone --depth 1 "$SOURCE" "$DIR"
fi

cd "$DIR"
DIR_ABS=$(pwd)

# --- build ------------------------------------------------------------------------------
#
# The full install, not --production: React, Tailwind and TipTap are devDependencies and the
# admin cannot be built without them. The two build steps write artefacts the server READS
# FROM DISK at runtime, which is why they run before it ever starts and again after a pull.

say "Installing dependencies"
bun install

say "Building the islands and the admin"
bun run build:assets
bun run build:admin

# --- where the content will live ---------------------------------------------------------
#
# Defaults, matching the app's own: ./data and ./uploads. Fine for trying it; on a server
# they belong OUTSIDE the app directory, because an upgrade replaces the app directory.

mkdir -p data uploads

say "Installed"
step "Directory   $DIR_ABS"
step "Data        $DIR_ABS/data  (quire.db + analytics.db)"
step "Uploads     $DIR_ABS/uploads"
step "Address     ${SITE_URL:-not set — feeds and emails will say http://localhost:$PORT}"
step ""
step "Upgrading later:  cd $DIR_ABS && git pull && bun install && bun run build:assets && bun run build:admin"

# HTTPS, named here rather than left to the reader to go looking for. This script stops at a
# blog on loopback on purpose -- it uses no sudo and touches no service, because those are
# decisions with consequences on somebody else's machine. But stopping there and saying
# nothing left the one-command path as the only way in with no certificate at the end of it,
# beside Docker paths that all have one. The next command is the same decisions made out loud.
say "It has no certificate yet. One more command gives it one:"
if [ -n "$SITE_URL" ]; then
  step "sudo bash $DIR_ABS/deploy/caddy/setup.sh $SITE_URL"
else
  step "sudo bash $DIR_ABS/deploy/caddy/setup.sh https://your-domain"
  step "(and set SITE_URL to the same address, or feeds and emails will say localhost)"
fi
step "Caddy gets it from Let's Encrypt and renews it itself. Nothing is scheduled."
step "Something else already terminating TLS? Skip it: docs/self-host.md has nginx."

if [ "${NO_RUN:-}" = "1" ]; then
  say "Not starting it (NO_RUN=1). To start:"
  step "cd $DIR_ABS && DATA_DIR=./data STORAGE_LOCAL_DIR=./uploads bun src/index.ts"
  exit 0
fi

say "Starting the blog. Watch for the link that claims it, then open it in a browser."
step "Ctrl-C stops it. Nothing you write is lost by stopping it."
echo

DATA_DIR=./data \
STORAGE_LOCAL_DIR=./uploads \
SITE_URL="$SITE_URL" \
PORT="$PORT" \
exec bun src/index.ts
