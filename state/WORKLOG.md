# Worklog

Newest first. What happened, not what is true now (that is `docs/`) or what is next (that
is `TASKS.md`). Keep entries short; the detail is in the commit.

Older entries roll into [`worklog/`](worklog/2026-07-quire-2-rewrite.md) when this file
passes its size cap. Rolling is a move, never a rewrite.


## 2026-07-31 — The demo is the front door, and the README shows the site that exists

`demo.quireink.com` is live, so it replaces `manhhung.me` as the "Live demo" link in both
READMEs and as the repository's homepage. `manhhung.me` is still named, once, as the
author's own instance; it is no longer the thing a stranger is sent to.

The demo carries none of this. It runs the tagged build unmodified, and its preview bar and
read-only edge live in a separate private repo (`joiha-steven/quireink-demo`) as one CSS file,
one JS file and an nginx vhost. Nothing in this repository knows the demo exists.

Also swept: `manhhung.me` out of the `Required Notice:` line, the SEO canonical placeholder
and two code comments, since a product's example URL should not be one person's blog. The
`open-source` GitHub topic is gone and `source-available` replaces it, which is what
PolyForm Noncommercial actually is.

**All four README plates were reshot.** The fixture was rewritten earlier the same day and
the images still showed posts that no longer exist, under the old site title. Two real
errors turned up on the way:

- **The README's install block ran `build:assets` alone**, with a comment claiming it also
  bundled the admin. It does not — `build:admin` is a separate script, and `docs/self-host.md`
  and the Dockerfile both run the pair. Anyone following the README got a server whose
  `/admin` was an empty page. Fixed in both languages, including the develop block.
- **The editor route is `/admin/editor/<slug>`, not `/<id>`.** The first pass shot `Not found`
  and composed it into the plate. Caught by looking at the image, which is the only thing
  that catches it.

## 2026-07-31 — The product is Quire Ink (ADR 0016)

`quireink.com` is bought: `demo.quireink.com` will be a public demo instance so `manhhung.me`
stops doubling as the showroom, and the apex is reserved for later. So the name moved with it.

**The wordmark is quireINK, and it is committed as outlines** in `src/brand-art.ts`: `quire`
in Inter, `INK` in JetBrains Mono, set tighter than the text default because a logo wants
that and a paragraph does not. That is the product's own type system stated as a logo rather
than a decoration laid on top of it. Outlines and not text for three reasons, and only the
first is aesthetic: /login must not depend on a font arriving, the admin renders in whatever
chrome font the owner picked (as text it would be a different logo per install), and
`pageStyles` declares only the owner's own faces plus Inter and JetBrains Mono, so nothing
else can be assumed present.

**The compact form is `Qi`** — the app icon, the favicon, the collapsed rail — and it is the
same two faces in the same order. The first cut had an abstract symbol beside the word; once
the compact mark became the word's own initials, showing both read as a stutter, so the
symbol is retired. One logo, two sizes.

**The app icon still said `vb`** — the name before the name before this one, two renames
stale, because nobody opens a 512px file. It and the favicon are generated from the same art
module now, so they cannot drift again.

Three names deliberately did NOT move: `quire.db` / `analytics.db` (the data files of every
install, and renaming them breaks every backup archive already written), the `__Host-`
session cookie (renaming it signs everybody out on deploy), and the systemd unit and service
user on the box (infrastructure, not repository). Historical documents keep the name they
were written under, and so does anything naming Quire 1.x.

## 2026-07-31 — The README, in two languages, and four demo plates that separate

**The images.** The four plates were laid straight onto the site's own `#fcfcfc` paper with no
edge, which is why the owner could not tell where one screenshot ended and the next began:
three white pages on white read as one wide page that had been cut up. A panel is now a SHEET
— a plate one shade darker, a hairline on every panel, a wider gap — and a page that
continues below the crop **fades out** along its bottom edge instead of ending in a hard cut
through half a line of type. Labels are sized as a fraction of the plate rather than in
pixels, because every plate is resized to the same output width from a different starting
width, and the widest one had been rendering its label at 4px in the README.

**The fixture.** `seed-showcase.ts` now also mints an owner and a live session, which is what
unblocked the admin plates: sign-in needs a password AND a TOTP code, and the session cookie
is `__Host-` prefixed, so no bypass in the SERVER was acceptable. It seeds a month of traffic
too — without it the dashboard reads 0 views and the front page's most-viewed row does not
render, so the plate is a screenshot of an empty database rather than of the software.

