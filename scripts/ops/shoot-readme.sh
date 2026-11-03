#!/usr/bin/env bash
# Rebuild the eight README plates, from seeded fixtures, in one command.
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

# Both bundles are gitignored, so a fresh checkout serves an admin with no island in it, and
# the theme tiles, the rail and the pen all photograph dead.
bun run build:assets > /dev/null
bun run build:admin > /dev/null

# What a still has no use for. The scroll fade dims whatever crosses the window's edge, which
# in a photograph is a paragraph that looks broken; the progress bar and the two floating keys
# answer a scroll nobody can see happening. This is the first line of every prep below, and it
# changes the picture only: nothing is saved.
CLEAN="document.documentElement.removeAttribute('data-scroll-fade');document.querySelectorAll('.progress,.to-top,.book-fab,.resume-pill').forEach(function(e){e.style.display='none'});"
# Put an element at the top of the frame instead of centring it: a panel that opens on a heading
# has a first line, and one centred on a formula opens on half of somebody's sentence.
top_of() { echo "var e=$1;scrollTo({top:e.getBoundingClientRect().top+scrollY-${2:-48},behavior:'instant'});"; }

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
export SEED_NOW=2026-11-02T09:00:00Z
SESSION=$(DATA_DIR=$TMP/list STORAGE_LOCAL_DIR=$TMP/up bun scripts/seed-showcase.ts "$TMP/list" text \
  | grep '^QUIRE_SESSION=' | cut -d= -f2-)
# `image`, unlike the list instance: the front page is the first picture in the README, and a page
# of grey type under a monospace masthead was selling the one thing it has no pictures of.
FRONT_SESSION=$(DATA_DIR=$TMP/front STORAGE_LOCAL_DIR=$TMP/up bun scripts/seed-showcase.ts "$TMP/front" image front \
  | grep '^QUIRE_SESSION=' | cut -d= -f2-)
test -n "$SESSION" || { echo "FAIL: the seeder minted no session"; exit 1; }
test -n "$FRONT_SESSION" || { echo "FAIL: the seeder minted no session for the front page"; exit 1; }
export QUIRE_SESSION="$SESSION"

echo "== serve =="
DATA_DIR=$TMP/list  STORAGE_LOCAL_DIR=$TMP/up PORT=$PORT_LIST  UPDATE_CHECK="${UPDATE_CHECK:-0}" bun src/index.ts > "$TMP/list.log" 2>&1 &
DATA_DIR=$TMP/front STORAGE_LOCAL_DIR=$TMP/up PORT=$PORT_FRONT UPDATE_CHECK="${UPDATE_CHECK:-0}" bun src/index.ts > "$TMP/front.log" 2>&1 &
for _ in $(seq 1 40); do
  curl -sf -o /dev/null "http://127.0.0.1:$PORT_LIST/" && curl -sf -o /dev/null "http://127.0.0.1:$PORT_FRONT/" && break
  sleep 1
done

L="http://127.0.0.1:$PORT_LIST"
F="http://127.0.0.1:$PORT_FRONT"
P="$TMP/panels"

echo "== desktop panels =="
# All at 2x: `compose-demo.ts` composes at 2x and resizes the plate down, so a panel shot at 1x
# goes through that halving too and comes out looking taken from across the room.
# Both from the front instance, in the Newspaper theme: the headline plate is one site's two
# pages. The theme goes through the settings route, for the reason given under "look panels".
curl -sf -o /dev/null -X PUT "$F/api/settings" -H 'content-type: application/json' \
  -H "origin: $F" -H "cookie: __Host-quire_session=$FRONT_SESSION" \
  -d '{"look":"paper","chromeFont":"inter"}'
# 1400 tall, the height that reaches the letter facsimile: shorter, the post panel is all type.
bun run drive "$F/"      "$P/front.png" "$CLEAN" 1280 1400 900 2 > /dev/null
bun run drive "$F/$POST" "$P/post.png"  "$CLEAN" 1280 1400 900 2 > /dev/null
# Book mode and the dark theme are reader STATE, invisible to a plain screenshot: both have
# to be clicked into existence, which is what drive.ts exists for.
bun run drive "$L/$POST" "$P/book.png" \
  "$CLEAN document.querySelector('[data-book-open]').click()" 1280 660 1200 2 > /dev/null
