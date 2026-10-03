#!/usr/bin/env bash
# Quire Ink on a blank Ubuntu or Debian server, in one command (ADR 0065).
#
#   curl -fsSL https://raw.githubusercontent.com/joiha-steven/quireink/main/server.sh \
#     | sudo bash -s -- --domain blog.example.com --setup-code 'twelve-or-more-characters'
#
# It installs Docker if the machine has none, runs the published image of the newest release with
# Caddy in front (a Let's Encrypt certificate, renewed by Caddy, nothing scheduled), keeps the data
# in /var/lib/quireink, waits until the blog answers, and says how to claim it. Without --domain it
# serves plain HTTP on the machine's own address, which is the most a server with no name can
# honestly do; run it again with --domain once DNS points here.
#
# THE ONE SCRIPT IN THIS PROJECT THAT USES sudo, and the reason it is allowed to: it refuses to run
# anywhere but a BLANK machine. Something already listening on 80 or 443, nginx, Apache or Caddy
# installed as a service, or any Docker container that is not ours, and it stops before changing
# anything and says what it found. `install.sh` keeps its own rule — no sudo, never root — for
# people who want to run things themselves.
#
# Run it again on the same machine and it is an update: it reads the newest release, moves the
# image to it, keeps .env (the address, the setup code, anything added since) untouched.
#
# Options:
#   --domain NAME        the blog's address; DNS must already point here for the certificate
#   --setup-code CODE    12+ characters: /setup asks for this instead of a link from the log
#   --version X.Y.Z      a release to install; default the newest
#   QUIREINK_IMAGE=      another image (a test build); default quireink/quireink
set -euo pipefail

DOMAIN=""
SETUP_CODE=""
VERSION=""
IMAGE=${QUIREINK_IMAGE:-quireink/quireink}
DIR=/opt/quireink
DATA=/var/lib/quireink
REPO=joiha-steven/quireink

say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
step() { printf '  %s\n' "$*"; }
die()  { printf '\n\033[31mStopped:\033[0m %s\n\n' "$*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --domain) DOMAIN=${2:-}; shift 2 ;;
    --setup-code) SETUP_CODE=${2:-}; shift 2 ;;
    --version) VERSION=${2#v}; shift 2 ;;
    -h|--help) sed -n '2,30p' "$0" 2>/dev/null || true; exit 0 ;;
    *) die "unknown option $1 (see the top of this file)" ;;
  esac
