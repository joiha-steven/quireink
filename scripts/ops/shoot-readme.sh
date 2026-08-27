#!/usr/bin/env bash
# Rebuild the six README plates, from seeded fixtures, in one command.
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
# The post the desktop, book and editor panels open. It moved from `the-measure-is-the-design`
# when the fixture gained the Van Gogh post: a plate sells better showing the reed-pen letter,
# the floated 30% portrait and a four-painting gallery than showing the same feature set on a
# text-only page. The phone plate keeps a SERIES post (below) so the series box stays shown.
POST=the-reed-pen-in-van-goghs-letters
# The phone's article panel: a series box AND a full-width print above the fold.
MPOST=thirty-six-views-ten-thousand-impressions

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
# Scrolled to the gallery, so this one panel shows two things: the dark theme, and a 2x2
# `#grid` gallery of paintings — the feature the fixture had nowhere to photograph before.
bun run drive "$L/$POST" "$P/dark.png" \
  "document.documentElement.classList.add('dark'); document.querySelector('.gallery').scrollIntoView({block:'center'})" \
  1280 860 600 > /dev/null

# WHAT THE RENDERER DOES, at a size you can read it at. Three panels, and every number in
# the two lines below was decided by looking at the result rather than by taste:
#
#   • 820 wide, not 1280. At the wider viewport the reading column is 672px in the middle
#     of the frame with a contents rail beside it and air on the right, so the thing the
#     panel is ABOUT ends up a third of the picture. At 820 the rails drop and the column
#     fills it. Not narrower: the point is to see the formula WITH the prose around it.
#   • scale 2, because `compose-demo.ts` composes at 2x and resizes the plate down at the
#     end. A panel shot at 1x goes through that halving too and comes out looking like a
#     screenshot taken from across the room — which is exactly how the first version of
#     this plate was reported.
#
# The maths panel is aimed at the SUM, not at the first formula on the page: the simple
# one is `s_n = s_0 r^n` and it demonstrates nothing a browser could not have done in 1998.
MATHPOST=a-type-scale-you-can-defend
CODEPOST=what-a-subsetter-removes
PENPOST=five-inks-and-when-to-reach-for-each
bun run drive "$L/$MATHPOST" "$P/maths.png" \
  "[...document.querySelectorAll('math')].find(m=>/∑|≤/.test(m.textContent)).closest('p,div').scrollIntoView({block:'center'})" \
  820 640 800 2 > /dev/null
bun run drive "$L/$CODEPOST" "$P/code.png" \
  "document.querySelector('pre.plain-code').scrollIntoView({block:'center'})" \
  820 640 800 2 > /dev/null
bun run drive "$L/$PENPOST" "$P/pen.png" \
  "document.querySelector('mark').closest('p,li,div').scrollIntoView({block:'center'})" \
  820 640 800 2 > /dev/null
echo "== phone panels =="
# `drive` for all three, not `shot`, and this is not a preference: MOBILE=1 is drive.ts's
# env var and shot.ts has never read it. Shot at a 390px WINDOW with no device emulation the
# page lays itself out for a desktop and is then cropped, so the first two panels came back
# with every headline cut off mid-word at the right edge while the third — the only one
# driven — wrapped correctly. Two panels of a phone plate that were not phones.
MOBILE=1 bun run drive "$L/"      "$P/m-list.png" "void 0" 390 844 600 > /dev/null
MOBILE=1 bun run drive "$L/$MPOST" "$P/m-post.png" "void 0" 390 844 600 > /dev/null
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