# The same height as the book panel, which it sits beside, and that height is the paragraph
# above the gallery down to the gallery's last caption, so the panel opens and ends on whole
# things: the dark theme and a 2x2 `#grid` gallery of paintings. It takes `:full` below: fading
# black into the plate's pale grey is a smear across the bottom of the picture.
bun run drive "$L/$POST" "$P/dark.png" \
  "$CLEAN document.documentElement.classList.add('dark'); $(top_of "document.querySelector('.gallery').previousElementSibling" 14)" \
  1280 660 900 2 > /dev/null

# WHAT THE RENDERER DOES, at a size you can read it at. 820 wide and not 1280: at the wider
# viewport the reading column is 672px in the middle of the frame with a contents rail beside
# it and air on the right, so the thing the panel is ABOUT ends up a third of the picture. At
# 820 the rails drop and the column fills it. Not narrower: the point is to see the formula
# WITH the prose around it.
#
# The maths panel is aimed at the SUM, not at the first formula on the page: the simple one
# is `s_n = s_0 r^n` and it demonstrates nothing a browser could not have done in 1998.
MATHPOST=a-type-scale-you-can-defend
CODEPOST=what-a-subsetter-removes
PENPOST=five-inks-and-when-to-reach-for-each
bun run drive "$L/$MATHPOST" "$P/maths.png" \
  "$CLEAN $(top_of "[...document.querySelectorAll('math')].find(m=>/∑|≤/.test(m.textContent)).closest('p,div').previousElementSibling" 12)" \
  820 640 800 2 > /dev/null
bun run drive "$L/$CODEPOST" "$P/code.png" \
  "$CLEAN $(top_of "document.querySelector('.prose pre').closest('figure,div.code-block,pre')" 12)" \
  820 640 800 2 > /dev/null
bun run drive "$L/$PENPOST" "$P/pen.png" \
  "$CLEAN $(top_of "[...document.querySelectorAll('.prose h2')].find(h=>h.querySelector('mark')||h.nextElementSibling?.querySelector('mark'))" 40)" \
  820 640 800 2 > /dev/null

# THE READER'S OWN PEN. No fixture can hold these: a reader's marks live in their browser until
# they ask to keep them, and the pen bar exists only while text is selected. So both panels
# make them the way a reader does, by selecting text and pressing the bar's own keys.
#   left:  a yellow highlight, an underline, and the bar open over a third selection, which is
#          the plain text after the author's first marked sentence
#   right: the card over the highlight, asked for a code. The code is real and is minted into
#          the throwaway database, which goes when this script ends.
PENKIT="$CLEAN
var ps=[...document.querySelectorAll('#post-body>p')].filter(function(p){return !p.querySelector('mark')});
function pick(p,n){var w=document.createTreeWalker(p,NodeFilter.SHOW_TEXT),t=w.nextNode(),r=document.createRange();r.setStart(t,0);r.setEnd(t,Math.min(n,t.length));var s=getSelection();s.removeAllRanges();s.addRange(r)}
function tail(p,n){var w=document.createTreeWalker(p,NodeFilter.SHOW_TEXT),t,l;while((t=w.nextNode()))l=t;var r=document.createRange();r.setStart(l,1);r.setEnd(l,1+n);var s=getSelection();s.removeAllRanges();s.addRange(r)}
function key(q){document.querySelector('.pen-bar '+q).click()}
function later(ms,f){return new Promise(function(r){setTimeout(function(){f();r()},ms)})}
scrollTo({top:ps[0].getBoundingClientRect().top+scrollY-28,behavior:'instant'});"
bun run drive "$L/$PENPOST" "$P/reader-pen.png" "$PENKIT
later(500,function(){pick(ps[0],58)}).then(function(){return later(500,function(){key('.pen-swatch[data-ink=yellow]')})})
.then(function(){return later(500,function(){pick(ps[1],44)})}).then(function(){return later(500,function(){key('.pen-u')})})
.then(function(){return later(500,function(){tail([...document.querySelectorAll('#post-body>p')].find(function(p){return /^Yellow/.test(p.textContent)}),17)})})" 1000 680 3600 2 > /dev/null
bun run drive "$L/$PENPOST" "$P/reader-keep.png" "$PENKIT
later(500,function(){pick(ps[0],58)}).then(function(){return later(500,function(){key('.pen-swatch[data-ink=yellow]')})})
.then(function(){return later(600,function(){document.querySelector('.prose [data-reader]').click()})})
.then(function(){return later(400,function(){document.querySelector('.pen-keep>button').click()})})
.then(function(){return later(400,function(){document.querySelector('.pen-keep div button').click()})})
.then(function(){return later(900,function(){document.activeElement.blur()})})" 1000 680 4200 2 > /dev/null

