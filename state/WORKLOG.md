# Worklog

Newest first. What happened, not what is true now (that is `docs/`) or what is next (that
is `TASKS.md`). Keep entries short; the detail is in the commit.

Older entries roll into [`worklog/`](worklog/2026-07-quire-2-rewrite.md) when this file
passes its size cap. Rolling is a move, never a rewrite.


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

## 2026-07-30 — a phone gets a page it can read, and the sheet stops shipping its own comments

Audited the whole project against three questions the owner asked: whether the mono-minimal
intent holds on both surfaces, whether the frontend is as light as it can be, and what bugs
and dead weight are left. Then fixed what the audit found, mobile first, because the report
that mattered was the owner's: the layout scrolled sideways.

**The sideways scroll was the 404.** Not a stylesheet bug at all. Every public miss returned
`text/plain`, and a plain-text body carries no viewport meta, so a phone laid two words out at
the default 980px desktop width and let the reader pan. Measured at 390px: `/tag/lego`,
`/page/2` and any unknown slug all reported `documentElement.clientWidth` of **980**, while
the home page and every post reported 390. The strings for a real 404 page had existed in all
six locales since the port and nothing ever rendered them. `notFoundPage()` now renders a miss
in the site shell, dressed as an empty listing, and every HTML 404 goes through it. Re-measured:
390px, no overflow. It is never cached in either cache.

**The one real overflow was the search form.** `form.search` was written from the same shape as
`form.subscribe` and lost its `min-width:0`, so the input would not shrink below its intrinsic
size and pushed the button's right border off-screen (measured: `scrollWidth` 391 against a
390 viewport, and both controls 78px tall because the label wrapped). It stacks on a phone now,
like the sign-up form it was copied from.

**The rest of the mobile work was measured, not guessed**, in a new `mobile.css.ts` appended
last. Drawer rows 22px → **43px**, tag cloud 22px → **37px**, footer links 18px → **35px**;
form controls floored at **16px** on phone widths (14.08px before, which is what makes iOS
zoom the page on focus) and confirmed still 14.08px at 1440px, so the floor does not leak into
the desktop. Copy-code is visible under `@media (hover:none)`; the drawer scrim has a faint
dim, because two solid surfaces separated by one hairline gave the tap-to-close area no
affordance at all; `100dvh` beside `100vh`; safe-area insets on the back-to-top button and the
drawer. The IDE chrome's tokenised header buttons get `min-height:2.25rem` — that rule starts
at 640px, which a phone in landscape clears while still being tapped with a thumb.

**The sheet was 52% comment text.** See `docs/performance.md`: 65,645 bytes raw with 34,438 of
comment, now 30,811 raw / **6,519 compressed against 20,903 live** — 14.4 KB off every cold
visit. Minifying it is what surfaced the `ide.css.ts` comment that never opened, and with it a
rule that had never applied since the IDE chrome shipped. `check:css-literal` counts comment
delimiters now.

**Contrast, discovery, keyboard.** `.term-count` carried `opacity:.6` over `--c-meta`, which
measures **2.26:1** and fails AA at any size; it only ever looked acceptable because the IDE
chrome resets the opacity, so the site the owner sees was never the one shipping the failure.
Book mode's `--c-meta` was 3.30:1 on its paper (the running head and the page count, the two
things a reader checks without stopping) and is now #6f6a5c at **4.93:1**. `/feed.xml` answered
correctly and nothing on the site pointed at it: there is a `rel="alternate"` link now, gated
on the same setting the route is. A skip link is the first tab stop on every public page, in
`siteHeader` so both shells get it and the one-field sign-in page does not. One `:focus-visible`
ring for the whole site, replacing the `outline:none` that had made the sign-up field the only
control where keyboard focus vanished.

**Admin.** Toasts are announced (`role="status"`, `alert` for a failure) and carry a glyph, so
success and failure differ by more than inverted black and white. The `danger` button variant
was byte-identical to `primary`, which made "Delete forever" the loudest control on its screen;
it is outlined now, with primary's fill reserved for the action you came to do. Every admin
field is floored at 16px on phone widths, same reason as the public side.

**Security and dead weight** (the parts a subagent completed before the session limit cut it
off): `safeNext` rejected `//host` but not `/\host`, which browsers normalise into a
protocol-relative URL and follow off-site — its sibling `safeReturnPath` had guarded the pair
correctly all along. `server/cdn.ts` is deleted: a second Cloudflare purge with no request
timeout, three callers repointed at `purgeEdge`. `og.ts`'s two server-side fetches are bounded
and no longer trust a Host header when `SITE_URL` is unset. `render_cache` was insert-only with
nothing ever deleting; the hourly tick prunes it in bounded batches, with no VACUUM, because
this database runs in WAL.

Gate: `bun run check:all` exits 0, **1095 pass / 0 fail** across 85 files. CI has been green
since 2026-07-29, so the "CI is red" item at the top of `TASKS.md` was already stale.

