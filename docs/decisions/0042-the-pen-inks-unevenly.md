# 0042 — The pen inks unevenly, knows a word from a sentence, and moves into a module of its own

Date: 2026-09-09
Status: accepted (amends 0025's "grown dies" — the dies are still grown, and now carry their
physics; amends 0026's underline register and ring construction)

## Context

Three ADRs gave the pen its variety: grown dies dealt by a hash of the text (0025), an
underline and a ring (0026), and a delivery that only boards marked pages (0027). Put next
to photographs of highlighted paper one more time, the strokes still gave themselves away,
and the tell had moved. It was no longer repetition or corners. It was **evenness**: every
sweep laid one density of ink from end to end, with edges a vector tool would draw, and a
second pass that ran exactly parallel to the first. A felt tip never inks like that. The
ring, built from three pieces so a long word would not flatten its end curves, still read
as a capsule — two semicircles and two straight runs — and never crossed its own start, which
every ringed word in the photographs does. And the underline sat a tenth of an em too low,
under the descenders rather than through them.

A second thing was true of the code: the pen — grammar, dies, pigments, sheets, setting shape
— lived across `src/render`, `src/web` and `src/types-settings`, and the WordPress theme
already imported its emitter by reaching across repositories. A thing wanted elsewhere needs
an edge.

The review that drove the shapes was done by eye, on proof sheets, in three rounds. Two
findings from it are recorded here because they are easy to re-learn the hard way:

- **Sloppy is not handwritten.** The first underline candidate had gaps, fades and a wander,
  and read as a pen running out of ink. What reads as a hand is a confident stroke — steady
  ink, a little heavier where the hand pressed, a slight bow — with *shape* varying and
  *density* not. Only the highlighter, whose felt genuinely runs dry, is allowed to fade.
- **Fibres must be coarse and dense.** The first grain (fine across the stroke, biased low)
  drew stripes, like a scan artefact. Felt reads as streaks a pixel or two wide with the
  odd dry lane, over ink that is otherwise nearly full.

## Decision

**A die carries its physics, and the stamp applies them inside the data-URI.** `Fx` in
`pen/dies-kit.ts`: fibre grain (fractal noise as an alpha mask, low frequency along the
stroke and higher across it), edge tremor (a displacement of the outline), and wet-to-dry (a
gradient of opacity along the stroke, in a dealt direction). A faint unfiltered ghost sits
under it all, because paper soaks — where the felt skipped, the paper is tinted, never bare.
Both the `<filter>` and the `<linearGradient>` live inside the SVG, because an image used as
a background can reference nothing outside itself.

**The hand knows the length of what it marks.** The deck is eighty variants: the first forty
dealt to phrases over ~28 characters, the second forty to a word or two. Short dies tilt hard
(±4.5 units), overshoot further and dry faster; long dies barely tilt but bow. The renderer
stamps the number, as before — `penSeed` reads the length off the gesture's own source, so
cached bodies still carry identity and nothing re-renders to restyle.

**The ring is an oval that crosses itself.** Same three pieces, but the middle's two lines
bow outward, the caps' arcs meet them at the seam, and one cap carries a curved tail that
comes from inside the loop, over the arc, and out — the overshoot every ringed word in the
photographs has. Pressure varies round the arc.

**The underline sits on the baseline.** Box top at 1.0–1.04em against Literata's 1.16em
ascent puts the ribbon's ink on the feet of the letters, crossing the descenders. A pressure
envelope (heavier mid-stroke, lighter at the lift) replaces the wobble; opacity .88–.94 and
no gaps.

**Three generators, three seeds.** The highlighter, the lines and the link's dashes each draw
from their own PRNG stream (`dies-highlight.ts`, `dies-lines.ts`, `dies-link.ts`), so growing
or reseeding one can never move a stroke of another — which retires 0025's "append at the
end of the stream" fragility.

**The pen is a module.** `src/pen/` holds all of it with one door (`index.ts`) and one rule,
held by `boundary.test.ts`: no file inside imports from the application around it. The
server's `marked` adapter is split from the grammar it reads, so the grammar is import-free
for the four parsers built from it. The move itself shipped first, with the two sheets
byte-identical before and after, so the refactor and the redesign are separate commits.

**The share card takes a flat printing.** satori's rasteriser draws neither the filter nor
the gradient, so `penStrokeFlat` prints die 0's outlines once each, plain, with the sweep at
the density a wet felt lays down (.8). Pinned by the existing pixel test.

## Costs, measured

Gzipped, minified, at this change: `pen-marks` **11.6 → 19.6 KB**, `pen-lines` **8.5 →
15.2 KB**. A page using every gesture pays ~35 KB across its two immutable requests where it
paid ~20; an inkless page still pays nothing (0027 holds). Of the growth, the filter and
gradient defs account for ~5.5 KB and the rest is outline data: a die now prints its sweep
twice (ghost and wet — the second as a `<use>`, so raw bytes stay down) and more of its
outline is drawn. The trade is accepted for the same reason 0025 accepted the first: it is the
signature feature of a product named after ink. If it ever needs trimming, the known move is
still external per-die SVG assets at the price of a late-painting highlight.

Every stroke on every site reshuffles at the next deploy — legal and cache-safe, since the
sheets are content-hashed and bodies carry only identity — and this time it was done on
purpose and reviewed on the proof sheet three times.

The dark-mode ceiling from 0018 is enforced inside the generator: the band's opacity is
solved so ghost + sweep + band never compound past .905, and the grain can only reduce alpha,
never add to it.