**Two bugs the plates found**, both in book mode and both invisible to `check:all`: a spread
was an unconditional two pages, so a narrow reader got two ten-character columns, and the
centred running head printed underneath the page counter. Both fixed, both now pinned.

**The README** is 16% shorter with more in it, and there is a Vietnamese one beside it with a
language link at the top of each.

## 2026-07-31 — A homepage that is not always the post list (ADR 0014)

`/` had only ever been page 1 of the post list. It now has three modes, and the default is
still exactly that, byte for byte: an install that upgrades into this sees no change until
somebody chooses one. Quire is open source and that constraint shaped the rest.

**Part 1, `list` / `page`.** Both branches resolve per REQUEST rather than when the routes
are registered — `createApp()` runs once at boot and the mode is a setting, so a route table
built from settings would need a restart and would quietly serve the old shape until it got
one. `home.listPath` (default `/post`) is guarded from both sides, because it is a third
occupant of the `/{slug}` namespace and whichever of the two lost would stop being reachable
with no error anywhere. A chosen page that is unset, trashed, unpublished or scheduled
forward falls back to the list: a 404 there is the site's front door. `/page/:n` deliberately
did not move.

**Part 2, the composed front page.** A fixed stack of rows with about twenty options, not a
block composer. The design came from photographing the NYT front page rather than
remembering it, and the finding that shaped it was that MOST stories there carry no picture:
hierarchy is size, then standfirst, then image, then rules. So the two site kinds are one
grammar with the dials moved, and a site with no images looks finished.

Four things were found by looking at renders rather than at source, and all four were real:
a three-column row holding one card is two thirds white space; three across inside a 672px
reading measure is three slivers, not three columns; per-render column CSS lands after the
sheet and beat its own media queries, handing a phone a grid it could not fit; and a card
under a category heading repeating that category is noise. A fifth apparent bug — mobile
overflow — was the screenshot tool not emulating a viewport, proved by shooting an untouched
post page and seeing the same thing.

`warm.ts` also finally warms `/`, which its own comment had claimed for weeks.

1183 tests, `check:all` green. `docs/homepage.md` split out of `features.md` at its cap.

## 2026-07-31: importing a real WordPress site broke two things nobody had run into

Migrated a 58-post WordPress blog into a second Quire instance, and doing it for real
surfaced two bugs that every synthetic test had missed.

**`collapseBlob` was eating a segment out of other people's URLs.** The prefix regex was a
global `/(?:https?:\/\/[^/]+)?\/uploads\//gi`, so it matched `/uploads/` anywhere in a
string, not only where a URL starts. Every WordPress site serves images from
`/wp-content/uploads/…`, so saving an imported post rewrote
`edcmeo.com/wp-content/uploads/photo.jpg` to `edcmeo.com/wp-contentphoto.jpg` — 252 images
pointing at files that had never existed, in silence, on write. It now anchors the same way
`expandWith` already did: string start, or right after `](` / `src="` / `href="`. The old
tests all passed because every fixture used our own `/uploads/` URL, where the bug is
invisible.

**Every imported draft was dated today.** `toIso(item['wp:post_date_gmt'] ?? item['wp:post_date'])`
looks like a fallback chain and is not one: WordPress fills `post_date_gmt` with
`0000-00-00 00:00:00` on anything never published, so `??` took the zero and the function
fell through to `now`. Thirteen drafts written over fourteen months all landed on the same
afternoon. Nested the two `toIso` calls instead.

**And the one that actually lost content: galleries kept their first photo and threw away
the rest.** A Gutenberg gallery is a `<figure class="wp-block-gallery">` wrapping one nested
`<figure><img>` per photo. The figure rule read `querySelector('img')` — the first match in
the whole subtree — and returned that single image as the replacement for the entire block.
152 of the site's 407 photographs never arrived; the photo library page kept 30 of its 169.
Nothing errored, and the imported page looked plausible, which is why the first verification
pass missed it: I checked that every image present rendered, never that every image expected
was present. Galleries now emit all their children, each tagged `#grid`, so `groupGalleries`
rebuilds the grid instead of leaving a vertical stack.

`src/import/wordpress.ts` had no test file at all; it has fifteen now, including all three
regressions. The import and image-rehost tooling stayed OUT of the repo — `conventions.md`
says the WordPress import is an in-app feature and not a script, and one migration is not a
reason to reverse that.


## 2026-07-31 (last): a contributor has somewhere to land

