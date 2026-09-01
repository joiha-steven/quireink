#!/usr/bin/env bash
# HTTPS for a blog that was installed straight onto the machine, in one command.
#
#   sudo bash deploy/caddy/setup.sh https://example.com
#
# `install.sh` puts the blog on 127.0.0.1:3000 and deliberately stops there: it never uses
# sudo, never touches systemd, never writes a vhost. Those are decisions with consequences on
# somebody else's server and it has no business making them silently. This script is the same
# decisions made OUT LOUD — it says what it will do, it needs root and says why, and it does
# nothing else.
#
# What it does: installs Caddy from Caddy's own apt repository, points it at the Caddyfile
# beside this repository's root (the SAME file the compose installs use, so the content
# security policy the application is tested against is the one you get), and starts it. Caddy
# gets the certificate from Let's Encrypt itself and renews it itself. Nothing is scheduled.
#
# What it does NOT do: install or start the blog, open a firewall, or touch DNS. The domain
# has to already point at this machine before you run this, or no certificate can be issued
# and Caddy will say so in its log.
set -euo pipefail

SITE_URL=${1:-${SITE_URL:-}}
UPSTREAM=${QUIRE_UPSTREAM:-127.0.0.1:3000}

die() { printf '\n\033[31mStopped:\033[0m %s\n\n' "$*" >&2; exit 1; }
say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

[ -n "$SITE_URL" ] || die "no address given.

  sudo bash deploy/caddy/setup.sh https://example.com

  With the scheme and no trailing slash, the same value the blog has in SITE_URL. Caddy takes
  the certificate's name out of it, so there is one name to write rather than two."

case "$SITE_URL" in
  https://*) ;;
  http://*) die "that is http://. Caddy would serve plain text on port 80 and never ask for a
  certificate, which is the opposite of why this script exists." ;;
  *) die "'$SITE_URL' has no scheme. Write it as https://example.com." ;;
esac

[ "$(id -u)" = "0" ] || die "this needs root, and it is the only thing here that does: apt,
  /etc/caddy, and a service that binds ports 80 and 443. Run it with sudo."

HERE=$(cd "$(dirname "$0")/../.." && pwd)
CADDYFILE="$HERE/Caddyfile"
[ -f "$CADDYFILE" ] || die "no Caddyfile at $CADDYFILE. Run this from the checkout install.sh made."

command -v systemctl >/dev/null 2>&1 || die "there is no systemd here, and the service this
  writes is a systemd unit. Found by running the script in a container, where everything up to
  this point succeeded and the failure was 'systemctl: command not found' with the
  configuration already on disk. Install Caddy however this system runs services, then copy
  $CADDYFILE to /etc/caddy/Caddyfile and give it SITE_URL and QUIRE_UPSTREAM."

command -v apt-get >/dev/null 2>&1 || die "this installs Caddy with apt, and there is no apt here.
  Install Caddy however this system does it (https://caddyserver.com/docs/install), then copy
  $CADDYFILE to /etc/caddy/Caddyfile and set SITE_URL and QUIRE_UPSTREAM in its environment."

if ! command -v caddy >/dev/null 2>&1; then
  say "Installing Caddy"
  export DEBIAN_FRONTEND=noninteractive
  apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl gpg >/dev/null
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt \
    | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  apt-get update -qq
  apt-get install -y -qq caddy >/dev/null
fi
caddy version | head -1

say "Writing the configuration"
install -d -m 755 /etc/caddy
# A copy, not a symlink: the checkout can move or be deleted and the proxy should keep
# serving. `git pull` on the blog does not silently change what is in front of it either --
# re-run this script when the Caddyfile in the repository changes, which is a decision.
install -m 644 "$CADDYFILE" /etc/caddy/Caddyfile

# The two variables the shared Caddyfile reads. An environment file rather than a rewritten
# Caddyfile, so the file on disk stays byte-identical to the repository's and a diff between
# them means something.
install -d -m 755 /etc/systemd/system/caddy.service.d
cat > /etc/systemd/system/caddy.service.d/quireink.conf <<CONF
[Service]
Environment=SITE_URL=$SITE_URL
Environment=QUIRE_UPSTREAM=$UPSTREAM
CONF

say "Checking it before starting it"
SITE_URL="$SITE_URL" QUIRE_UPSTREAM="$UPSTREAM" caddy validate --config /etc/caddy/Caddyfile

systemctl daemon-reload
systemctl enable --now caddy >/dev/null 2>&1 || systemctl enable caddy >/dev/null 2>&1
systemctl restart caddy

say "Done"
printf '  %s is served by Caddy, proxying %s\n' "$SITE_URL" "$UPSTREAM"
printf '  The certificate is issued and renewed by Caddy. Nothing is scheduled.\n'
printf '  If the log below is quiet, it worked:\n\n'
sleep 2
journalctl -u caddy -n 8 --no-pager 2>/dev/null | grep -iE 'error|obtain|certificate' || printf '  (nothing to report)\n'