echo "== phone panels =="
# `drive` for all three, not `shot`, and this is not a preference: MOBILE=1 is drive.ts's
# env var and shot.ts has never read it. Shot at a 390px WINDOW with no device emulation the
# page lays itself out for a desktop and is then cropped, so the first two panels came back
# with every headline cut off mid-word at the right edge while the third — the only one
# driven — wrapped correctly. Two panels of a phone plate that were not phones.
# Scrolled to the first row that has a thumbnail: the plate is about the row (category, then the
# headline beside its thumbnail), not about the lead story above it, which has no picture.
# At 3x: 390 of them become a third of a 2400px plate, and 2x left the type soft.
MOBILE=1 bun run drive "$L/"      "$P/m-list.png" \
  "$CLEAN var a=document.querySelector('article[data-thumb]'); scrollTo({top:a.getBoundingClientRect().top+scrollY-44,behavior:'instant'})" \
  390 844 800 3 > /dev/null
MOBILE=1 bun run drive "$L/$MPOST" "$P/m-post.png" "$CLEAN" 390 844 600 3 > /dev/null
# Book mode on a phone scrolls the document (book-scroll.ts) and opens on its title page, which
# is what the plate shows, so there is no scroll after the click. The meta-line toggle is
# display:none at this width, but clicking it from script still opens the reader.
MOBILE=1 bun run drive "$L/$MPOST" "$P/m-book.png" \
  "$CLEAN document.querySelector('[data-book-open]').click()" \
  390 844 1200 3 > /dev/null
# The menu drawer (the rail's phone form), opened by the header's menu button: its search box
# sits on top, then the menu and the rest of the rail.
MOBILE=1 bun run drive "$L/$POST" "$P/m-menu.png" \
  "$CLEAN document.querySelector('[data-rail-toggle]').click()" \
  390 844 1200 3 > /dev/null

echo "== admin panels =="
# The slug is a PATH segment, not a query parameter: with ?slug= the page opened a blank
# editor, which looked plausible enough to ship.
#
# NOTHING IS TYPED OR SAVED HERE, and that is on purpose. This used to type one character at the
# end of the document and press Update, to get "Saved at" into the header. The end of that post
# is its footnote definition, so the dot landed in front of [^1]: and broke the footnote, and
# every later panel, the four looks included, showed a raw [^1] and 39 extra words.
# The first-run band is for a blog with nothing in it. This one has, so it is dismissed the way
# an owner does, and Home shows what it shows every other day.
bun run drive "$L/admin" "$P/a-home.png" \
  "$CLEAN [...document.querySelectorAll('button')].find(function(b){return b.textContent.trim()==='Got it'}).click()" \
  1440 900 1400 2 > /dev/null
bun run drive "$L/admin/content" "$P/a-write.png" "$CLEAN" 1440 900 1600 2 > /dev/null
bun run drive "$L/admin/editor/$POST" "$P/editor.png" "$CLEAN document.activeElement.blur()" 1440 900 3000 2 > /dev/null
bun run drive "$L/admin/settings?tab=appearance" "$P/appearance.png" "$CLEAN" 1440 900 1600 2 > /dev/null

echo "== look panels =="
# THE LOOK IS SET, NOT SWAPPED. The newspaper's masthead menu is markup the server draws only
# for a blog served in that look (`menuInHeader`, 2.2.14), so changing the attribute in the
# browser photographs a newspaper with its menu still on the shelf. Each look goes through the
# settings route with the seeded session, and the fixture's own look goes back after.
# With the chrome font each theme suggests, so a look is shot as a new install gets it: Plain
# paper in a monospace chrome is a picture of a blog nobody gets by default.
set_look() {
  local chrome=inter
  [ "$1" = code ] && chrome=jetbrains-mono
  curl -sf -o /dev/null -X PUT "$L/api/settings" -H 'content-type: application/json' \
    -H "origin: $L" -H "cookie: __Host-quire_session=$QUIRE_SESSION" \
    -d "{\"look\":\"$1\",\"chromeFont\":\"$chrome\"}"
}
for look in plain code paper notes; do
  set_look "$look"
  bun run drive "$L/$POST" "$P/look-$look.png" "$CLEAN" 1280 860 1200 2 > /dev/null
