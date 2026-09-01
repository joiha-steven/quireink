#!/bin/bash
# Quire Ink on a fresh Ubuntu droplet (tested against Ubuntu 24.04).
#
# Paste this whole file into "Advanced Options -> Add Initialization scripts"
# on DigitalOcean's droplet-create page (the box is free), pick the cheapest
# droplet, and create it. About three minutes after boot the blog is serving
# on http://<droplet-ip> and the one-time link that claims it is waiting in
# /root/quire-claim.txt -- also in `docker logs quire`, where every restart
# prints a fresh one.
#
# Plain HTTP against the bare IP is the most a machine with no domain can
# honestly do. When you point a domain at the droplet, the reverse-proxy
# section of docs/self-host.md (or docker-compose.caddy.yml) upgrades it to
# HTTPS, and Settings -> Site moves the address with you.
set -euo pipefail

# ── THE ONE LINE WORTH EDITING BEFORE YOU PASTE THIS ──────────────────────────
# Put your domain here and the droplet comes up on HTTPS, with the certificate
# already issued: Caddy in front, Let's Encrypt, nothing scheduled. The domain
# has to ALREADY point at this droplet, which means creating the A record with
# the reserved IP before the droplet, or pasting this again afterwards.
#
# Leave it empty and you get what this file has always given: the blog on port
# 80 at the droplet's own address, no certificate, and a note in
# /root/quire-https.txt with the one command that fixes it once DNS is ready.
DOMAIN=""
# ──────────────────────────────────────────────────────────────────────────────

export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -yq docker.io docker-compose-v2 curl
systemctl enable --now docker

# The droplet's public address: the source address of the default route, which
# on DigitalOcean (and most clouds) is the public IPv4 on the first interface.
# Deliberately not a metadata-service call, so the same file boots a test box
# on any provider's Ubuntu image.
IP=$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if ($i=="src") print $(i+1); exit}')
[ -n "$IP" ] || IP=$(hostname -I | awk '{print $1}')

mkdir -p /var/lib/quire/data /var/lib/quire/uploads

if [ -n "$DOMAIN" ]; then
  # The tested two-file arrangement rather than a third hand-rolled one: the same
  # compose and the same Caddyfile the documentation sends everyone else to, so
  # the content security policy here is the one the application is tested against.
  mkdir -p /opt/quire && cd /opt/quire
  RAW=https://raw.githubusercontent.com/joiha-steven/quireink/main
  curl -fsSL -o docker-compose.image.yml "$RAW/docker-compose.image.yml"
  curl -fsSL -o Caddyfile "$RAW/Caddyfile"
  printf 'SITE_URL=https://%s\n' "$DOMAIN" > .env
  docker compose -f docker-compose.image.yml pull -q
  docker compose -f docker-compose.image.yml up -d
else
  docker run -d --name quire --restart unless-stopped \
    -p 80:3000 \
    -e SITE_URL="http://$IP" \
    -v /var/lib/quire/data:/var/lib/quire/data \
    -v /var/lib/quire/uploads:/var/lib/quire/uploads \
    quireink/quireink:latest

  # Not a certificate, and saying so where it will be found rather than in a
  # document somebody has to go looking for.
  cat > /root/quire-https.txt <<'NOTE'
This blog is on http:// at the droplet's address, because no domain was named
when it booted. To give it HTTPS once DNS points here:

  cd /opt/quire 2>/dev/null || mkdir -p /opt/quire && cd /opt/quire
  RAW=https://raw.githubusercontent.com/joiha-steven/quireink/main
  curl -fsSL -o docker-compose.image.yml "$RAW/docker-compose.image.yml"
  curl -fsSL -o Caddyfile "$RAW/Caddyfile"
  printf 'SITE_URL=https://example.com\n' > .env      # your domain
  docker stop quire && docker rm quire                 # frees port 80
  docker compose -f docker-compose.image.yml pull
  docker compose -f docker-compose.image.yml up -d

The data volumes above are bind mounts, so the blog keeps its posts across that
swap. Then change the address in Settings -> Site to match.
NOTE
fi

# The claim link, fished out of the log so the first thing nobody has to learn
# is docker logs. The token lives in memory, so this file goes stale the day
# the container restarts -- by then the blog is claimed and nobody needs it.
for _ in $(seq 1 90); do
  LINK=$( { docker logs quire 2>&1 || docker compose -f /opt/quire/docker-compose.image.yml logs quire 2>&1; } \
    | grep -oE "http[^ ]*/setup\?token=[A-Za-z0-9_-]+" | head -1 || true)
  if [ -n "$LINK" ]; then printf '%s\n' "$LINK" > /root/quire-claim.txt; break; fi
  sleep 2
done
