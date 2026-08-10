#!/usr/bin/env bash
# Rebuild the four README plates, from a seeded fixture, in one command.
#
# THE COMMAND IS THE POINT. `compose-demo.ts` was written so the images "regenerate from a
# command rather than an image editor", and then the command itself lived only in whoever
# had last run it: which URLs, at which widths, driven into which state, under which label.
# Reshooting therefore meant reading four JPEGs to work out what they were pictures OF.
# That is this file.
#
#   scripts/ops/shoot-readme.sh
#
# It seeds two throwaway databases (the list instance and the newspaper one, exactly as the
# demo runs), serves them, drives Chromium through the states a reader has to click for, and
# composes the plates. Nothing here touches a live site.
#
# Env: CHROME / CHROME_HEADLESS_SHELL — the browser binary, as drive.ts and shot.ts expect.
set -euo pipefail
cd "$(dirname "$0")/../.."

TMP=.tmp/readme-shoot
PORT_LIST=3410
PORT_FRONT=3411
POST=the-measure-is-the-design

rm -rf "$TMP"; mkdir -p "$TMP/panels"
trap 'kill $(jobs -p) 2>/dev/null || true' EXIT

echo "== seed =="
# The session token is what lets the admin panels be photographed at all: the admin needs a
# password AND a TOTP code, and the seeder mints a session into the throwaway database it
# just built. Same trick the demo uses, and it puts no bypass in the server.
#
# SEED_NOW PINS THE DATES. The seeder's origin follows the clock so the demo never opens on a
# four-month-old post; a plate wants the opposite, because otherwise every reshoot produces a
# different image of the same page and the diff is unreadable. Pinned here and nowhere else.
#
# STORAGE_LOCAL_DIR has to be on the SEED too, not just on the servers below. The media
# library is seeded with generated plates, and without this they land in ./uploads at the
# repository root while the servers read $TMP/up — so the library photographs as empty, which
# is the state the plates exist to stop it being in.
export SEED_NOW=2026-07-30T09:00:00Z
SESSION=$(DATA_DIR=$TMP/list STORAGE_LOCAL_DIR=$TMP/up bun scripts/seed-showcase.ts "$TMP/list" text \
  | grep '^QUIRE_SESSION=' | cut -d= -f2-)
DATA_DIR=$TMP/front STORAGE_LOCAL_DIR=$TMP/up bun scripts/seed-showcase.ts "$TMP/front" text front > /dev/null
test -n "$SESSION" || { echo "FAIL: the seeder minted no session"; exit 1; }
export QUIRE_SESSION="$SESSION"

echo "== serve =="
DATA_DIR=$TMP/list  STORAGE_LOCAL_DIR=$TMP/up PORT=$PORT_LIST  bun src/index.ts > "$TMP/list.log" 2>&1 &
DATA_DIR=$TMP/front STORAGE_LOCAL_DIR=$TMP/up PORT=$PORT_FRONT bun src/index.ts > "$TMP/front.log" 2>&1 &
for _ in $(seq 1 40); do
  curl -sf -o /dev/null "http://127.0.0.1:$PORT_LIST/" && curl -sf -o /dev/null "http://127.0.0.1:$PORT_FRONT/" && break
  sleep 1
done

L="http://127.0.0.1:$PORT_LIST"
F="http://127.0.0.1:$PORT_FRONT"
P="$TMP/panels"

echo "== desktop panels =="
bun run shot "$F/"      "$P/front.png"  1280 1180 > /dev/null
bun run shot "$L/$POST" "$P/post.png"   1280 1180 > /dev/null
# Book mode and the dark theme are reader STATE, invisible to a plain screenshot: both have
# to be clicked into existence, which is what drive.ts exists for.
bun run drive "$L/$POST" "$P/book.png" \
  "document.querySelector('[data-book-open]').click()" 1280 860 1200 > /dev/null
# The same height as the book panel. They sit side by side on one plate, and a panel 320px
# shorter than the one beside it leaves a band of bare plate under it that reads as a
# missing image rather than as a shorter page.
bun run drive "$L/$POST" "$P/dark.png" \
  "document.documentElement.classList.add('dark')" 1280 860 600 > /dev/null

echo "== phone panels =="
# `drive` for all three, not `shot`, and this is not a preference: MOBILE=1 is drive.ts's
# env var and shot.ts has never read it. Shot at a 390px WINDOW with no device emulation the
# page lays itself out for a desktop and is then cropped, so the first two panels came back
# with every headline cut off mid-word at the right edge while the third — the only one
# driven — wrapped correctly. Two panels of a phone plate that were not phones.
MOBILE=1 bun run drive "$L/"      "$P/m-list.png" "void 0" 390 844 600 > /dev/null
MOBILE=1 bun run drive "$L/$POST" "$P/m-post.png" "void 0" 390 844 600 > /dev/null
MOBILE=1 bun run drive "$L/$POST" "$P/m-search.png" \
  "document.querySelector('[data-search-open]').click(); setTimeout(function(){var i=document.querySelector('.search-panel input, input[type=search]'); if(i){i.value='page'; i.dispatchEvent(new Event('input',{bubbles:true}))}}, 200)" \
  390 844 1400 > /dev/null

echo "== admin panels =="
# The slug is a PATH segment, not a query parameter (src/admin/App.tsx routes on
# /admin/editor/<slug>). With ?slug= the SPA opened a blank "Start writing..." editor and
# the panel photographed an empty page, which looked plausible enough to ship.
bun run drive "$L/admin/editor/$POST" "$P/editor.png" "void 0" 1440 1000 2500 > /dev/null
bun run drive "$L/admin/settings" "$P/appearance.png" \
  "(function(){var b=[].slice.call(document.querySelectorAll('button')).find(function(x){return x.textContent.trim()==='Appearance'}); if(b) b.click()})()" \
  1440 1000 2200 > /dev/null

echo "== compose =="
bun scripts/compose-demo.ts docs/demo.jpg         "$P/front.png:the front page"   "$P/post.png:a post"
bun scripts/compose-demo.ts docs/demo-reading.jpg "$P/book.png:book mode:full"    "$P/dark.png:the dark theme"
bun scripts/compose-demo.ts docs/demo-mobile.jpg  "$P/m-list.png:the post list:phone" \
  "$P/m-post.png:a post:phone" "$P/m-search.png:instant search:phone"
bun scripts/compose-demo.ts docs/demo-admin.jpg   "$P/editor.png:the editor"      "$P/appearance.png:appearance"

echo
echo "done. Four plates rebuilt in docs/ — LOOK at them before committing:"
ls -la docs/demo.jpg docs/demo-reading.jpg docs/demo-mobile.jpg docs/demo-admin.jpg | awk '{print "  " $5, $9}'
