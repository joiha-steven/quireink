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
#   QUIREINK_VERSION=           a release to install, e.g. 2.2.16; empty means the newest
#   QUIREINK_CHANNEL=main       follow the main branch instead of releases (for developers)
#
# IT INSTALLS A RELEASE, not whatever was pushed last (ADR 0065). The newest tag is found with
# `git ls-remote`, so nothing but the git remote is asked. Run again, it moves to a newer release
# when there is one, and NEVER to older code than the checkout already has: a checkout that was
# following `main` before this script followed releases stays where it is until a release newer
# than it appears, then moves onto that.
set -euo pipefail

SOURCE=${QUIREINK_SOURCE:-https://github.com/joiha-steven/quireink.git}
CHANNEL=${QUIREINK_CHANNEL:-release}
WANT=${QUIREINK_VERSION:-}
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

# --- which release ----------------------------------------------------------------------

# X.Y.Z only: a pre-release (2.3.0-beta.1) is something to ask for by name, never a default.
# Sorted numerically field by field rather than with `sort -V`, which not every sort has.
newest_release() {
  git ls-remote --tags --refs "$SOURCE" 'v*' 2>/dev/null \
    | sed -n 's#.*refs/tags/v\([0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*\)$#\1#p' \
    | sort -t. -k1,1n -k2,2n -k3,3n | tail -n 1
}

# 0 when $1 is a strictly newer version than $2.
newer() {
  [ "$1" != "$2" ] && [ "$(printf '%s\n%s\n' "$1" "$2" | sort -t. -k1,1n -k2,2n -k3,3n | tail -n 1)" = "$1" ]
}

# The version a checkout holds, read from package.json. It only changes on a release commit and
# only goes up, so "the checkout says 2.2.15 and the newest release is 2.2.16" means the checkout
# is OLDER than that release, wherever on main it sits, and moving to the tag moves forward.
checkout_version() {
  sed -n 's/^  "version": "\([^"]*\)".*/\1/p' "$1/package.json" | head -n 1
}

if [ "$CHANNEL" = "main" ]; then
  TAG=""
else
  [ "$CHANNEL" = "release" ] || die "QUIREINK_CHANNEL is either main or unset, got: $CHANNEL"
  if [ -n "$WANT" ]; then
    VERSION=${WANT#v}
  else
    VERSION=$(newest_release)
    [ -n "$VERSION" ] || die "could not list the releases of $SOURCE. Is the address right, and is there a network?"
  fi
  TAG="v$VERSION"
fi

# --- get the code ----------------------------------------------------------------------

if [ -d "$DIR/.git" ]; then
  say "Updating the checkout in $DIR"
  HAVE=$(checkout_version "$DIR")
  BRANCH=$(git -C "$DIR" symbolic-ref --quiet --short HEAD 2>/dev/null || true)
  if [ -z "$TAG" ]; then
    # The developer's channel: onto main, and pulled.
    [ "$BRANCH" = "main" ] || { git -C "$DIR" fetch origin main && git -C "$DIR" checkout main; }
    git -C "$DIR" pull --ff-only
  elif newer "$VERSION" "$HAVE"; then
    step "$HAVE -> $VERSION"
    git -C "$DIR" fetch --quiet --depth 1 origin "refs/tags/$TAG:refs/tags/$TAG"
    git -C "$DIR" checkout --quiet --detach "$TAG"
  elif [ "$VERSION" = "$HAVE" ] && [ "$BRANCH" != "main" ]; then
    step "Already on $VERSION."
  elif [ -n "$WANT" ] && [ "$VERSION" != "$HAVE" ]; then
    die "this checkout holds $HAVE, newer than the $VERSION asked for. An update never goes back:
  restore the copy taken before the last upgrade instead (docs/backups.md)."
  else
    # On main at or past the newest release. Moving to the tag would be moving BACK.
    step "This checkout follows main at $HAVE, at or past the newest release ($VERSION)."
    step "It stays where it is, and moves onto the next release when there is one."
  fi
elif [ -e "$DIR" ] && [ -n "$(ls -A "$DIR" 2>/dev/null)" ]; then
  die "$DIR exists and is not an empty directory or a Quire Ink checkout.
  Pick another with: QUIREINK_DIR=/path/to/blog"
elif [ -z "$TAG" ]; then
  say "Cloning Quire Ink (main) into $DIR"
  git clone --depth 1 "$SOURCE" "$DIR"
else
  say "Cloning Quire Ink $VERSION into $DIR"
  git clone --quiet --depth 1 --branch "$TAG" "$SOURCE" "$DIR" \
    || die "there is no release $VERSION at $SOURCE."
fi

cd "$DIR"
DIR_ABS=$(pwd)

# --- build ------------------------------------------------------------------------------
#
# The full install, not --production: TypeScript and the DOM stand-in the editor's suites use
# are devDependencies, and the two build steps below need the tree complete. Those steps write
# artefacts the server READS FROM DISK at runtime, which is why they run before it ever starts
# and again after a pull.

say "Installing dependencies"
# A release installs exactly what its lockfile says; main is allowed to resolve.
if [ -n "${TAG:-}" ]; then bun install --frozen-lockfile; else bun install; fi

say "Building the islands and the admin"
bun run build:assets
bun run build:admin

# --- where the content will live ---------------------------------------------------------
#
# Defaults, matching the app's own: ./data and ./uploads. Fine for trying it; on a server
# they belong OUTSIDE the app directory, because an upgrade replaces the app directory.

mkdir -p data uploads

# Which package this is (ADR 0065): the admin reads it to show the upgrade that applies. Added
# once, never rewritten, and nothing else in a .env the owner may have filled is touched.
if ! grep -qs '^QUIREINK_PACKAGE=' .env; then
  printf 'QUIREINK_PACKAGE=source\n' >> .env
fi

say "Installed"
step "Directory   $DIR_ABS"
step "Data        $DIR_ABS/data  (quire.db + analytics.db)"
step "Uploads     $DIR_ABS/uploads"
step "Address     ${SITE_URL:-not set — feeds and emails will say http://localhost:3000}"
step ""
step "Version     $(checkout_version .)${TAG:+ (release)}${TAG:- (main)}"
step ""
step "Upgrading later:  cd $DIR_ABS && bun run upgrade"

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
  step "cd $DIR_ABS && DATA_DIR=./data STORAGE_LOCAL_DIR=./uploads bun --smol src/index.ts"
  exit 0
fi

say "Starting the blog. Watch for the link that claims it, then open it in a browser."
step "Ctrl-C stops it. Nothing you write is lost by stopping it."
# IN THE FOREGROUND, said out loud: closing this terminal stops the blog and a reboot does not
# bring it back. Fine for a look; a server wants a service (docs/self-host.md section 4, or Docker).
step "It runs in THIS terminal: closing it stops the blog, and a reboot does not restart it."
step "On a server, make it a service instead: docs/self-host.md section 4 (systemd), or Docker."
echo

DATA_DIR=./data \
STORAGE_LOCAL_DIR=./uploads \
SITE_URL="$SITE_URL" \
PORT="$PORT" \
exec bun --smol src/index.ts
