# 0014 — A homepage mode: the post list, a chosen page, or a composed front page

Date: 2026-07-31
Status: accepted
In force: see the [index](README.md). The index is maintained; this file is not.

## Context

`/` has only ever been page 1 of the post list (`app.ts`, `cached('/', () => home(1))`).
Two requests arrived together on 2026-07-31: set a static page as the homepage, and build
a front page in the shape a newspaper uses. They read as one feature and are not.

The second one needed evidence rather than memory, so the New York Times homepage was
photographed at 1280 and 390 the same day. What it actually does:

- Hierarchy comes from four dials, in this order of strength: **headline size** (about four
  steps), **whether there is a standfirst**, **whether there is an image and how big**, then
  **hairlines and column width**.
- **Most stories carry no image.** One per section leads with a large one; the rest are a
  headline, sometimes a standfirst. The entire right column is close to text-only.
- No cards, no boxes, no shadows. Rules and whitespace do all the separating.
- A section opens with a bold label and a row of related topic links beside it.
- On mobile everything collapses to one column and **the headline sits above the image**.

That fourth finding is the one that shaped this. An image is the third dial, not the
premise, so one layout grammar serves a site with photographs and a site without. Two
designs were not needed.

The instance this was asked for has no photographs at all: **72 of 72 published posts have
no `featured_image`**. It also has, measured the same day, **72 of 72 with a standfirst**,
categories at 17/17/11/9/8/8/8/6 posts and tags at 19/14/13/12/10/10 — so a text-led front
page has enough to fill every row today, with no content backfill.

The image plumbing is further along than it looks: the editor already has a picker for
`featuredImage` and `coverImage` on posts and pages, the media library stores them,
`finalize.ts` protects the blobs, `image.ts` builds 1024/1600 variants, `og.ts` renders the
share card from one, and the admin dashboard counts posts that lack one. Nothing renders
either as a visible element on the site. The gap is display, not storage.

Quire is open source and the roadmap's stated goal is that other people can run it, so the
constraint that shapes the rest: **an existing install must not change** when this ships.

## Decision

**One setting, three modes.** `home.mode` is `list` (default, exactly today's behaviour),
`page` (a chosen page renders at `/`), or `front` (a composed front page). `home.listPath`
says where the post list lives when it is no longer at `/`, defaulting to `/post`. Posts
keep their own `/{slug}` URLs in every mode.

`/page/:n` is deliberately **left alone**. It keeps serving the list wherever the list
lives. The pairing is untidy and it breaks nothing, which is the trade the owner chose.

**The front page is a fixed stack of row types, configured by options.** Not a block
composer, not drag and drop. The order lives in code; settings choose which rows appear,
how many posts each holds, how many columns, and where the posts come from. Row types:
lead, featured, category strip, most-viewed, latest.

**Two kinds, one grammar.** `home.front.kind` is `image` (default) or `text`. It moves the
dials rather than switching layouts: the image kind leads with a picture and a short
standfirst, the text kind drops the picture, raises the headline a step and lets the
standfirst run longer.

**No page-level sidebar on the front page.** Columns are a property of a ROW, so a
three-across row is three posts, not a rail. This is why the front page cannot be confused
with the post list, which keeps its sidebar.

**Zero JavaScript**, like every other public page here, and no new invalidation: the front
page is `cached('/')`, every write already flushes it (Invariant 1), the scheduler already
flushes when a post crosses its time, and `warm.ts` re-renders it.

## Consequences

- A new settings group of roughly twenty options, six locales of labels and hints, and an
  ordered category picker that is the fiddliest admin surface in the feature. **The
  configuration costs more than the rendering.**
- A card renderer that emits an image has to be written; the current one emits none.
- A most-viewed window of 7 or 30 days needs an analytics query that does not exist;
  `getViewTotals` is all-time only.
- The front page needs its own renderer and sheet. `renderListing` is not reusable: a row is
  not a card.
- The IDE chrome (`// label`, `[literal]`) is OFF by default, so **the front page has to look
  finished without it** and merely wear it when a site has it on.
- Two shippable pieces, in order: modes `list`/`page` first, `front` second.

## What this does not do

No block composer, no new content model, no new tables. It does not reopen
[ADR 0002](0002-no-saas-single-instance.md): this is still one instance per owner, and
serving self-hosters better is the roadmap's existing goal, not multi-tenancy.
