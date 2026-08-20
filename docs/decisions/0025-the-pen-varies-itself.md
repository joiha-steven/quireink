# 0025 — The pen varies itself: grown dies, a per-highlight deal, and the stroke setting retires

Date: 2026-08-20
Status: accepted (amends 0018: its "three strokes, and they are a site setting" paragraph)

## Context

ADR 0018 gave the highlighter a hand-drawn stroke instead of the solid box every CSS
highlight on the web wears, and named the real tell: *the repetition and the corners*. It
fixed the corners. The repetition survived it, twice over, and both faults were only visible
by looking at a page next to photographs of genuinely highlighted paper:

1. **One die.** Every highlight on the site was the same SVG stretched — the same edge
   wobble, the same chisel at both ends. Two highlights in view was all it took to see the
   stamp.
2. **The jitter never fired.** The geometry variance added later keyed on `:nth-of-type`,
   which counts *siblings*. Most paragraphs hold exactly one `<mark>`, so nearly every
   highlight on a page was its paragraph's first and drew the same card. Measured on the
   fixture: a page of a dozen highlights, one silhouette, twelve times.

What real strokes have and machine strokes lack is not roughness but **variety**: tilt,
weight, how the pen lands and lifts, how much ink the felt had left. Variety is a quantity
problem, and hand-drawing dies loses to it — three were drawn, and three is a number a
reader learns to count.

## Decision

**The dies are grown, not drawn.** A seeded generator (`src/render/pen-dies.ts`) produces
10 die shapes — varying tilt, weight, edge tremor, chisel ends, an occasional taper where
the pen lifted, a dry lane where the felt split, pooled ink at the top edge and a darker
landing spot — and 40 *grips*: per-variant stroke height, vertical register, and asymmetric
overshoot past the words. The PRNG seed is a constant, so every build emits byte-identical
CSS; bumping the seed is a design change and gets reviewed by eye (`bun scripts/pen-sheet.ts`).

**Each highlight is dealt its variant by a hash of its own text.** The renderer stamps
`data-pen="0…39"` (FNV-1a of the token source, `render/ink.ts`) and the sheet maps the
number to a die and a grip. Content-addressed on purpose: a phrase keeps its stroke across
reloads and re-renders — a page that reshuffled its ink on every visit would feel haunted,
not hand-made. `data-pen` is *identity*, not appearance, so 0018's "the stroke is CSS,
never markup" holds: restyling the pen still evicts no cached body.

**The three-way stroke setting retires.** `marker` / `swipe` / `double` chose between three
uniformities; a pen that varies itself has nothing for a picker to do, and `swipe` was the
one option that clipped Vietnamese stacked diacritics. The setting, its sanitizer, its admin
card and its six locale keys are gone. Nothing an owner saved breaks: an old `highlight` key
in stored settings is simply ignored.

## Costs, measured

The sheet carries one data-URI per pigment per die: 10 dies × 5 inks × 2 modes. Minified it
went from ~31 KB to 171 KB raw — but the URIs repeat their path data across the ten
colourings of each die, so the wire cost is **20.5 KB gzipped for the whole sheet** (was
~6.5 KB), one immutable request, cached for a year. Set against the 51 KB the Literata
subsets already cost the first paint, that bought the signature feature of a product named
after ink. If it ever needs trimming, the known move is external per-die SVG assets
(~50 bytes per CSS reference, strokes fetched only when a page uses them) at the price of a
late-painting highlight on cold load.

The dark-mode contrast ceiling from 0018 is enforced *inside the generator*: sweep and band
opacities are clamped so composite alpha never exceeds the ~.91 the 45 % pigment mix was
audited at, and pools are placed clear of the band.