Putting the archive banner on `v1/CONTRIBUTING.md` left the repository with no contributing
guide at all, which is a worse state than the wrong one it replaced: the only copy taught
`npm ci` and a Docker Postgres to anyone who found it. `CONTRIBUTING.md` now exists at the
root and is a router like the rest of the layer, so it states no rule twice: it says what
Quire is, that `v1/` is closed to changes, where each kind of rule lives, that done means
`check:all` at 0, and that a change under `src/render` or `src/web` answers to the golden
gate as well. README's "run locally" now points at it.

Checking its claims retired a task rather than adding one. **"Stale citations left by the
flatten" is gone from `TASKS.md`: all four of its claims are false now.** The pull-request
template already asks for `bun run check:all` and cites no root `ARCHITECTURE.md`;
`scripts/port/LEDGER.md` records the backup routes, the MCP transport, the admin SPA and
Turnstile as landed; `docs/spec/01-schema.md` cites `v1/scripts/schema.sql`, with the prefix,
for the Postgres original it means; and neither `scripts/checks/file-size.ts` nor
`scripts/import-v1.ts` says `v2/` any more. The `v2/` path left in `LEDGER.md`'s own header
stays: `scripts/port/` is append-only, which is why `check:docs` skips it.

One contradiction found and deliberately not resolved, because it needs the code open:
`docs/README.md` says the `v1/src/…` citations were swept for the 2.0.0 release, while
`TASKS.md` and `CLAUDE.md` both still call that work outstanding. One of the three is wrong.

## 2026-07-31 (latest): 1.x is switched off, and the docs stop saying otherwise

The last 1.x instance was shut down three days after cutover, and the plan it was running
under is dead with it. The plan had been to keep the old tree serving on its own hostname
for three to six months as a live comparison target. In twelve days it took six hits while
holding roughly 660MB of RAM across the app, Postgres and PostgREST, so the comparison was
being paid for and not used. The application and PostgREST units were disabled, the
database was masked rather than merely disabled (disabled leaves it `enabled-runtime` and a
reboot brings it back), and both old hostnames were dropped from the proxy. A `pg_dump`
plus a plain-SQL copy were taken first and verified readable, so the tree can be brought up
again from data rather than from hope. The old package and its data directory were left on
disk on purpose.

Five documents still told a reader that `v1/` was running and taking security patches:
both `CLAUDE.md` routers, both `README.md` files, and `SECURITY.md`. All five now say
retired and unsupported. The one that mattered most is `SECURITY.md`, which was promising
a fix to anyone reporting a 1.x flaw. The observation task in `TASKS.md` that this
supersedes is gone. Nothing in `v1/` itself was touched: it is a record, and editing it to
say it is a record is how a record stops being one.

## 2026-07-31 (later) — one branch, and the local directory matches the repository

The owner's call on the two branches left over from the rename cleanup: delete both.
`codex/ui-review` was already merged into main, so nothing was lost. `preview/facelift` was
five unmerged mockup commits from 2026-07-10, tip `fd93347`; `codex/ui-review` was `514466a`.
Both SHAs are written here because that is the only trace left of them, and GitHub's restore
window is not forever. `origin` now has exactly one branch.

The working copy moved from `C:\dev\quire` to `C:\dev\quire-blog` to match. Nothing in the
tree depends on the directory name, but two things cache absolute paths and had to go first:
`tsconfig.tsbuildinfo` and `v1/.next`.

## 2026-07-31 — the repository is `quire-blog`, and every link says so

Renamed `joiha-steven/Quire` to `joiha-steven/quire-blog` on GitHub, for one name across the
project. GitHub redirects the old path indefinitely, so nothing broke at the moment of the
rename — which is exactly why the references needed chasing anyway: a link that only resolves
through a redirect is a link nobody notices is stale.

Nine files carried the old path: the clone commands in `README.md` and `docs/self-host.md`,
the security-advisory links in `SECURITY.md` and the issue-template config, `REPO` in the
admin help kit, and the default footer in `src/content/settings.ts`. The frozen `v1/` tree
held the same four strings and got them too. `check:all` green at 1125 tests.

The live instance had its own copy in the settings blob, which no code change would have
reached: the footer pointed at `/quire`. Updated in place (`/root/quire-settings-backup-2026-07-31.json`
holds the row as it was) and confirmed rendered at the origin.

Deployed `3e5544d`. Origin checks `/` 200, `/api/health` 200, `/admin` 302, dist trees back at
30 and 3. This time the old dist trees were **moved** to `/tmp/quire-old-dist` rather than
removed, which is the safer half of the same runbook step and leaves a way back. Purged.

