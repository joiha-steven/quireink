# 0026 — The pen learns two more gestures: `++underline++` and `@@ring@@`

Date: 2026-08-20
Status: accepted

## Context

The highlighter (0018, amended by 0025) is one third of what a reader does to a page they
own. The reference photographs that drove 0025 — a law student's textbook — show the other
two thirds on every page: whole sentences underlined in pen or pencil beneath the
highlighting, and single load-bearing words ("cease") ringed in ballpoint. A review of the
0025 work asked for exactly these, by pointing at the photographs.

There was also a live defect in the neighbourhood: the editor's U button applied
StarterKit's `underline` mark, which has no Markdown serialization — tiptap-markdown logs
`"underline" mark is only available in html mode` and saves the document WITHOUT the mark.
Press U, save, and the underline was silently gone. A gesture the file format cannot carry
is not a feature, it is bait.

## Decision

**Two new inline gestures, same grammar shape as the highlighter, one grammar file.**
`++text++` underlines; `@@word@@` rings. An optional `#colour` names one of the five inks.
The guards are the highlighter's exactly (no whitespace inside the fences, a triple is not
a gesture), which keeps `C++ and ++i`, `x @@ y` and `a@@b` out of the pen's reach. All
parsers — marked, markdown-it in the editor, the typing rules, `toPlainText` — are built
from the one regex in `render/ink.ts`, per the drift argument in that file.

**The markup is `<u data-pen>` and `<mark data-form="o" data-pen>`.** `<u>` is HTML's
unarticulated annotation, and a CSS-less feed reader shows a real underline; a ring IS a
mark, and the same reader degrades it to a visible one. Unlike the highlighter, a named
colour is ALWAYS written as `data-ink` here — the default it departs from is not an ink.

**Defaults are desk objects, not settings: graphite pencil for the line, red ballpoint for
the ring.** Named colours use ballpoint-strength versions of the five hues
(`PEN_LINE_LIGHT/DARK`), because a thin line drawn in the highlighter's pastel pigment all
but vanishes — pale ink reads by its area, and a 2px line has none.

**The shapes are grown by the 0025 generator, dealt by the same `data-pen` hash.** The
underline dies vary tilt, bow (a wrist pivots), tail droop, thickness taper and a second
re-inked pass. The ring is THREE images — two caps and a middle — because a stretched loop
is not a hand-drawn loop: around a long word the end curves of a single stretched ellipse
flatten into a capsule pill (reviewed and rejected as exactly that). The caps ride at a
fixed em width so their curvature never depends on the word, only the near-straight run
over and under the letters stretches, and one cap carries the crossing tail every ringed
word in the photographs has.

**Both gestures are owner toggles (`features.penUnderline`, `features.penRing`), on by
default — and they toggle CSS, never markup.** Off swaps the underline for the browser's
straight rule and leaves ringed words plain. The elements stay in the cached bodies, so
flipping the toggle needs no re-render and costs an untouched site zero bytes — the same
bargain as the gallery defaults. This is not the three-stroke picker 0025 retired coming
back: that setting chose between three uniformities of one gesture; these turn whole
gestures on and off.

**The editor owns `underline` again.** StarterKit's is disabled; `PenMarks.ts` supplies a
mark with the same name, command and Mod-U shortcut that serializes to `++text++` — the U
button now reaches the file. `PenRing` joins it with a toolbar button. Ring parse rules
outrank the highlighter's `mark` rule AND the highlighter's rule refuses `[data-form]`,
so a pasted ring can never be silently rewritten into a sweep; pinned by test.

## Costs, measured

The three underline pigments-sets and ring pieces add ~60 data-URIs to the sheet:
20.5 KB → 29.3 KB gzipped, one immutable request. Positioning facts that cost a session
each, recorded so they are paid once: an inline background clips at the font's descent, so
anything drawn under the baseline needs vertical padding to paint at all (the padding does
not move lines); and Literata's ascent is 1.16em — underline registers tuned on another
font's baseline cut straight through the words.