**Not done, and not guessed at:** the escaper consolidation (`escapeHtml` is re-declared in 12
files in a weaker three-replacement variant than the `utils.ts` export, which is the shape of a
future XSS regression), the dead-code sweep (`comment-tree.ts`, five dead exports, four
orphaned upload routes, two unused Tiptap dependencies), and the documentation drift — including
two links in the live admin's Help screen that 404 because their targets moved under `v1/`.
Those are listed in `TASKS.md`.
## 2026-07-30 (last) — every tab is two columns, and the public bar is gone

**No tab is one column any more.** Two of seven behaving differently from the rest reads as a
mistake rather than as a choice, which is how the owner read it. Fixing it meant splitting the
CONTENT rather than leaving a layout ragged:

- **Site** was one card holding two questions. Identity (language, title, description, excerpt
  length) stays in `SiteFields`; the marks (logo, its dark twin, favicon, app icon) are
  `BrandFields`. The two come out within a card's height of each other.
- **Reading** was fifteen switches beside one. `FeatureFields` is now three exports: what a
  reader gets on a POST (9), what they get on the LISTING they arrive from (5), and the
  activity log — which was never a reader feature at all, and sat in the middle of that list
  only because there was one list to put it in. Left column: post features. Right: listing,
  comments, log.

Both splits moved which group RENDERS a key, never the keys themselves, so nothing about the
stored shape changed. `ONE_COL` is deleted rather than left unused: a constant nothing calls is
one somebody re-adopts for the wrong reason.

**The public navigation bar is removed**, at the owner's word: it did not show up for them and
they did not want it. Island, CSS, the call in `core.ts`, the budget bump and the docs section
all gone; `core.js` is back to 8,689 bytes, byte for byte what it was before the feature. The
admin's bar stays, and is a different thing: there, a navigation is a transition inside one
document and the bar is the only signal a click did anything.

## 2026-07-30 (later) — the two-column layout was the actual complaint

The order rule landed and the screens still looked wrong, because the problem was never the
order inside a card. **A grid lays its children out in rows, and a row is as tall as its
tallest cell.** Import beside Backups meant a void under Import; Cache then started below
both and sat stranded at the foot of the left column. Every tab did it. Owner: "is splitting
into two columns so hard, leaving gaps like that".

Each tab is now `GRID` holding two explicit `COL` stacks, with cards assigned to a side by
hand so the two come out close in height. Each stack packs independently and there is no row
to align to. `ONE_COL` (`max-w-3xl`) for the tabs whose cards cannot balance: fifteen feature
toggles beside a single comments switch is a column and a void, not a layout.

**And the MCP card is half width again.** Spanning it to give its five-column table room, which
was yesterday's fix, turned it into a wide slab under a two-column tab — the owner's "suddenly
MCP is this big column". A table that does not fit scrolls inside its card; a card is not
widened to suit its contents. Written into `admin-design.md` as a corollary, because it looked
like an improvement while making it worse.

**The admin tab said "Quire".** It says `Quire blog · <domain>` now, which is the one thing a
tab among fifteen tabs is for. The favicon was worse than absent: the shell linked none, so the
browser fell back to `/favicon.ico`, which is the icon compiled into the PRODUCT — an owner who
had uploaded their own was looking at Quire's mark. The shell links theirs now, and
`/favicon.ico` itself redirects to it when one is set, so a bookmark or a feed reader gets the
right image too.

**The public bar was working and invisible.** Two reasons, both mine: `--c-accent` in a
monochrome palette is nearly the page colour, and a 150ms delay on a site this fast means it
never gets to appear. `--c-heading`, 3px, 60ms.

## 2026-07-30 — one rule for every setting, and the reader gets a progress bar too

Owner, after looking at the live admin: the progress bar and the cache card are not there
(they were only in git; the box still ran the old bundle), the MCP card is broken, the
settings screens are scattered and ugly, the public site needs a loading bar too, analytics
should not count the owner, and add a way to mark a selection as code.

**The MCP card, and why it was two bugs in a shared primitive.** `ui/Button` had neither
`whitespace-nowrap` nor `shrink-0`, so in a flex row beside three lines of prose the buttons
were squeezed until their own LABELS wrapped: "Tạo token" across two lines, twice as tall as
its row. And the button's `min-h-10` sat next to a 28px value box, which is what "the button
is bigger than the field" was. Both fixed in the primitive, so no other card can repeat them.
The token table also moved to a full-width card: five columns clipped at the edge of a
half-width one at every screen size.

**THE RULE: what it is, what to know about it, then the control.** Written into
[`admin-design.md`](../docs/admin-design.md) and, more importantly, into the primitives —
`Setting` in `kit.tsx`, and a `note` slot on `Input`/`Textarea`, which took a label and
nothing else and so left every hint to be hand-placed by its caller. That is exactly how the
font pickers ended up explaining themselves BELOW the grid and the palette card carried a
tinted callout and a plain paragraph at two sizes. `ToggleRow` is now `Setting` + `Switch`, so
a toggle and a field share one label style; `CheckField` replaced the last two raw checkboxes.
One exception, stated in the doc: a boolean keeps its switch beside the label, because
stacking fifteen feature toggles makes that list worse, and the ORDER is unchanged.