Still open, and deliberately not touched: `origin/codex/ui-review` (merged into main, pure
leftover) and `origin/preview/facelift` (five unmerged mockup commits from 2026-07-10). Both
sit in a public repository. Deleting someone's branches is their call, not the cleanup's.

## 2026-07-31 — deployed: 010b577 is live on manhhung.me

Two commits, the 2.0.0 release and the drawer fix. `check:all` green at 1125 before the tar.
The box is `sv1-usa-joiha`, the same webserver the other sites run on, and `quire2` serves
:3100 from `/home/quire2/app` with `bun src/index.ts`.

The runbook's trap held this time: both dist trees were removed before extracting, and the
admin dist came back at **30 files**, not the 119 that tar-without-delete produced last time.

Verified at the ORIGIN before the CDN: `/` 200, a post 200, a missing slug 404, `/admin` 302,
health 200. The stylesheet hash moved `116u94xf2r` to `1pkfu0dxlg` — both sheets changed — so
`/api/cron?purge=1` ran and the log confirmed `edge-cache: purged`.

Then the actual complaint, measured through Cloudflare on the live site:

    post @360    innerScrollers 0    rail-inner 259 (was 291)
    post @390    innerScrollers 0    rail-inner 259
    post @414    innerScrollers 0    rail-inner 259
    home @390    innerScrollers 0
    post @390, drawer open           innerScrollers 0
    /tag/lego @390                   innerScrollers 0

`nav.toc.rail` was `clientWidth 299` against `scrollWidth 331` before this. No version bump
and no tag: 2.0.0 is already cut and the next number is the owner's call.

## 2026-07-31 — the drawer was a horizontal scroller, and the page never was

Reported: the mobile sidebar and post still pan sideways. The seeded demo could not reproduce
it, because the demo had the IDE chrome off and the live site has it on. Measured the live
site read-only instead, and the page was NOT the thing scrolling: `documentElement.scrollWidth`
was 390 on every page, closed and open. One element deep, `nav.toc.rail` reported
`clientWidth 299` against `scrollWidth 331`.

Two mistakes stacked. `.rail` sets `overflow-y:auto` and nothing else, and a box that names
one axis gets `auto` on the other rather than `visible` — so the drawer was always a
horizontal scroller waiting for a wide child. The IDE chrome supplied it: two ungated rules
grew `.rail-inner` to `calc(100% + 32px)` so the gutter's scroller could not clip a
line-number ring, and below 640px there is neither a gutter nor that scroller. Gated the whole
IDE rail block to the breakpoint the header already uses, and spelled out `overflow-x:hidden`.

**The guards were seen RED before they were trusted.** All three fail with the media wrapper
removed and the `overflow-x` line deleted; the first draft of one of them could not have
failed at all — it compared against `IDE_CSS.split(@media)[0]`, which covers only the sheet
above its FIRST media block, and the rail rules live below it. A second draft then flagged its
own explanatory comment, because these sheets name the selectors they explain. Comments are
stripped before the scan now.

Also checked and NOT changed: book mode at 390px lays out two ~24-character columns and the
header title collides with the pager. It is unreachable on a phone — `islands.css.ts` hides
the toggle below 768px — so that is a state no reader can open, reached only by clicking
`[data-book-open]` from the console. Left alone.

Four README images rebuilt from a seeded English instance and composed in HTML, so they are
regenerated by a command rather than edited by hand.

## 2026-07-30 (later) — the docs caught up with the code, and the README stopped lying

Release prep for 2.0.0, in three parts.

**A docs sweep.** Most of `docs/` was written against the frozen Next tree and carried over
because the RULES were current; the CITATIONS were not. `spec/02-structure.md` — the module
map CLAUDE.md routes everyone to — described directories that do not exist. `features.md`
described 5 settings tabs where there are 7, Postgres FTS where there is SQLite FTS5, and
next-auth comments twenty lines below a 2.0-aware bullet. `seo-pwa.md` and `agent-ready.md`
documented six endpoints that 404. All corrected, and the gaps that are real — no JSON-LD
while `seo.autoSchema` still ships as a toggle that controls nothing, and **URL redirects that
have CRUD, an admin screen and slug-rename hooks but nothing resolving them at request time**
— are now written down as gaps instead of features.

**`docs/self-host.md` was telling people to run a binary that throws.** `bun build --compile`
does not bundle sharp's native module, so `dist/quire` dies on the first image resize; the
live box has always run from source, and the `ExecStart` in that file pointed at the binary.
It also gained the missing section on the cron tick: nothing in the process schedules
anything, and no document anywhere told a self-hoster to call `/api/cron`, so a fresh install
had no on-time publishing and no pruning.

