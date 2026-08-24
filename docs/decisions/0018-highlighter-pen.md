# 0018 — A highlighter pen: `==text==`, drawn as ink rather than as a box

Date: 2026-08-03
Status: accepted

## Context

A blog has bold and italic for emphasis inside a sentence, and it has the blockquote and the
callout for a whole block. It has nothing for the gesture in between: *this part, here, is
the part worth coming back to*. That is what a reader does to a printed book with a pen, and
it is the one mark on a page that is unmistakably a reader's rather than a typesetter's.

Every CSS highlight on the web looks the same and looks wrong. `<mark>` renders a solid
rectangle with square corners, every occurrence identical, and when the phrase runs past the
end of a line the browser draws one box wrapped around both lines — which no pen has ever
done. The tell is not the colour. It is the repetition and the corners.

## Decision

**The syntax is `==text==`, and `==text==#green` when the writer wants an ink other than the
default yellow.** The five inks are yellow, green, pink, blue and orange. An unrecognised
colour is not an error: the `#…` simply is not read as a suffix, so `==sale==#50off` renders
the stroke followed by the literal text.

**The stroke is an image, not a gradient, and it cannot be a mask.** The obvious build —
solid ink plus an SVG mask carrying a hand-drawn edge — clips the *text* as well, because
`mask` applies to the whole element. It is not a theoretical objection: the first pass
rendered `mang dấu vết` as `mang uau vet`, with the tops of the letters and every Vietnamese
diacritic cut off along with the ink. So the shape carries its own colour and arrives as a
`background-image`, one per pigment, stretched to the phrase with
`preserveAspectRatio=none`. Two paths per stroke — a full sweep at 80% opacity and a denser
lower band at 55% — which is the second pass a real pen leaves.

**Three strokes, and they are a site setting.** `marker` sweeps the whole word; `swipe` is
the fast pass that rides the x-height and clips the tops of tall letters; `double` lays the
stroke twice so the ink pools where the two bands overlap. `marker` is the default and the
only one of the three that never clips a Vietnamese stacked diacritic.

**The colours are NOT a setting**, and they are hardcoded hex rather than theme tokens.
⚠️ **Amended by [0029](0029-the-pen-becomes-the-owners.md) on 2026-08-24**: the owner may now
choose them, as overrides whose empty default is everything below. The half of this paragraph
that still holds is the half about the PALETTE — one pen for the whole site, never a mark
that restyles itself per theme.
This is a deliberate exception to "public UI colours come only from theme tokens"
(`CLAUDE.md`). A highlighter is not UI. It is a physical object dragged across the paper, and
its pigment is the same fluorescent yellow whether the page around it is mono, sepia, ocean
or forest. A highlight that restyled itself per palette would read as a coloured box, which
is the exact thing this feature exists not to be.

**The stroke is CSS, never markup.** Rendered Markdown is cached under a hash of its input,
so a stroke baked into the HTML could not be restyled without evicting every cached body on
the site. The markup is fixed at `<mark data-ink="…">` and only four CSS variables move. The
default emits no bytes at all: the `var()` fallbacks are the marker geometry. This is the
same bargain, for the same reason, as the gallery defaults in ADR 0011's neighbourhood.

## The colours are measured, not chosen

Every value below was sampled off a photograph of a real highlighter box, then verified by
screenshotting the rendered page and reading the pixels back — not computed from the source.

Light mode. The ink multiplies onto the paper, so the page shows through and two overlapping
strokes darken on their own.

| Ink | Pigment | Rendered on `#fcfcfc` | Contrast vs body text |
|---|---|---|---|
| Yellow | `#d5f856` | `#daf677` | 12.6:1 |
| Green | `#aaef83` | `#b9ef9a` | 11.4:1 |
| Orange | `#fac881` | `#f8d098` | 10.4:1 |
| Blue | `#8ed6f9` | `#96d6f7` | 9.6:1 |
| Pink | `#faaad9` | `#f8b9de` | 9.4:1 |

The largest correction during the study was the yellow. The obvious choice is a golden hue
48; the actual pen is **chartreuse, hue 73**, leaning green. Side by side they are plainly
different pens.

Blue is the only ink that could not be measured off the paper — in the reference photograph
it appears solely on the box's tab, so it is inferred from there. It is carried anyway
because four inks leave no cool colour at all, and a highlight marking a *definition* reads
wrong in every one of the four warm-to-mid options.

Dark mode broke twice before it worked, and both faults are easy to reintroduce:

1. **Not `opacity`, and not `multiply`.** Multiply on a near-black page turns every ink to
   mud. `opacity` on the mark fades the *text* along with the ink, so the highlighted words
   came out dimmer than the words around them — the one thing a highlight must never do. The
   alpha therefore lives in the pigment, and dark mode carries its own five values.
