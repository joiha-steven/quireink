#!/usr/bin/env bash
# Uptime check for Quire Ink instances: a handful of URLs, a webhook when one goes dark.
#
# ONE script, any number of instances, same shape as `quire-backup.sh`: every value that
# describes an installation is an environment variable, set in the cron block that runs it.
# It exists because the fleet had exactly one alert in it — backup failure — and five
# systemd units that could die at 3am and be discovered by a visitor. An outage on
# 2026-08-28 ran ~20 minutes because someone happened to be at a keyboard; this makes the
# happening-to-be-there part unnecessary.
#
# Check through the DOMAIN, not the origin port. A deploy's health check already proves the
# box it wrote to is serving; it cannot prove that box is the one DNS points at, and that
# gap has shipped twice (deploy.sh tells both stories). A domain check closes it: DNS, the
# edge, TLS and the origin all have to be right for a 200 to come back.
#
# Run it from MORE THAN ONE box. A box cannot report its own death; two boxes checking the
# same list cover each other, and a duplicated alert from two vantage points is information
# ("really down"), not noise.
#
# Install once per box, then one crontab:
#   install -m 755 quire-uptime.sh /usr/local/bin/
#   /etc/cron.d/<box>-uptime:
#     */5 * * * * root QUIRE_UPTIME_URLS="https://a.example/ https://b.example/api/health" \
#       QUIRE_ALERT_ALIAS="uptime@thisbox" /usr/local/bin/quire-uptime.sh
set -uo pipefail

# ---- this machine ------------------------------------------------------------
URLS="${QUIRE_UPTIME_URLS:?set QUIRE_UPTIME_URLS, space-separated}"
STATE="${QUIRE_UPTIME_STATE:-/var/tmp/quire-uptime}"
LOG="${QUIRE_UPTIME_LOG:-/var/log/quire-uptime.log}"
# Same convention as quire-backup.sh: a file holding one webhook URL. Absent, a failure is
# logged and not announced — which is exactly the silence this script exists to end, so an
# absent hook is itself logged loudly on every run.
ALERT_HOOK_FILE="${QUIRE_ALERT_HOOK_FILE:-/root/.alert-webhook}"
ALERT_ALIAS="${QUIRE_ALERT_ALIAS:-quire uptime}"
# Alert on the Nth consecutive failing run (default 2 ≈ down for one full interval — a
# single blip through a CDN is not an outage), then remind every REMIND runs while it
# stays down (default 36 ≈ every 3h at a 5-minute cron).
THRESHOLD="${QUIRE_UPTIME_THRESHOLD:-2}"
REMIND="${QUIRE_UPTIME_REMIND:-36}"
# ------------------------------------------------------------------------------

mkdir -p "$STATE" "$(dirname "$LOG")"
log(){ echo "[$(date +'%F %T')] $*" >>"$LOG"; }

hook_url="$(cat "$ALERT_HOOK_FILE" 2>/dev/null || true)"
[ -n "$hook_url" ] || log "WARN: no webhook at $ALERT_HOOK_FILE — outages will only be logged"

announce(){ # $1 color  $2 title  $3 detail
  [ -n "$hook_url" ] || return 0
  command -v jq >/dev/null 2>&1 || { log "WARN: jq missing, cannot announce"; return 0; }
  jq -n --arg a "$ALERT_ALIAS" --arg t "$2" --arg c "$1" --arg d "$3" \
    '{alias:$a,emoji:":satellite:",text:$t,attachments:[{color:$c,text:$d}]}' \
    | curl -sS -m 15 -X POST -H 'Content-Type: application/json' --data @- "$hook_url" >/dev/null 2>&1 || \
    log "WARN: webhook POST failed"
}

# Two attempts per URL, because the point is "is it down", not "did one packet drop".
probe(){ # $1 url -> echoes last http code, returns 0 iff a 200 came back
  local code
  for _ in 1 2; do
    code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 -H 'Cache-Control: no-cache' "$1" 2>/dev/null || echo 000)
    [ "$code" = "200" ] && { echo "$code"; return 0; }
    sleep 5
  done
  echo "$code"; return 1
}

bad=0
for url in $URLS; do
  # State is one small file per URL: the consecutive-failure count. Its absence means "was
  # up". Named by hash so a URL with slashes cannot escape the state dir.
  f="$STATE/$(printf '%s' "$url" | sha256sum | cut -c1-16)"
  if code=$(probe "$url"); then
    if [ -s "$f" ]; then
      n=$(cat "$f")
      rm -f "$f"
      # Recovery is only news if the outage was announced.
      if [ "$n" -ge "$THRESHOLD" ]; then
        log "UP again: $url (after $n failing runs)"
        announce "#2eb67d" ":large_green_circle: *$ALERT_ALIAS* UP" "$url is answering 200 again (was down for $n checks)"
      else
        log "blip cleared: $url"
      fi
    fi
  else
    n=$(( $(cat "$f" 2>/dev/null || echo 0) + 1 ))
    echo "$n" > "$f"
    log "DOWN($n): $url -> $code"
    if [ "$n" = "$THRESHOLD" ]; then
      announce "#e01b1b" ":red_circle: *$ALERT_ALIAS* DOWN" "$url -> HTTP $code, ${n} checks in a row"
    elif [ "$n" -gt "$THRESHOLD" ] && [ $(( (n - THRESHOLD) % REMIND )) = 0 ]; then
      announce "#e01b1b" ":red_circle: *$ALERT_ALIAS* STILL DOWN" "$url -> HTTP $code, ${n} checks and counting"
    fi
    bad=1
  fi
done
exit $bad