**A new hero image, and a bug it found.** The old `docs/demo.jpg` was tilted past legibility,
captioned "admin dashboard" while showing no admin, and entirely in Vietnamese on an English
README. Rebuilt from real screenshots of a seeded English instance, composed in HTML and
photographed, so it regenerates from a command rather than an image editor: reading view,
editor, phone, plus a second image for book mode and the dark theme. Shooting the dashboard
surfaced a live defect — an activity row gave its action a flat 120px track with no way to
shrink, and `auth.recovery.regenerated` needs 176px, so it painted over the detail beside it.
The FIRST fix was wrong and measuring caught it: a content-sized column removed the overlap
and then staggered the detail edge by 56px down the list, because the grid is on the row and
every row sizes its own tracks. A fixed 180px track with a truncate backstop keeps the list
aligned.

## 2026-07-30 — deployed: 1942a63 is live on manhhung.me

Seven commits, one release. `check:all` green at 1121 before the tar, and the box's
`build-sha` matches HEAD.

The runbook's trap earned its place again: `src/admin/dist` had **119 files** on the box and
should have 30, because tar does not delete and `spa.ts` reads the whole directory into RAM at
boot. Both dist trees were removed before extracting rather than diffed, which is safe here
precisely because they are build outputs the tarball carries in full.

Verified at the ORIGIN first, never through the CDN:

| | |
|---|---|
| `/` · `/api/health` · `/admin` · a missing slug | 200 · 200 · 302 · 404 |
| the reflected-XSS payload | `value="&quot; onfocus=…"`, quotes escaped, inert |
| a missing slug | `text/html`, `private, no-store`, carries `width=device-width` |
| the served stylesheet | 30,811 bytes, **zero** comment characters |

Then `/api/cron?purge=1` for the edge, because the stylesheet hash changed, and the same
checks through Cloudflare: the public page links `site.116u94xf2r.css` and it arrives at
**6,519 bytes compressed against the 20,903 it was this morning**. The feed link, the skip
link and the un-dimmed term counts are all in the live HTML.

The original complaint, measured on the live site at 390px, on the six pages that mattered:

    /khong-co-trang-nay-abc   viewport 390  scrollWidth 390  scrollsSideways false
    /tag/lego                 viewport 390  scrollWidth 390  scrollsSideways false
    /page/2                   viewport 390  scrollWidth 390  scrollsSideways false
    /search?q=lego            viewport 390  scrollWidth 390  scrollsSideways false
    /                         viewport 390  scrollWidth 390  scrollsSideways false
    a post                    viewport 390  scrollWidth 390  scrollsSideways false

The first three reported a 980px document this morning. No version bump and no tag: that is
the owner's call and was not asked for.

## 2026-07-30 (last) — the editor stopped losing work to a scroll gesture

Reported: a hard downward scroll in the post editor reloads the page. Confirmed as the
browser's own pull-to-refresh, which is a navigation nobody asked for, on the one screen in
this project where a navigation costs work. There is nothing above the top of an editor to
pull towards, so the admin now sets `overscroll-behavior-y: contain` and the gesture does
nothing. Measured in a phone-emulated browser with a real session: `contain` on both `html`
and `body`.

**The local snapshot only ran on a timer, and that was the actual loss.** Every eight seconds,
and a reload took whatever had been typed since. `beforeunload` does not reliably fire on a
mobile reload, so it was never going to be the net. The snapshot is now flushed on `pagehide`,
on a `visibilitychange` to hidden, and on unmount, with the interval as a floor rather than the
whole mechanism. Measured: type, hide the page well inside the eight seconds, and a snapshot
that did not exist a moment earlier is on disk.

Both editors carried their own copy of that effect and their own `beforeunload` handler, so
the fix would have been written twice and drifted once. They are `useLocalAutosave` and
`useUnsavedGuard` in `useLocalDraft.ts` now: 19 lines added across the two forms against 48
removed, and PostForm back under the 400-line rule it had just crossed.

**On autosave itself, the answer is not what it looked like.** The report was that 1.x had it
and the port lost it. It did not: `v1/src/components/admin/PostForm.tsx` says in its own
comment that "autosave is local-only, never server", which is exactly what 2.0 does. What 2.0
lacks is not the feature but a way to SEE it and a way to change its interval, and the reason
it is local-only is written at the top of `useLocalDraft.ts`: a server autosave cannot help
when the network is what dropped, and on an already-published post it would push half-finished
edits live. That is a decision worth keeping, so the configurable interval is filed as its own
task rather than smuggled in behind a bug fix.