2. **The first mix failed AA.** At 55% the body text over the densest part of the stroke
   measured 3.74:1 yellow, 4.10:1 green, 4.49:1 orange, under the 4.5:1 this repository has
   already audited itself against. **45% is the brightest mix at which all five clear
   5.0:1.** Measured across the whole stroke rather than at one point: the two paths overlap
   at ~91% alpha and the thinnest part is ~80%, so each ink spans a range and the *worst* end
   of it is what was checked.

| Ink | Stroke, dark | Contrast vs the highlighted word |
|---|---|---|
| Yellow | `#675c22`..`#736625` | 5.13..5.99:1 |
| Green | `#455e38`..`#4e6a3e` | 5.4..6.4:1 |
| Blue | `#435f6e`..`#42606e` | 6.1:1 |
| Orange | `#625037`..`#6f5a3d` | 5.9..6.9:1 |
| Pink | `#624556`..`#6f4e61` | 6.4..7.5:1 |

Dark yellow is **deliberately not the same hue as its light twin.** The real pen is
chartreuse and light mode keeps that, but at dark-mode luminance chartreuse and the green
(hue 98) sit 25° apart and both read as the same olive. Dark yellow is warmed to hue 50,
which opens the gap to 48° and still measures 5.07:1. It is the one place the ink knowingly
departs from the physical pen.

## Consequences

- **The editor draws the stroke too.** `admin/components/InkMark.ts` is a TipTap mark that
  emits the same `<mark data-ink="…">` element, so one CSS file inks both surfaces — the ink
  reaches the admin sheet because it lives in `PROSE_CSS`, which the writing surface already
  shares with the published page for exactly this kind of reason. Typing the syntax inks it
  on the spot, the bubble bar carries the five pens as swatches, and the round-trip is
  byte-for-byte (task lists and blockquotes included), so opening and saving a post cannot
  destroy a highlight.

  Three things had to be got right, and each was found by driving the editor rather than by
  reading the code:

  1. **`mixable: true` on the serializer.** prosemirror-markdown serializes marks per text
     node, so a stroke containing bold and a link was closed and reopened around each one:
     `==chữ **in đậm**==#orange` came back as
     `==chữ ==#orange**==in đậm==#orange**==…`. Not a formatting wobble — a different
     document, saved silently.
  2. **The colour cannot be the last capture group.** `markInputRule` and `markPasteRule`
     both take `match[match.length - 1]` as the text to mark, so typing `==go tay==#pink`
     marked the word **pink** and deleted "go tay". The editor uses a variant of the grammar
     with the colour non-capturing (`INK_SYNTAX_CONTENT_LAST`), and reads the colour off the
     full match instead.
  3. **A suffix cannot be waited for.** `==go tay==` is a complete highlight the moment the
     second `==` lands, so the input rule fires there and a *second* rule handles `#pink` as
     its own gesture: it recolours the stroke it follows and swallows itself. A `#pink` that
     follows ordinary words is left alone, because a hashtag has to survive being typed.

- **One thing the editor cannot hold:** a stroke running across an inline `code` span.
  StarterKit's `code` mark is declared `excludes: '_'`, and that cannot be overridden from
  outside it — `extendMarkSchema` merges *under* the mark's own fields, so it silently does
  nothing (tried). The server renders ``==a `b` c==`` as one stroke; opening it in the editor
  and saving ends the stroke before the code. Accepted rather than fixed: the repair is a
  direct dependency on `@tiptap/extension-code` plus a forked `code` mark, and the ink is not
  visible under a code span anyway (see the note below). The degraded form is valid Markdown
  and a fixed point — saving twice does not keep eating the stroke — and a test pins it.
- **`toPlainText` had to learn the syntax**, and the two definitions are now one exported
  regex. Before they agreed, the auto-excerpt on a highlighted post read `==mang dấu vết==`
  verbatim, and a `#green` suffix lost only its `#` — leaving the word "green" sitting in the
  middle of the deck, the meta description, the OG card and the RSS summary.
- **Inline `code` inside a highlight keeps its own grey background**, which sits on top of the
  ink rather than under it. That is correct — a pen cannot recolour a printed grey box — but
  it is worth knowing before someone reports it.
- **This is the first syntax 2.0 has that Quire 1.x did not.** The golden gate
  (`docs/spec/03-golden.md`) still passes byte-for-byte on all 46 corpus fixtures, because
  the grammar declines to match anything 1.x could produce: `==` must be followed by a
  non-space, so comparisons and assignments in running prose are untouched, and a setext
  heading underline is claimed by the block tokenizer long before this sees it.

## Alternatives rejected

**A flat `<mark>` background.** Kept in the study as the control. It is what 95% of the web
does and it reads as a UI chip, not a pen.

**Four inks instead of five.** The reference box holds four. Dropping blue would save ~390
bytes gzipped and avoid carrying the one colour that could not be measured directly; it was
rejected because it leaves the palette with no cool ink at all.

**Per-palette or owner-configurable ink.** Rejected above: it makes the highlight a UI colour,
which is what stops it looking like a pen.
