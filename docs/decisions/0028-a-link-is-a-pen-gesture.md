# 0028 — A link is underlined by the pen, in dashes

Date: 2026-08-21
Status: accepted

## Context

A body link was invisible, and that is a measurement rather than an impression. It carried
two cues and both were beneath seeing:

- **Colour.** `--c-link` against `--c-text` measures **1.24:1 on the default mono palette**
  and 2.72:1 at its most generous (amber, light). Colour acting as the only distinction
  wants 3:1. No palette, in either mode, reaches it.
- **A hairline** in `--c-rule`, which measures **1.16–1.33:1 against the paper** across all
  twelve palette-and-mode pairs. A 1px line at that contrast is not a line.

It was reported as an inserted link looking barely different from ordinary text.

Two answers were tried and rejected before this one.

**Colour alone, set darker.** Proposed as removing the rule and setting links in the heading
colour. Measured across all twelve pairs: heading against body text is **1.24–1.35:1**. It
removes the weak cue and replaces it with no cue.

**Weight.** Built, rendered and measured at reading size: a 500 link is **2.1% wider** than
the prose around it and only **1.8% narrower** than a bold word. It is simultaneously too
faint to notice and, once noticed, too close to the one thing it must not be confused with.
No weight escapes this, because `<strong>` already owns 600 in the two serif presets and 700
in the two sans ones — the reading fonts leave exactly one step free, and one step is not
enough at 18px.

## Decision

A link is underlined **by the pen, in dashes**: the mark a reader makes under a line they
mean to return to, and visibly not the solid `++underline++` a writer draws.

Three consequences follow, and each is the opposite of what the other dies do.

**It tiles rather than stretching.** Every other die in `pen-dies.ts` is stretched to its
phrase, because a sweep belongs to the words under it. A dash is a physical size a hand
made, so stretching would give a long link long dashes. `background-repeat: repeat-x`: a
longer link gets *more* dashes, not bigger ones.

**Its ink is the pen's graphite, not `--c-link`.** A hex baked into an SVG cannot read a CSS
variable, which is the same constraint ADR 0018 met and made the same way. Measured against
all six palettes in both modes the graphite lands **4.97:1 to 7.01:1** against the paper.
The word keeps the site's colour; the mark under it belongs to the pen.

**It lives in the always-loaded sheet.** ADR 0027 moved the writer's gestures into two
sheets that only board pages carrying a mark or an underline. A link is on nearly every page
ever rendered, so this rides in `prose.css.ts` instead — two data-URIs per mode rather than
the pen's 280, **0.99 KB gzipped**.

The shape was **chosen by looking**, not by reasoning: four candidate runs were grown and
printed at eight times reading size, and the tidy ones lost. A run where every dash is the
same length on the same line reads as a machine's dashed rule however much edge wobble it
carries. What reads as a hand is one stroke running long, the next a stub, and the two
disagreeing about where the line is. The vertical drift is the one number pulled back from
what looked best in isolation: under actual words, a line that wanders too far stops reading
as a hand and starts reading as a misaligned rule.

The dashes sit **below** the descenders; the writer's `++underline++` crosses them, as it
always has. That difference is now doing work: at a glance, a line through the tails of the
letters is something a reader drew, and dashes under them are something they can click.

## Consequences

`site.css` grows 7.6 → 8.63 KB gzipped. `pen-dies.ts` passed its 400-line ceiling, so the
link dies live in `render/pen-link.ts` — **with their own seed**, which is the load-bearing
half of that split. The other dies are drawn from one stream in one order, and their
comments warn that new gestures must be appended so the existing ones do not reshuffle;
sharing that stream across two modules would make the order depend on ESM evaluation order,
where a reordered import could silently redraw every highlight on every site. A separate
seed cannot do that. Verified: the highlighter, underline and ring dies are byte-identical
across the split.

Hover and keyboard focus close the run into a solid rule, same ink and same box, so nothing
moves by a pixel between the two states.
