# 0029 — The pen's colours become the owner's, and the defaults stay measured

Date: 2026-08-24
Status: accepted
Amends: [0018](0018-highlighter-pen.md), whose "the colours are NOT a setting" this replaces

## Context

ADR 0018 decided the five pigments were not a setting, and gave a good reason:

> A highlighter is not UI. It is a physical object dragged across the paper, and its pigment
> is the same fluorescent yellow whether the page around it is mono, sepia, ocean or forest.
> A highlight that restyled itself per palette would read as a coloured box, which is the
> exact thing this feature exists not to be.

The owner asked for the opposite on 2026-08-24: *"mấy cái màu sắc này, kể cả màu đánh dấu
highlight hay khoanh tròn, nên cho người dùng customize, những gì đang có sẽ là màu mặc
định, có thể reset về mặc định hết."*

Read carefully, the two do not collide. 0018 argues against the pen following the PALETTE —
a mark that turns amber on the amber theme and teal on the ocean one, so that it stops being
an object and becomes a decoration. That still holds and is not up for discussion here. What
the owner is asking for is a different thing: one pen for the whole site, whichever reader
is looking, and HIS choice of which pen it is.

There were three real obstacles, and they shaped the answer more than the principle did.

**A pigment is not a colour value.** It is 280 SVG data-URIs, because the stroke carries its
own colour — it cannot be a mask (0018 measured what masking does to Vietnamese diacritics)
and it cannot read a CSS variable from inside a data-URI. The two pen sheets are 273 KB
before minifying, hashed and served immutable (0027).

**A pigment is not one colour either.** It is four: the sweep, the same sweep pre-mixed into
a dark page at 45% — the brightest mix at which all five clear 5.0:1 — and two
ballpoint-strength versions for the gestures that are LINES, because a pale sweep is
invisible as a 2px underline.

**The defaults are measured, and two of them are hand-corrected.** Dark yellow is warmed by
hand so it does not read as the green at dark luminance. No formula reaches that.

## Decision

**Every field is an OVERRIDE, and `''` means the built-in.** `InkSettings` stores nine
strings, all empty by default. The measured values stay in `render/pen.ts`, where they can
still be corrected in a release, rather than being copied into every install's database on
its first save.

**An install that has chosen nothing is bit-identical to one that could not choose.**
`inkSignature()` returns `''`, `resolveInks()` hands back the built-in object itself, and the
two prebuilt sheets keep the hashes they have always had. This is tested, and it is the
property the whole design rests on: the sheets are immutable and cached for a year, so
minting a new URL for a site that changed nothing would throw away every reader's cache.

**A chosen pigment derives its own three companions** (`render/pen-derive.ts`). The dark mix
is not invented: it reproduces four of the five measured dark inks to the rounding, which is
how we know it is the same rule 0018 audited. The line versions hold the hue and take
saturation and lightness to the range the built-in lines occupy — looser, and only ever
applied to a colour somebody chose.

**The sheets are rebuilt on demand and cached under the signature, two deep.** Two, because
a page rendered a moment before the save names the old sheet and that fetch has to resolve.

**The contrast audit is kept as a WARNING, not a veto.** The admin says when a chosen pigment
puts the words under it below 4.5:1. It is the owner's pen; it is also this repository's
stated floor, and a setting that quietly discards an audit is worse than no setting.

**The selection colour joins them** — black on paper, the palette's mid grey on a dark page
by default, and two more overrides if the owner wants otherwise. That one is two inline CSS
rules rather than a sheet, so it is outside the signature entirely.

## Consequences

- A site that customises its pen pays for a rebuild on save (~270 KB of CSS regenerated) and
  holds roughly half a megabyte for the current and previous sheets. A site that does not
  pays nothing, which is nearly all of them.
- `render/pen.ts` remains the one place a pigment exists. Nothing else may hardcode one.
- 0018's argument against per-palette inks stands untouched. If a future change makes the
  pen follow the reader's palette, it contradicts 0018 and needs its own decision.
