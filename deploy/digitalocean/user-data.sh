#!/bin/bash
# Quire Ink on a fresh Ubuntu droplet (tested against Ubuntu 24.04).
#
# Paste this whole file into "Advanced Options -> Add Initialization scripts"
# on DigitalOcean's droplet-create page (the box is free), pick the cheapest
# droplet, and create it. About three minutes after boot the blog is serving,
# and what server.sh printed -- the address and how to claim it -- is waiting in
# /root/quire-setup.txt on the droplet.
#
# A THIN SHELL AROUND server.sh since 2026-10-03 (ADR 0065): the one script that
# sets up a blank Ubuntu or Debian server, tested on every release. This file
# only carries the two lines worth filling in before you paste it.
#
# Plain HTTP against the bare IP is the most a machine with no domain can
# honestly do. When you point a domain at the droplet, the reverse-proxy
# section of docs/self-host.md (or docker-compose.caddy.yml) upgrades it to
# HTTPS, and Settings -> Blog moves the address with you.
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
#
# SETUP_CODE is the second line worth filling: twelve characters or more, and
# the blog is claimed by opening /setup in a browser and typing them, so the
# terminal is never needed. Leave it empty and the one-time link in the log
# is the way in, as before. https://quireink.com/start writes both lines.
DOMAIN=""
SETUP_CODE=""
# ──────────────────────────────────────────────────────────────────────────────

ARGS=()
[ -n "$DOMAIN" ] && ARGS+=(--domain "$DOMAIN")
[ -n "$SETUP_CODE" ] && ARGS+=(--setup-code "$SETUP_CODE")
curl -fsSL -o /root/quireink-server.sh https://raw.githubusercontent.com/joiha-steven/quireink/main/server.sh
bash /root/quireink-server.sh "${ARGS[@]}" 2>&1 | tee /root/quire-setup.txt