done
set_look code

echo "== setup panels =="
# The setup plate photographs the three first-run screens, and they need what no seeded
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
DATA_DIR=$SETUP_DIR STORAGE_LOCAL_DIR=$TMP/up-setup PORT=$PORT_SETUP UPDATE_CHECK="${UPDATE_CHECK:-0}" bun src/index.ts > "$TMP/setup.log" 2>&1 &
for _ in $(seq 1 40); do curl -sf -o /dev/null "http://127.0.0.1:$PORT_SETUP/api/health" && break; sleep 1; done
S="http://127.0.0.1:$PORT_SETUP"
TOKEN_PATH=$(grep -oE '/setup\?token=[A-Za-z0-9_-]+' "$TMP/setup.log" | head -1)
test -n "$TOKEN_PATH" || { echo "FAIL: no setup token in the boot log"; exit 1; }
TOP='var w=document.querySelector(".login-wrap"); if(w) w.style.justifyContent="flex-start"'
# 1000 tall, which is the tallest card and its footer: at 1180 a third of the plate was bare.
QUIRE_SESSION= bun run drive "$S$TOKEN_PATH" "$P/claim.png" "$TOP" 660 1000 800 2 > /dev/null

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
DATA_DIR=$SETUP_DIR STORAGE_LOCAL_DIR=$TMP/up-setup PORT=$PORT_SETUP UPDATE_CHECK="${UPDATE_CHECK:-0}" bun src/index.ts > "$TMP/setup2.log" 2>&1 &
for _ in $(seq 1 40); do curl -sf -o /dev/null "http://127.0.0.1:$PORT_SETUP/api/health" && break; sleep 1; done

# The address panel: the field autofills from the address the browser is on, which in here
# is a loopback port. The plate shows the value a real install shows, so the prep writes
# example.com over it after the autofill has run.
SITE_PREP="$TOP; setTimeout(function(){var i=document.getElementById(\"siteUrl\"); if(i) i.value=\"https://example.com\"},400)"
QUIRE_SESSION="$SETUP_SESSION" bun run drive "$S/setup/site" "$P/setup-site.png" "$SITE_PREP" 660 1000 800 2 > /dev/null
QUIRE_SESSION="$SETUP_SESSION" bun run drive "$S/setup/look" "$P/setup-look.png" "$TOP" 660 1000 800 2 > /dev/null

echo "== compose =="
# Empty labels on purpose: these screens name themselves, and compose-demo draws nothing
# for an empty label.
bun scripts/compose-demo.ts docs/demo-setup.jpg   "$P/claim.png::full" "$P/setup-site.png::full" "$P/setup-look.png::full"
bun scripts/compose-demo.ts docs/demo.jpg         "$P/front.png:the front page"   "$P/post.png:a post"
bun scripts/compose-demo.ts docs/demo-reading.jpg "$P/book.png:book mode:full"    "$P/dark.png:the dark theme:full"
bun scripts/compose-demo.ts docs/demo-mobile.jpg  "$P/m-list.png:the post list:phone" \
  "$P/m-post.png:a post:phone" "$P/m-book.png:book mode:phone" "$P/m-menu.png:the menu:phone"
bun scripts/compose-demo.ts docs/demo-code.jpg    "$P/maths.png:mathematics" "$P/code.png:code" "$P/pen.png:the pen"
bun scripts/compose-demo.ts docs/demo-reader-pen.jpg "$P/reader-pen.png:a reader marks a post" "$P/reader-keep.png:kept by a code, on every device"
COLS=2 bun scripts/compose-demo.ts docs/demo-admin.jpg "$P/a-home.png:home" "$P/a-write.png:write" \
  "$P/editor.png:the editor" "$P/appearance.png:appearance"
COLS=2 bun scripts/compose-demo.ts docs/demo-looks.jpg "$P/look-plain.png:plain paper" \
  "$P/look-code.png:source code" "$P/look-paper.png:newspaper" "$P/look-notes.png:notebook"

echo
echo "done. Eight plates rebuilt in docs/ — LOOK at them before committing:"
ls -la docs/demo*.jpg | awk '{print "  " $5, $9}'