**Analytics stops counting the owner and the box** ([`exclude.ts`](../src/analytics/exclude.ts)),
which closes [parity §8](../docs/spec/07-parity.md) and goes past it. The frozen tree only
asked for a session, so the owner in a second browser still counted. Three exclusions now: a
live owner session, any address a live session was created from (the salted `ip_hash` the
sessions table already keeps, so nothing new is stored and no list is maintained by hand), and
any loopback or private address, which is the box talking to itself. Tested in both directions,
because too tight looks like a traffic drop rather than a bug.

**A navigation bar for readers too.** The public site is real page loads, so a tap left the
old page looking untouched. 565 bytes in `core.js` (budget 8,800 → 9,400), and it intercepts
nothing: it sets one attribute and the stylesheet draws a root pseudo-element from it. The
150ms delay before it appears is the part worth keeping — `speculation-rules` prerenders on
hover, so most navigations finish in single digits and a bar shown every time would read as a
glitch.

**The code button already existed.** Fifth in the selection toolbar, `toggleCode()`, wearing a
bare backtick the width of a comma next to four letters. It is `</>` now, and every button in
that bar finally has a tooltip.

**A test I wrote yesterday broke because of one I wrote today.** `blob-local.ts` resolved
`STORAGE_LOCAL_DIR` at module load, so its value depended on WHEN the file was first imported;
`bun test` shares a module registry across files, so a new suite that imported the app first
made the storage-stats suite write its fixtures into the repository's own uploads directory.
Read at use now. Invisible in production, which is what made it worth fixing rather than
working around.

Also: put a backtick in a comment in `islands.css.ts` — the file whose own header says that
ends the template literal and has cost two debugging sessions. Three now.

**Deployed, which is what the first complaint actually was.** The box was still running
`c5216cd`, two days of work behind, so none of yesterday's admin work was on the site the
owner was looking at. `319c87f` is live: snapshot of both databases taken first (`vacuum
into`, 27 MB), tarball extracted as the service user, `build-sha` written, service restarted.
Verified at the origin and then through the CDN, which the boot purge had already cleared:
`/api/health` ok, 75 pages warmed, and the served `core.<hash>.js` and `site.<hash>.css` both
carry the new navigation bar.

## 2026-07-31 — thirteen code-scanning alerts, and what they were actually worth

The Security tab looked alarming: thirteen open alerts, three of them **critical**. It was
mostly an illusion of scope. Seven live in `v1/`, including all three criticals, and `v1/`
has not run anywhere since the shutdown earlier today. Code scanning is on GitHub's default
setup, which offers no path filter, so it re-reports the retired tree on every push. The
repeated analyses in the log are the same twelve findings, not twelve new ones each time.

**The one real defect was a divergence, not a mistake.** `newsletter-html.ts` had two local
copies of the same escaper, one per page. `confirmPage` escaped `"`; `resultPage` did not,
and then interpolated into `href="${esc(homeUrl)}"`. The value is the owner's own site URL,
so this was never reachable by a reader, but the two copies are the whole story: the moment
there are two, one of them is behind. There is one escaper now, at module scope, and it
escapes `"`. Both pages have tests for the attribute case.

**Rejection sampling in the recovery codes, and the old comment was not wrong.** It argued
that `% 30` bias is irrelevant at 49 bits against five attempts an hour, and it is. But the
fix is four lines and the alternative is that every future reader re-runs the same argument.
Bytes at or above 240 are re-drawn now. The test asserts the whole alphabet still appears,
because getting a rejection bound wrong shows up as a silently truncated character set.

**`mail.ts` I tried to fix and then put back.** The alert says the tag-strip feeding an
email's `text/plain` part "may still contain `<script`". I wrote a fixpoint loop, then ran
it: `<scr<x>ipt>` came out as `ipt>alert(1)ipt>` and `<script src=x`, with no closing angle
bracket to match, passed through completely untouched. The loop fixed nothing it claimed to.
The honest position is the one the comment now states: this is not a sanitizer, its output
never reaches an HTML context, and its input is HTML we generated. Dismissed, not patched.

Also: an explicit `permissions: contents: read` on the CI workflow, and `drive.ts` resolves
its callback to a value and checks it before calling. Neither changes behaviour.

**Deployed.** The box was on `55e8eeb`, so this shipped the WordPress-import and blob work
from the previous session alongside it. Both databases snapshotted first (`vacuum into`,
49 MB), the two `dist` directories moved to `/tmp` before extracting, `chown quire2`,
restart. `35072a1` is live: 30 files in `src/admin/dist` and 3 in `src/assets/dist`, the
counts the runbook expects. Verified at the origin, not through the CDN: health 200,
`/admin` 302, and the unsubscribe page now URL-encodes a `"><script>` token into its form
action with nothing raw leaking. Edge cache purged. No errors in the journal.
