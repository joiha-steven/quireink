# 0070 — The pen inlines only the strokes a page wrote

Date: 2026-10-03
Status: accepted; amends [0027](0027-the-pen-ships-only-where-it-wrote.md) (a marked page links the two sheets)
In force: see the [index](README.md). The index is maintained; this file is not.

## Context

0027 took the ink out of `site.css` and linked `pen-marks.‹hash›.css` and `pen-lines.‹hash›.css`
only on a page whose HTML carried a mark. That settled the inkless pages. A marked page still paid
for the whole case: 291 KB and 245 KB raw, 19.6 and 15.2 KB gzipped (ADR 0042 put a felt, a filter
and a gradient in every stroke), both render-blocking. Measured 2026-10-03 on the showcase
fixture: 31 of its 35 articles linked one sheet or both, and the article a review opened wore 6 of
the 120 dies in the highlighter's half.

Three deliveries were weighed against the first visit, which is the one a reader arriving from a
link makes:

- **The two whole sheets** (0027): cached a year and shared, but 19.6–34.8 KB and one or two
  blocking requests before any marked page paints.
- **A sheet per die or per group**: cacheable and small, but a page with six dies makes six
  blocking requests, and a cold request costs its round trip whatever it weighs. Loading them late
  is the flicker 0027 already refused.
- **Inline, only what the page wrote**: no request; the bytes ride the HTML that was coming anyway.

## Decision

A page inlines the pen's rules in a `<style data-pen-ink>` exactly where the two links sat — after
`site.css` and the dialect, before the settings block — and links neither sheet.

`pen/ink-subset.ts` decides what goes in without knowing anything about dies: it reads the page's
`<mark>` and `<u>` elements, and keeps each selector of the full sheet that matches one of them
and wins at least one declaration on it, in light mode or dark (specificity, then order; a
declaration is only beaten by one of the same property). The kept rules are the sheet's own, in
its order, byte for byte, so an element ends with the values it had. A selector it cannot read is
kept. `pen-style.test.ts` holds the parser to returning the whole sheet when every stroke is on the
page, and checks the deal for every variant in every ink against `PEN_GRIPS` and the pigments.

The whole sheets stay built, hashed and served: the reader's pen cannot know which strokes a
reader will make, and links them when one does — in front of the head's first `<style>`, so the
owner's switches and custom CSS keep winning their ties.

## Consequences

Measured on the 31 marked articles (origin, gzip): HTML plus pen CSS on a first visit fell from
1,084 KB to 344 KB in all; a one-mark article from 28.1 to 9.7 KB and the 15-mark one from 44.3 to
16.8 KB, with no pen request at all. 112 screenshot pairs (light and dark, 1440 and 390 wide)
matched to the pixel.

Costs accepted: the inline rules are not shared between pages, so a second marked article
re-sends its own dies (1.2–7.3 KB gzipped) where the sheets would have been cached — it takes a
dozen marked articles in one visit for the whole sheets to come out ahead. A render now parses the
two sheets once per process (or isolate) and filters them per page, on bodies that are cached.