done
DOMAIN=${DOMAIN#https://}; DOMAIN=${DOMAIN#http://}; DOMAIN=${DOMAIN%%/*}
if [ -n "$SETUP_CODE" ] && [ ${#SETUP_CODE} -lt 12 ]; then
  die "--setup-code needs twelve characters or more; a shorter one would be ignored and the claim would fall back to a link in the log."
fi

# --- what has to be true before anything is written ----------------------------------------

[ "$(id -u)" = "0" ] || die "this sets up a server, so it needs root. Run it with sudo, as the line at the top of this file shows."
[ -r /etc/os-release ] || die "this is not a Linux distribution this script knows."
. /etc/os-release
case " ${ID:-} ${ID_LIKE:-} " in
  *" ubuntu "*|*" debian "*) ;;
  *) die "this is ${PRETTY_NAME:-an unknown system}. server.sh knows Ubuntu and Debian; elsewhere, use the image directly (docs/self-host-docker.md)." ;;
esac

UPDATE=0
[ -f "$DIR/compose.yml" ] && UPDATE=1

if [ "$UPDATE" = "0" ]; then
  found=""
  if command -v ss >/dev/null 2>&1 && ss -ltnH 2>/dev/null | awk '{print $4}' | grep -qE '(^|[:.])(80|443)$'; then
    found="$found\n  - something is already listening on port 80 or 443"
  fi
  for svc in nginx apache2 httpd caddy; do
    if systemctl list-unit-files "$svc.service" >/dev/null 2>&1 && systemctl list-unit-files "$svc.service" | grep -q "^$svc.service"; then
      found="$found\n  - $svc is installed as a service"
    fi
  done
  if command -v docker >/dev/null 2>&1 && [ -n "$(docker ps -aq 2>/dev/null)" ]; then
    found="$found\n  - Docker already has containers on it"
  fi
  if [ -n "$found" ]; then
    die "this does not look like a blank server:$(printf "$found")

  server.sh only sets up machines that serve nothing yet, so it never fights something you run.
  On a server that already has a web server, use the image behind it (docs/self-host-docker.md)
  or install from source (docs/self-host.md)."
  fi
fi

# --- Docker ---------------------------------------------------------------------------------

if ! command -v docker >/dev/null 2>&1; then
  say "Installing Docker"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -q
  apt-get install -yq docker.io curl
  # The compose plugin has a different package name on each release; take whichever exists.
  apt-get install -yq docker-compose-v2 2>/dev/null || apt-get install -yq docker-compose-plugin 2>/dev/null \
    || apt-get install -yq docker-compose
  systemctl enable --now docker
fi
if docker compose version >/dev/null 2>&1; then COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then COMPOSE="docker-compose"
else die "Docker is here but compose is not. Install the compose plugin and run this again."; fi
command -v curl >/dev/null 2>&1 || { apt-get install -yq curl >/dev/null; }

# --- which release ---------------------------------------------------------------------------

if [ -z "$VERSION" ]; then
  VERSION=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" 2>/dev/null \
    | sed -n 's/.*"tag_name": *"v\([0-9][0-9.]*\)".*/\1/p' | head -n 1)
  [ -n "$VERSION" ] || die "could not find the newest release on GitHub. Is there a network? (--version X.Y.Z names one)"
fi
MINOR=${VERSION%.*}
# The image is pinned to X.Y: `docker compose pull` then brings every fix of this release line,
# and a new feature release waits for this script to be run again.
TAG=$MINOR
[ "$IMAGE" = "quireink/quireink" ] || TAG=${QUIREINK_IMAGE_TAG:-$VERSION}

# --- the files ------------------------------------------------------------------------------

say "$([ "$UPDATE" = "1" ] && echo "Updating" || echo "Setting up") Quire Ink $VERSION"
mkdir -p "$DIR" "$DATA/data" "$DATA/uploads"
cd "$DIR"

if [ ! -f .env ]; then
  {
    if [ -n "$DOMAIN" ]; then echo "SITE_URL=https://$DOMAIN"; fi
    if [ -n "$SETUP_CODE" ]; then echo "SETUP_CODE=$SETUP_CODE"; fi
  } > .env
  chmod 600 .env
elif [ -n "$DOMAIN" ] && ! grep -q '^SITE_URL=https://' .env; then
  # The one change an update makes to .env: a domain given for the first time.
  sed -i '/^SITE_URL=/d' .env
  echo "SITE_URL=https://$DOMAIN" >> .env
fi
grep -q '^SITE_URL=https://' .env && HTTPS=1 || HTTPS=0

if [ "$HTTPS" = "1" ]; then
  # The Caddyfile of THIS release, so the security headers are the ones the release was tested with.
  curl -fsSL -o Caddyfile "https://raw.githubusercontent.com/$REPO/v$VERSION/Caddyfile" \
    || die "could not fetch the Caddyfile of $VERSION."
fi

{
  echo "# Written by server.sh for Quire Ink $VERSION. Run server.sh again to move to a newer release;"
  echo "# \`$COMPOSE pull && $COMPOSE up -d\` here brings the fixes of the $MINOR line."
  echo "services:"
  echo "  quire:"
  echo "    image: $IMAGE:$TAG"
  echo "    restart: unless-stopped"
  echo "    env_file: .env"
  echo "    volumes:"
  echo "      - $DATA/data:/var/lib/quire/data"
  echo "      - $DATA/uploads:/var/lib/quire/uploads"
  if [ "$HTTPS" = "0" ]; then
    echo "    ports:"
    echo "      - \"80:3000\""
  fi
  echo "    logging: { driver: json-file, options: { max-size: \"10m\", max-file: \"3\" } }"
  echo "    security_opt: [\"no-new-privileges:true\"]"
  if [ "$HTTPS" = "1" ]; then
    echo "  caddy:"
    echo "    image: caddy:2-alpine"
    echo "    restart: unless-stopped"
    echo "    depends_on: [quire]"
    echo "    ports: [\"80:80\", \"443:443\", \"443:443/udp\"]"
    echo "    environment:"
    echo "      SITE_URL: https://$DOMAIN"
    echo "      QUIRE_UPSTREAM: quire:3000"
    echo "    volumes:"
    echo "      - ./Caddyfile:/etc/caddy/Caddyfile:ro"
    echo "      - caddy-data:/data"
    echo "      - caddy-config:/config"
    echo "    logging: { driver: json-file, options: { max-size: \"10m\", max-file: \"3\" } }"
    echo "volumes:"
    echo "  caddy-data:"
    echo "  caddy-config:"
  fi
} > compose.yml

# Kept beside the compose file, so "run it again" never depends on remembering a URL.
if [ -f "${BASH_SOURCE[0]:-}" ]; then cp "${BASH_SOURCE[0]}" "$DIR/server.sh" 2>/dev/null || true; fi
[ -f "$DIR/server.sh" ] || curl -fsSL -o "$DIR/server.sh" "https://raw.githubusercontent.com/$REPO/main/server.sh" || true

# --- start, and wait for it -----------------------------------------------------------------

if [ "$IMAGE" = "quireink/quireink" ]; then $COMPOSE pull -q; fi
$COMPOSE up -d --remove-orphans

say "Waiting for the blog to answer"
ANSWER=""
for _ in $(seq 1 90); do
  ANSWER=$($COMPOSE exec -T quire bun --smol --eval \
    "const r=await fetch('http://127.0.0.1:3000/api/health');console.log(r.ok?(await r.json()).version:'')" 2>/dev/null || true)
  [ -n "$ANSWER" ] && break
  sleep 2
done
[ -n "$ANSWER" ] || die "it did not answer within three minutes. \`cd $DIR && $COMPOSE logs quire\` says why."

IP=$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if ($i=="src") print $(i+1); exit}')
[ -n "$IP" ] || IP=$(hostname -I 2>/dev/null | awk '{print $1}')
if [ "$HTTPS" = "1" ]; then ADDRESS="https://$DOMAIN"; else ADDRESS="http://$IP"; fi

