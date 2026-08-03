> Split out of the feature docs when that file hit its 700-line cap. What `/` serves, and what
> happens to the post list when it is no longer there.

# Homepage mode

## Homepage mode — `src/web/home-mode.ts`, Admin → Settings → Site → Layout & menu

What `/` serves. [ADR 0014](decisions/0014-homepage-modes.md). `home.mode` is **`list`
(default: page 1 of the post list, byte for byte what this always did)** or **`page`
(a published page renders at `/`)**. The composed front page is part 2 and is not in the
union yet. Posts keep `/{slug}` in every mode.

- **Both branches resolve per REQUEST, not when the routes are registered.** `createApp()`
  runs once at boot and the mode is a setting, so a route table built from settings would
  need a restart to take effect and would quietly serve the old shape until it got one. `/`
  and the `/{slug}` catch-all each ask `home-mode.ts` instead.
- **`home.listPath` (default `/post`) is where the post list goes** once it leaves `/`. One
  segment, no nesting — it shares the `/{slug}` namespace, and one segment is the only shape
  whose collisions can be checked against that namespace at all. Guarded from **both** sides:
  `content/slugs.ts` refuses a post or page saved at the list's path, and `PUT /api/settings`
  returns `list_path_taken` (409) if the list is pointed at a slug something already holds.
  Whichever of the two lost would simply stop being reachable, with no error anywhere.
- **`/page/:n` is deliberately left where it is.** The list moves; its pagination does not.
  Untidy, breaks no existing link, and that was the trade chosen.
- **A missing homepage falls back to the list rather than 404ing.** `renderArticle` returns
  null when the chosen page is unset, deleted, unpublished or scheduled forward — four
  things that happen without anybody revisiting this setting — and a 404 there is the whole
  site's front door.
- **The chosen page's own slug 301s to `/`**, and the sitemap names the root, not the slug;
  it also names `listPath`, which appears in no table and would otherwise be listed nowhere.
- `warm.ts` now warms `/`. Its comment claimed that long before it was true.

### The composed front page (`home.mode = 'front'`) — `src/web/front.ts`, `front-card.ts`, `front.css.ts`

A fixed stack of rows, configured by options. **Not a block composer**: the ORDER lives in
code and settings choose only which rows appear, how big they are and where their posts come
from. Rows, in order: **lead → featured → one per category → most read → latest**.

- **Hierarchy is size, then standfirst, then image, then rules** — measured off the NYT front
  page on 2026-07-31, where most stories carry no picture at all. So `home.front.kind` is one
  grammar with the dials moved, not two layouts: `image` leads on a picture and keeps the
  standfirst short (130 chars on the lead, none on a card); `text` drops the picture, raises
  the headline a step and lets it run (240 / 120). A site with no images looks finished.
- **A post appears ONCE.** Rows are built in priority order over a shared `used` set, so the
  newest post is the lead OR the first card of its category OR the first of latest, never all
  three. A row left with nothing does not render — no empty headings.
- **A heading links only when it names a place.** A category has a page, so a strip's heading
  is a link. "Featured" and "Most read" do not, and pointing them at the post list — which is
  what shipped — meant clicking a heading called Featured handed the reader every post the
  blog has ever published. A heading that goes nowhere beats one that goes somewhere else.
- **One way on to the archive, on the LAST heading.** It was a bare link under the last row,
  full width with no rule above it, reading as something left behind rather than as part of
  the page; a newspaper prints a continuation at the end of the section it continues. It is
  attached to the last row that HAS a heading, so a front page whose only row is the lead
  shows none — at that size the list holds barely more than the page already does.
- **The grid clamps its columns to its item count**, because a three-column row holding one
  card is two thirds of a row of white space, and on a small blog that is the common case. A
  one-item row keeps a 42rem reading measure rather than setting a 1120px line. It then drops
  ONE column when the last line would hold a single card (four across three is a full line and
  then an orphan) — and only when dropping one actually helps, so seven across three keeps its
  three rather than trading a ragged line for a taller row.
- **The lead's kicker offsets the secondary column** (`.front-lead-row.has-kicker`). The two
  columns top-align, so a lead that prints a category line put the right-hand headlines 30px
  above the lead headline and the smaller column read first. The renderer knows whether the
  kicker is there, so it says so in a class rather than the sheet guessing with `:has()`.
- **Topic links print through `tagText`,** like every other tag on the site. This row was
  written without it and shipped "the web" where the listing sidebar and the tag page both say
  "the-web": five multi-word tags in a row with only a gap between them read as one sentence.
- **The page is wider than the reading column** (`--shell-w` → 1120px for the whole document,
  header and footer included). Three across inside a 672px measure is three slivers: measured,
  the secondary headline came out in a 110px column five lines deep.
- **No sidebar.** The rows already ARE the discovery blocks; keeping the rail would put
  most-viewed beside most-viewed (`listingPage({ noRail: true })`).
- **The picture comes AFTER the text in source order**, so a phone reads headline → standfirst
  → image with no work, and the desktop grid puts it back on the right. Same as NYT.
- Column counts are **static in the sheet, mobile-first** (1 → 2 at 641px → 3 at 901px). They
  were emitted per render once; that string lands in the page's inline style, after the sheet,
  so it beat the media queries and handed a phone a two-column grid it could not fit.
- `tagLinks` derives a strip's topic links from the tags of posts already in memory (a
  group-by, not a query) and hides the row under three tags. Cards inside a strip drop their
  own category label: the row heading already says it.
- `popular` ranks by real views over 7 days, 30 days or all time
  (`getViewTotalsSince`) — the row changes without the owner writing anything.
- **Zero JavaScript**, and no new invalidation: `cached('/')` plus Invariant 1 plus the
  scheduler's flush already cover it.
