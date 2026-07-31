# Worklog archive — hardening, layout and the licence (2026-07-30 → 2026-07-31)

Rolled out of `../WORKLOG.md` when it passed the 700-line cap. Same rules: newest
first, append-only, never retro-edited — including the two entries at the foot whose
dates run ahead of the ones above them, which is how they were written.

The entries after this point are in [`../WORKLOG.md`](../WORKLOG.md).

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
[`admin-design.md`](../../docs/admin-design.md) and, more importantly, into the primitives —
`Setting` in `kit.tsx`, and a `note` slot on `Input`/`Textarea`, which took a label and
nothing else and so left every hint to be hand-placed by its caller. That is exactly how the
font pickers ended up explaining themselves BELOW the grid and the palette card carried a
tinted callout and a plain paragraph at two sizes. `ToggleRow` is now `Setting` + `Switch`, so
a toggle and a field share one label style; `CheckField` replaced the last two raw checkboxes.
One exception, stated in the doc: a boolean keeps its switch beside the label, because
stacking fifteen feature toggles makes that list worse, and the ORDER is unchanged.

**Analytics stops counting the owner and the box** ([`exclude.ts`](../../src/analytics/exclude.ts)),
which closes [parity §8](../../docs/spec/07-parity.md) and goes past it. The frozen tree only
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

## 2026-07-31 (later) — the licence stops saying "do whatever you like"

MIT grants the right to sell, and that was never the intent. What was wanted was: read it,
run it, change it, share it, but do not make money from it. MIT says the opposite of the
last clause, in the plainest possible words, and had said so since the first commit.

**Two candidates were rejected before PolyForm Noncommercial won, and both rejections are
worth keeping.** The first phrasing was "no commercial use, and no changing the code" — by
name CC BY-NC-ND, or PolyForm Strict for software. Under those terms an operator of a
*self-hosted blog engine* could not patch a security hole, build a container image, or
publish a fork. "Self-host this" and "do not modify this" cannot both be true.

AGPL looked right and is not. It is a real open-source licence, it lets operators patch, and
§13 blocks the fork-into-a-closed-SaaS move. But **AGPL does not restrict commercial use at
all**: sell Quire hosting all you like, just publish your changes. It swaps "nobody may
profit" for "nobody may close it", which is a different goal. The dependency audit run
before setting it aside is recorded in ADR 0015 rather than thrown away: all 331 packages
are copyleft-compatible, so AGPL stays available at zero dependency cost if this is ever
revisited.

**The honest consequences are written down rather than glossed.** Quire is no longer open
source; it is source-available, and the OSI definition is unambiguous about why. GitHub will
show "Other" because PolyForm is in SPDX but not in GitHub's own set. Companies that ban
noncommercial licences will stay away, which is the point. And the change **cannot** be
retroactive: everything through v2.0.0 was MIT and stays MIT for anyone who took a copy,
fork and resale rights included. 0 forks and 2 stars today, so the exposure is small.

The relicense was clean because the repo has exactly one contributor, 544 of 544 commits.
That property is now load-bearing, so `CONTRIBUTING.md` says a pull request grants the owner
relicensing rights. Merging one outside PR without that would end the option of ever selling
a commercial licence, permanently.

Every claim of "open source" in the repository was corrected rather than softened, including
the admin string in all six languages and the footer of the help guide. `LICENSE` now holds
the licence text and nothing else, so SPDX matchers can identify it; the code-vs-content
scope note it used to carry has moved into `README.md`.
