// The `Designing a reading page` series, all four parts. Split out of
// `seed-content-type.ts` when lengthening the posts pushed that file at the 400-line cap —
// and the series is the natural seam: these four are the posts the demo's own layout is
// implementing, part 1 to part 4, measure to margins.
//
// Two of them carry renderer features the fixture leans on: `the-golden-canon` and
// `a-type-scale-you-can-defend` set display maths, and every part now carries at least one
// GFM table, because a series about deriving numbers should show its numbers derived.

import type { Seed } from './seed-content'

const SPECIMEN = `Every writing system asks something different of a typeface, and the ones below ask it all at once:

> Việt Nam — chữ Quốc ngữ chồng hai dấu lên một nguyên âm: **nhoẻn**, **khuỷu**, **được**.
> Deutsch — Größe, Fußnote, Maßstab.
> Polski — zażółć gęślą jaźń.
> Čeština — příliš žluťoučký kůň úpěl ďábelské ódy.
> Türkçe — ışık, İstanbul, yığın.
> Íslenska — það þótti æði.

If the accents collide with the line above, the leading is too tight for the language, not for the typeface.`

export const PAGE_POSTS: Seed[] = [
  {
    title: 'The golden canon, and the arithmetic under it',
    slug: 'the-golden-canon-and-its-arithmetic',
    excerpt: 'Medieval scribes placed a text block by drawing nine lines and reading the answer off the diagonals. No measuring, no arithmetic, no taste required — and the proportions that fall out are still the best default anybody has for a page of running text.',
    category: 'Typography', tags: ['margins', 'layout', 'proportion'],
    series: 'Designing a reading page', order: 4, ago: 0,
    body: `Nobody in a scriptorium measured a margin. They drew diagonals across the spread, marked where the lines crossed, and put the text block's corners on those marks. Van de Graaf reconstructed the method in the 1940s from books nobody had thought to measure, and what he found was that a construction with no numbers in it produces the same proportions over and over.

The result is a text block whose width is exactly two thirds of the page width, sitting on margins in the ratio 2 : 3 : 4 : 6 — inner, top, outer, bottom.

## Why the inner margin is the small one

Because two facing pages are read as one surface. The inner margins of a spread sit against each other, so half of each adds up to a gutter the same weight as a single outer margin. Set them equal and the spread looks like two pages that happen to be near one another.

The bottom margin is the largest, and it is the one people cut first when a page is tight. It is also the one holding the block up: an evenly-margined block appears to sink, because the eye puts the optical centre of a rectangle above its geometric centre.

## The arithmetic, once

For a page of width $w$ and height $h$, the canon gives a text block of

$$w_t = \\frac{2w}{3}, \\qquad h_t = \\frac{2h}{3}$$

with the inner margin at $w/9$ and the top at $h/9$. Every other measurement follows, which is the whole appeal: one division, and the page is set.

For an arbitrary page ratio the outer margin comes out as

$$m_o = \\frac{2w}{9}, \\qquad m_b = \\frac{2h}{9}$$

so the outer is twice the inner and the bottom is twice the top. That is the 2 : 3 : 4 : 6 written another way.

## The same division, on the shelves

Run the ninths over the trim sizes a designer actually meets and the canon stops being a diagram and becomes a set of margins you could hand a printer today:

| Page | Trim | Inner | Top | Outer | Bottom |
|---|---|---:|---:|---:|---:|
| A5 | 148 × 210 mm | 16 mm | 23 mm | 33 mm | 47 mm |
| Trade paperback | 5.5 × 8.5 in | 16 mm | 24 mm | 31 mm | 48 mm |
| Royal octavo | 6 × 9 in | 17 mm | 25 mm | 34 mm | 51 mm |
| A4 report | 210 × 297 mm | 23 mm | 33 mm | 47 mm | 66 mm |

Two things fall out of the table. The first is how large the canon's margins are — nearly half of an A4 sheet is margin, which is why it reads as luxurious and why nobody selling paper by the page will default to it. The second is that the proportions barely move across formats: the canon does not know what a millimetre is, so it cannot be thrown off by one.

> [!NOTE]
> The canon assumes a spread. On a screen there is no facing page and no gutter, so the inner and outer margins have no reason to differ — take the ratio for the vertical and let the horizontal be symmetrical.

## What it is actually for

Not for copying. For having somewhere to start that is not the default margin of whatever tool you opened. Move away from the canon deliberately and the page usually survives; arrive somewhere by accident and it usually does not.`,
  },
  {
    title: 'Optical size, and why 8pt is not 24pt shrunk',
    slug: 'optical-size-is-not-a-scale',
    excerpt: 'A caption and a headline want different letterforms, not the same letterform at two sizes. Foundries knew this when type was cut in metal, lost it when photocomposition arrived, and variable fonts have finally made it adjustable again.',
    category: 'Typography', tags: ['scale', 'variable fonts', 'craft'],
    series: 'Designing a reading page', order: 3, ago: 9,
    body: `Metal type was cut at every size it was going to be used at, and the small sizes were not the large ones reduced. They had shorter ascenders, sturdier hairlines, wider spacing and a larger x-height relative to the body. The punchcutter knew that a letter has to survive being small, and drew a different letter.

Photocomposition destroyed that. One drawing, scaled optically to every size, and two generations of readers got captions set in a face designed to be a headline.

## What the axis does

The \`opsz\` axis in a variable font puts the compensation back. As the value drops the font thickens its thin strokes, opens its counters, widens its spacing and shortens its extenders. As it rises it does the reverse, because a headline can afford contrast that would disappear in a footnote.

Most implementations tie the axis to the rendered size automatically. Given a font whose axis runs from $o_{\\min}$ to $o_{\\max}$, the browser sets

$$o = \\operatorname{clamp}(s,\\; o_{\\min},\\; o_{\\max})$$

where $s$ is the used font size in points. That is all \`font-optical-sizing: auto\` means, and it is on by default.

## What the compensation is made of

"A different letter" is four separate adjustments moving together, and each one is measurable on any face that carries the axis:

| At small sizes | At display sizes | Why |
|---|---|---|
| Hairlines thicken | Hairlines thin | a stroke below the pixel grid disappears |
| Counters open | Counters tighten | ink and pixels both close small apertures |
| Spacing loosens | Spacing tightens | crowded smalls merge; loose displays fall apart |
| x-height rises | x-height relaxes | the lower case does the reading at 9pt |

The table is also a checklist for faking it. A face with no \`opsz\` axis can still be set a half-step heavier and a touch looser in its small sizes, which is three quarters of what the axis would have done.

## Why this project pins it instead

Because a variable axis costs bytes. Every axis a font ships carries a full set of interpolation deltas, and shipping $\\mathrm{opsz}$ across its whole range for a face that only ever renders between 13 and 40 points is paying for values nobody can reach. Pinning the axis and re-subsetting took the preloaded set here from 97.6 KB to 46.2 KB.

The trade is real and worth naming: pinned means one drawing again, chosen at the size the body text actually uses. A pinned face set as a 40pt headline is very slightly too heavy. Against half the bytes on every cold visit, on a page whose whole argument is that reading should be cheap, that is the correct side to be wrong on.

## How to see it at all

Set a line at 8pt and the same line at 48pt, then scale the small one up in a screenshot until the two match. If the font has an optical axis and it is working, the blown-up small text is visibly sturdier — heavier hairlines, more space between letters. If the two are identical, the axis is either absent or pinned.`,
  },
  {
    title: 'A type scale you can defend',
    slug: 'a-type-scale-you-can-defend',
    excerpt: 'Nine roles, one ratio, and no size typed twice. Every measurement on the page comes from what a piece of text IS rather than from where it happens to sit, so one setting changes the whole page instead of one heading.',
    category: 'Typography', tags: ['scale', 'layout', 'craft'],
    series: 'Designing a reading page', order: 2, ago: 21,
    body: `Most type scales are a list of numbers somebody liked. That works until the day you want the whole page a little larger, and you discover the numbers were never related to each other at all.

A scale is defensible when every size is derived, and when each size belongs to a **role** rather than to a place. Not "the h2 on the article page" but "a section heading" — because the moment a size is attached to a location, the same heading in a second location gets a second number, and the two drift.

## A ratio, and the honesty to break it

Every size on the page comes from one body size and one ratio:

$$s_n = s_0 \\times r^{\\,n}$$

where $s_0$ is the body size, $r$ the ratio and $n$ the number of steps away from it. Pick a ratio and generate from the body size. A minor third ($r = 1.2$) is quiet and works for text-heavy pages; a perfect fourth ($r = 1.333$) is dramatic and runs out of room quickly on a small screen.

![A modular scale drawn as bars: each size is the one below it times the ratio, so the steps agree with each other instead of with a list of numbers](/uploads/media/modular-scale.png)

| Step | Minor third | Perfect fourth |
|---|---|---|
| Body | 17 px | 17 px |
| +1 | 20 px | 23 px |
| +2 | 24 px | 30 px |
| +3 | 29 px | 40 px |

Solving it the other way round is the useful direction. Given a body size and the largest size the page actually needs, $k$ steps above it, the ratio is not a matter of taste at all:

$$r = \\sqrt[k]{\\frac{s_k}{s_0}}$$

And the warning below has a number attached to it, which is the part nobody writes down. Round at every step and each rounding is carried into the next multiplication:

$$\\tilde{s}_n = \\operatorname{round}\\!\\left(\\tilde{s}_{n-1}\\, r\\right), \\qquad \\tilde{s}_0 = s_0$$

Every step adds at most half a pixel, and every earlier half-pixel is multiplied again on the way up — so the drift is a geometric sum, and it has a closed form:

$$\\left|\\, \\tilde{s}_n - s_0\\, r^{\\,n} \\right| \\;\\le\\; \\frac{1}{2} \\sum_{i=1}^{n} r^{\\,n-i} \\;=\\; \\frac{r^{\\,n} - 1}{2\\,(r - 1)}$$

At $r = 1.2$ that is $2.7$ px by the fourth step: a heading a whole rounding apart from the scale it was supposed to have come from.

Then allow yourself to round. A scale that produces 27.65px is a scale nobody will follow, and the rounding is not a compromise: the eye cannot tell 27.65 from 28, and the person maintaining the page can.

> [!TIP]
> Round once, at the end. Rounding each step and then generating the next from the rounded value compounds the error, and by the fourth step the scale is no longer the ratio you chose.

## Leading and tracking travel with the size

The mistake that survives longest is treating leading as one number. Large text needs proportionally *less* leading than small text, and display sizes usually want negative tracking while small sizes want a touch of positive. So a role is not a size, it is a triple: size, leading, tracking. Set all three or you will set them by accident later.

This site's own roles, as one table rather than nine scattered declarations — which is the whole discipline in miniature, because a table with a hole in it is visible and a stylesheet with a hole in it is not:

| Role | Size | Leading | Tracking |
|---|---:|---:|---:|
| Caption | 13 px | 1.55 | +0.01 em |
| Small | 14 px | 1.55 | +0.01 em |
| Body | 17 px | 1.70 | 0 |
| H3 | 20 px | 1.40 | 0 |
| H2 | 24 px | 1.30 | −0.005 em |
| Title | 29 px | 1.20 | −0.01 em |

Read down any column and the trend is monotone. That is the test worth keeping: a role whose leading bucks the trend was set by accident, and the table shows it in a way nine CSS rules never will.`,
  },
  {
    title: 'The measure is the design',
    slug: 'the-measure-is-the-design',
    excerpt: 'Sixty-six characters is not a superstition. It is the width at which the eye still finds the start of the next line without hunting for it, and it decides more about a reading page than the choice of typeface does.',
    category: 'Typography', tags: ['measure', 'reading', 'layout'],
    series: 'Designing a reading page', order: 1, ago: 30,
    body: `Ask why a column is the width it is and you will usually be told about taste. It is not taste. It is the distance the eye can travel and still find the start of the next line without hunting for it.

==The return sweep is the whole problem.== At the end of a line the eye jumps left and down at the same time, and it lands by estimating. A short column gives it an easy target and a long one gives it a field of near-identical lines to choose from, which is why ==an over-wide measure makes people re-read the line they have just finished==#blue.

![The return sweep drawn over two columns: from a short measure the eye lands on the next line, from a long one it hunts](/uploads/media/measure-and-return-sweep.png)

## The number, and what it is really made of

Sixty-six characters per line is the figure everyone quotes, and it is a decent default. But characters are a proxy: what actually matters is the ratio between the line length and the size of the letters, so the same column that reads well at 18px reads badly at 13px, and a typeface with a large x-height wants a slightly shorter line than one with a small one.

${SPECIMEN}

## Every trade found the same number

The measure is one of the few typographic quantities that several industries converged on independently, each under different pressure, which is the strongest evidence available that it is a property of readers rather than of fashion:

| Setting | Typical measure | Why it landed there |
|---|---:|---|
| Trade book | 60–70 chars | one column, held at arm's length |
| Newspaper column | 30–40 chars | scanned, not read; speed over comfort |
| Bible, two-column | 40–45 chars | thin paper, maximum words per spread |
| This site | 66 chars | a book page, on glass |

The newspaper row is the instructive one. Nobody reads a broadsheet line by line; the narrow column exists so the eye can drop vertically and sample. The moment the same text is meant to be *read*, the number doubles. A layout is a claim about how its text will be consumed, and the measure is where the claim is made.

## What to do when the measure fights the page

Widen the leading before you widen the column. An extra tenth of a line height buys back a surprising amount of a long measure, because it makes the row the eye is returning to unambiguous.

And when a design insists on a wide column, break it. Two columns of 45 characters read faster than one of 90, which is why newspapers settled on narrow columns long before anybody measured why.`,
  },
]