echo "== setup panels =="
# The sixth plate photographs the three first-run screens, and they need what no seeded
# database can hold: a blog with NO owner (the claim screen refuses to exist otherwise)
# and the one-time token, which lives only in the boot log. So: a third, empty database.
# The two later screens are owner-gated, so after the claim panel the owner and a session
# are minted straight into the throwaway database — same trick as the seeder, no bypass in
# the server — and the server restarts to shoot them.
#
# `justify-content:flex-start` on every panel: the login layout centres vertically, and
# three cards centred inside three different content heights sit at three different
# heights on one plate. Top-aligned, they read as one row.
PORT_SETUP=3412
SETUP_DIR=$TMP/setup
DATA_DIR=$SETUP_DIR STORAGE_LOCAL_DIR=$TMP/up-setup PORT=$PORT_SETUP bun src/index.ts > "$TMP/setup.log" 2>&1 &
for _ in $(seq 1 40); do curl -sf -o /dev/null "http://127.0.0.1:$PORT_SETUP/api/health" && break; sleep 1; done
S="http://127.0.0.1:$PORT_SETUP"
TOKEN_PATH=$(grep -oE '/setup\?token=[A-Za-z0-9_-]+' "$TMP/setup.log" | head -1)
test -n "$TOKEN_PATH" || { echo "FAIL: no setup token in the boot log"; exit 1; }
TOP='var w=document.querySelector(".login-wrap"); if(w) w.style.justifyContent="flex-start"'
QUIRE_SESSION= bun run drive "$S$TOKEN_PATH" "$P/claim.png" "$TOP" 660 1180 800 2 > /dev/null

cat > "$TMP/mint-setup.ts" <<'TS'
import { openDatabases } from '@/store/db'
openDatabases(process.env.DATA_DIR ?? '')
const { createUser } = await import('@/auth/users')
const { createSession } = await import('@/auth/sessions')
const u = await createUser({ username: 'owner', email: 'owner@example.com', password: 'plate-shoot-only-2026!x' })
const { token } = createSession(u.id, { userAgent: 'plate' })
console.log(`QUIRE_SESSION=${token}`)
TS
SETUP_SESSION=$(DATA_DIR=$SETUP_DIR STORAGE_LOCAL_DIR=$TMP/up-setup bun "$TMP/mint-setup.ts" \
  | grep '^QUIRE_SESSION=' | cut -d= -f2-)
test -n "$SETUP_SESSION" || { echo "FAIL: the setup mint made no session"; exit 1; }
kill %3 2>/dev/null || true; sleep 1
DATA_DIR=$SETUP_DIR STORAGE_LOCAL_DIR=$TMP/up-setup PORT=$PORT_SETUP bun src/index.ts > "$TMP/setup2.log" 2>&1 &
for _ in $(seq 1 40); do curl -sf -o /dev/null "http://127.0.0.1:$PORT_SETUP/api/health" && break; sleep 1; done

# The address panel: the field autofills from the address the browser is on, which in here
# is a loopback port. The plate shows the value a real install shows, so the prep writes
# example.com over it after the autofill has run.
SITE_PREP="$TOP; setTimeout(function(){var i=document.getElementById(\"siteUrl\"); if(i) i.value=\"https://example.com\"},400)"
QUIRE_SESSION="$SETUP_SESSION" bun run drive "$S/setup/site" "$P/setup-site.png" "$SITE_PREP" 660 1180 800 2 > /dev/null
QUIRE_SESSION="$SETUP_SESSION" bun run drive "$S/setup/face" "$P/setup-face.png" "$TOP" 660 1180 800 2 > /dev/null

echo "== compose =="
# Empty labels on purpose: these screens name themselves, and compose-demo draws nothing
# for an empty label.
bun scripts/compose-demo.ts docs/demo-setup.jpg   "$P/claim.png::full" "$P/setup-site.png::full" "$P/setup-face.png::full"
bun scripts/compose-demo.ts docs/demo.jpg         "$P/front.png:the front page"   "$P/post.png:a post"
bun scripts/compose-demo.ts docs/demo-reading.jpg "$P/book.png:book mode:full"    "$P/dark.png:the dark theme"
bun scripts/compose-demo.ts docs/demo-mobile.jpg  "$P/m-list.png:the post list:phone" \
  "$P/m-post.png:a post:phone" "$P/m-search.png:instant search:phone"
bun scripts/compose-demo.ts docs/demo-code.jpg    "$P/maths.png:mathematics" "$P/code.png:code" "$P/pen.png:the pen"
bun scripts/compose-demo.ts docs/demo-admin.jpg   "$P/editor.png:the editor"      "$P/appearance.png:appearance"

echo
echo "done. Six plates rebuilt in docs/ — LOOK at them before committing:"
ls -la docs/demo.jpg docs/demo-reading.jpg docs/demo-mobile.jpg docs/demo-admin.jpg docs/demo-code.jpg docs/demo-setup.jpg | awk '{print "  " $5, $9}'