check:all exits 0, 1121 pass.

## 2026-07-30 (last) — the admin's progress bar drew itself twice per click

The owner reported it and it was exactly right, which the source alone would not have told
anyone: the bar is keyed on a run counter, and a new key replays the animation from the left.

Measured before touching it, headless with an owner session and 4x CPU throttle, watching every
animation frame for a NEW bar element:

    39ms  bar appears        <- the route transition
   102ms  bar appears AGAIN  <- new element, animation restarts at the left edge
   103ms  bar marked done
   439ms  bar removed

The cause is a SEAM. A navigation is two halves owned by different things: React resolving the
route's chunk (a transition) and the new page asking for its data (an effect, which by
definition runs after the commit). For the few frames between them nothing is in flight, `busy`
goes false, and the bar took that literally: it marked itself done, then a new key restarted it.
`pending.ts` says in its own header that the bar has to cover both halves. It did; it just
believed the gap between them.

Fixed by giving the falling edge a 120ms grace, and by only bumping the run counter when the bar
was NOT already on screen. Re-measured on three routes: one appearance, one finish, no restart.
Content 33/320/659, settings 62/442/773, analytics 43/292/620.

**The escapers, finished.** The ten remaining private copies now import the canonical pair, so
the weak three-replacement variant cannot be reached for by accident. One exception, and it is
deliberate: `render/post-content.ts` keeps a local text escaper, renamed `escapeBodyText` so it
can never be confused with `escapeHtml`. The golden gate is a byte-for-byte equality check
against 1.x and `docs/spec/03-golden.md` states there is "nothing to review and nothing to
accept"; the canonical escaper turns `class="danger"` into `class=&quot;danger&quot;` inside an
escaped-for-display raw HTML block, which renders identically and is not the same bytes. So the
renderer's output is frozen and the comment says why, rather than re-baselining a fixture to
make a tidy-up pass. Attributes in that file already go through the canonical `escapeAttr`.

**A second node on the article's right divider**, level with the reading-mode row, because the
panel is a column of facts and then one row that DOES something and the space alone did not say
so. `::after`, not `::before`: the IDE chrome owns that row's `::before` for its `//` marker, and
two marks fighting over one pseudo-element is a bug this project shipped once already on the rail
rows. Measured rather than eyeballed: both dots land at x=1071 on a divider line at x=1074,
same 7px, same `--c-meta`.

check:all exits 0, 1096 pass.

## 2026-07-30 (later) — a reflected XSS on the public search page

Found while consolidating the HTML escapers, which is the one thing on the audit's list that
was filed as tidying. It was not tidying.

`web/search-page.ts` had grown its own `escapeHtml` covering `& < >` and nothing else, and
line 45 interpolates the reader's query into an attribute:

    <input type="search" name="q" value="${escapeHtml(q)}" ...>

So `/search?q=" onfocus=alert(1) autofocus x="` came back as

    <input type="search" name="q" value="" onfocus=alert(1) autofocus x="" aria-label="Search">

which is an event handler that fires on load, on a public page, from a link anybody can send.
Reproduced against a local instance on port 3199 before anything was changed, never against
production. `<` and `>` were escaped, so a script TAG could not be injected; the quote was all
it took, and the weak escaper was the only reason it was there.

Fixed by importing the canonical pair from `utils.ts`, which escapes both quote forms, and
`utils.ts` now exports `escapeAttr` as a named alias so a call site reads as the context it is
writing into. `preview.ts` had the identical shape on a `datetime` attribute, unexploitable
because only an ISO date reaches it, and is fixed the same way. Two regression tests: the
payload must stay inside the value, asserted by the attribute's own quote count rather than by
the payload's text, and a tag in the query must come back as an entity.

Then checked the whole tree rather than assuming: every other attribute interpolation in every
file that declares a private escaper already goes through that file's `escapeAttr`. So these
two were the only reachable instances, and what remains is the tidying the task was originally
filed as. That is now written down as such in `TASKS.md`, with the note that the strong escaper
also escapes an apostrophe and will therefore move the golden output.

The lesson is the one the audit stated and I under-rated: two functions with one name, where
the difference is which characters are escaped, is not a style problem. The weaker one gets
reached for by whoever writes the next line, and nothing fails when they do.

check:all exits 0, 1096 pass.