say "Quire Ink $ANSWER is running"
step "Address     $ADDRESS"
step "Data        $DATA  (the databases and the uploads; back this up)"
step "Files       $DIR  (compose.yml, .env)"
if [ "$UPDATE" = "0" ]; then
  if grep -q '^SETUP_CODE=' .env; then
    step "Claim it    open $ADDRESS/setup and type the setup code"
  else
    LINK=$($COMPOSE logs quire 2>&1 | grep -oE "http[^ ]*/setup\?token=[A-Za-z0-9_-]+" | tail -n 1 || true)
    step "Claim it    ${LINK:-the one-time /setup link in: cd $DIR && $COMPOSE logs quire}"
  fi
fi
step "Fixes       cd $DIR && $COMPOSE pull && $COMPOSE up -d"
step "New release sudo bash $DIR/server.sh"
if [ "$HTTPS" = "1" ]; then
  RESOLVED=$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk 'NR==1{print $1}' || true)
  if [ -n "$RESOLVED" ] && [ -n "$IP" ] && [ "$RESOLVED" != "$IP" ]; then
    say "Note: $DOMAIN resolves to $RESOLVED, not to this machine ($IP)."
    step "Caddy cannot get a certificate until it does. Fix the DNS record; nothing here needs to run again."
  fi
else
  say "No certificate: there is no domain yet."
  step "Point a domain here, then: sudo bash $DIR/server.sh --domain your.domain"
fi
