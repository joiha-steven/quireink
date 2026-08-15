// Typography in English. The largest of the three category files, because it is the category
// the demo's own design is an argument about. Non-English typography is in
// `seed-content-intl.ts` — language wins over category, and the header there says why.
//
// Five of these carry a renderer feature the fixture had no example of:
// `the-golden-canon-and-its-arithmetic` and `optical-size-is-not-a-scale` set display and
// inline maths, `what-a-subsetter-removes` carries the only code fences,
// `the-em-the-en-and-three-dashes` uses all five callout types on one page, and
// `five-inks-and-when-to-reach-for-each` uses all five pen colours. See the header of
// `seed-content.ts` for why a demo that never shows a feature does not have it.

import type { Seed } from './seed-content'

const SPECIMEN = `Every writing system asks something different of a typeface, and the ones below ask it all at once:

> Việt Nam — chữ Quốc ngữ chồng hai dấu lên một nguyên âm: **nhoẻn**, **khuỷu**, **được**.
> Deutsch — Größe, Fußnote, Maßstab.
> Polski — zażółć gęślą jaźń.
> Čeština — příliš žluťoučký kůň úpěl ďábelské ódy.
> Türkçe — ışık, İstanbul, yığın.
> Íslenska — það þótti æði.

If the accents collide with the line above, the leading is too tight for the language, not for the typeface.`

export const TYPE_POSTS: Seed[] = [
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

## Why this project pins it instead

Because a variable axis costs bytes. Every axis a font ships carries a full set of interpolation deltas, and shipping $\\mathrm{opsz}$ across its whole range for a face that only ever renders between 13 and 40 points is paying for values nobody can reach. Pinning the axis and re-subsetting took the preloaded set here from 97.6 KB to 46.2 KB.

The trade is real and worth naming: pinned means one drawing again, chosen at the size the body text actually uses. A pinned face set as a 40pt headline is very slightly too heavy. Against half the bytes on every cold visit, on a page whose whole argument is that reading should be cheap, that is the correct side to be wrong on.

## How to see it at all

Set a line at 8pt and the same line at 48pt, then scale the small one up in a screenshot until the two match. If the font has an optical axis and it is working, the blown-up small text is visibly sturdier — heavier hairlines, more space between letters. If the two are identical, the axis is either absent or pinned.`,
  },
  {
    title: 'What a font subsetter actually removes',
    slug: 'what-a-subsetter-removes',
    excerpt: 'A webfont is mostly glyphs your pages will never show — alphabets you do not write in, symbols nobody has typed since 1994. Cutting them is the largest single saving available to a text site, and the reader gives up nothing at all for it.',
    category: 'Typography', tags: ['webfonts', 'performance', 'craft'],
    ago: 13,
    body: `A retail text font carries two to three thousand glyphs. A blog in English uses perhaps two hundred of them; add Vietnamese and it is four hundred. Everything else is Greek, Cyrillic, currency for markets you do not serve, and arrows.

Subsetting removes what a page cannot show. ==It is not compression and it is not a quality trade==#green: the glyphs that stay are byte-identical to the ones the foundry drew.

## Three separate cuts, and they compound

The saving is easy to predict before you run anything. For a face of $G$ glyphs of which a site can show $g$, and a per-glyph cost that is roughly constant within a family,

$$\\text{saved} \\approx 1 - \\frac{g}{G}$$

Two hundred glyphs kept out of twenty-eight hundred is a saving of about ninety-three per cent, before a single variation axis has been touched.

Cut one is the **codepoints**. Keep latin, latin-ext and vietnamese, drop the rest.

Cut two is the **variation axes**. A variable font stores deltas for every axis it declares across its whole declared range. A family offering weights 400 to 700 in the product is storing 200-to-900 deltas nobody can select.

Cut three is the **tables**: hinting instructions no modern renderer consults, and layout features a text page never triggers.

\`\`\`bash
pyftsubset Literata.ttf \\
  --unicodes-file=vietnamese.txt \\
  --layout-features='kern,liga,onum,tnum' \\
  --variations='wght=400:700' \\
  --drop-tables+=DSIG \\
  --flavor=woff2 --output-file=literata-vietnamese.woff2
\`\`\`

It prints back what it kept, and this block is the other kind — a fence with no language on it, which is what most fences are. Nothing here knows a grammar to colour it with, so only the two things true of any notation are marked: what sits inside quotes, and a $NAME.

\`\`\`
kept   "latin, latin-ext, vietnamese"   dropped  greek, cyrillic, +19 more
axes   "wght 400..700"                  dropped  opsz, ital
wrote  $OUT/literata-vietnamese.woff2   46.2 KB  (was 97.6 KB)
\`\`\`

## What the cuts are worth

Measured on this site's own faces, from upstream sources rather than by re-cutting an already-cut file:

| Cut | Family | Before | After |
|---|---|---:|---:|
| Codepoints | Literata | 187 KB | 41 KB |
| Axis clamp | Source Sans 3 | 35.6 KB | 28.5 KB |
| Both | Inter, 3 subsets | 46.1 KB | 38.5 KB |
| Both | IBM Plex Mono, 6 subsets | 71.2 KB | 65.6 KB |

## The part that surprises people

Declaring a face is not downloading it. Split a family into subsets and give each a \`unicode-range\`, and the browser fetches only the ranges a page's text actually lands in. An English post never pulls the Vietnamese file even though the CSS names it, and a post with no code never pulls the mono face at all.

Which means the honest number for "how much font does a reader download" is not the size of the family. It is the size of the ranges that page happens to touch — and that is a number you can only get by measuring a real page rather than a directory listing.

\`\`\`css
@font-face {
  font-family: 'Literata';
  src: url('/fonts/literata-vietnamese.woff2') format('woff2');
  unicode-range: U+0102-0103, U+0110-0111, U+1EA0-1EF9, U+20AB;
  font-display: swap;
}
\`\`\`

> [!TIP]
> Re-subset from the foundry's original every time, never from the file you shipped last. Feeding a subsetter its own output re-rolls the compression, so every run produces a diff of about thirty bytes about nothing.`,
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

The mistake that survives longest is treating leading as one number. Large text needs proportionally *less* leading than small text, and display sizes usually want negative tracking while small sizes want a touch of positive. So a role is not a size, it is a triple: size, leading, tracking. Set all three or you will set them by accident later.`,
  },
  {
    title: 'The measure is the design',
    slug: 'the-measure-is-the-design',
    excerpt: 'Sixty-six characters is not a superstition. It is the width at which the eye still finds the start of the next line without hunting for it, and it decides more about a reading page than the choice of typeface does.',
    category: 'Typography', tags: ['measure', 'reading', 'layout'],
    series: 'Designing a reading page', order: 1, ago: 30,
    body: `Ask why a column is the width it is and you will usually be told about taste. It is not taste. It is the distance the eye can travel and still find the start of the next line without hunting for it.

==The return sweep is the whole problem.== At the end of a line the eye jumps left and down at the same time, and it lands by estimating. A short column gives it an easy target and a long one gives it a field of near-identical lines to choose from, which is why ==an over-wide measure makes people re-read the line they have just finished==#blue.

## The number, and what it is really made of

Sixty-six characters per line is the figure everyone quotes, and it is a decent default. But characters are a proxy: what actually matters is the ratio between the line length and the size of the letters, so the same column that reads well at 18px reads badly at 13px, and a typeface with a large x-height wants a slightly shorter line than one with a small one.

${SPECIMEN}

## What to do when the measure fights the page

Widen the leading before you widen the column. An extra tenth of a line height buys back a surprising amount of a long measure, because it makes the row the eye is returning to unambiguous.

And when a design insists on a wide column, break it. Two columns of 45 characters read faster than one of 90, which is why newspapers settled on narrow columns long before anybody measured why.`,
  },
  {
    title: 'The em, the en, and three dashes',
    slug: 'the-em-the-en-and-three-dashes',
    excerpt: 'Four horizontal marks that look alike, mean entirely different things, and are wrong on most pages on the web. A hyphen joins, an en dash spans, an em dash interrupts — and a minus sign is none of the three.',
    category: 'Typography', tags: ['punctuation', 'craft', 'detail'],
    ago: 38,
    body: `There are four horizontal marks in ordinary text and they are not interchangeable. Getting them right is the cheapest quality signal available to a page, because it costs nothing and almost nobody bothers.

| Mark | Character | Width | Job |
|---|---|---|---|
| Hyphen | \`-\` | narrow | joins words: *well-set*, *twenty-one* |
| En dash | \`–\` | one en | spans and relations: *pp. 12–18*, *Paris–Lyon* |
| Em dash | \`—\` | one em | an interruption in a sentence |
| Minus | \`−\` | figure width | arithmetic, and nothing else |

## The one that is always wrong

The minus sign. Almost every page that shows a negative number shows it with a hyphen, which is narrower than the digits it sits beside and sits at the wrong height. In a column of figures the difference is obvious once seen: the hyphens are too high and too short, and the column stops lining up.

> [!IMPORTANT]
> If a page shows numbers in a table, the minus sign and the tabular figures matter more than the typeface does. Both are one line of CSS, and both are usually missing.

## Em dash spacing is a house decision

British practice sets a spaced en dash – like this – where American practice sets a closed-up em dash—like this. Both are correct. ==What is not correct==#pink is mixing them within one publication, and the mixing usually happens because the two came in from different sources.

> [!WARNING]
> Do not fix this with a find-and-replace across a whole site. A hyphen in a URL, a code sample or a Vietnamese word broken across a line is not a dash, and a blind replacement turns working links into dead ones.

> [!TIP]
> Type them rather than hunting for them. On a Mac, en is Option-hyphen and em is Shift-Option-hyphen; on Windows, Alt-0150 and Alt-0151. Two shortcuts, learned once, and the problem stops recurring.

## Where they come from

The names are literal. An em was the width of a cast **M** — actually the width of the body the type was cast on, which for most faces was about the width of an M. An en was half that. Both are still defined that way in CSS, where \`1em\` is the font size and has nothing to do with the letter M at all.

> [!CAUTION]
> \`1em\` in CSS is the computed font size of the element, so it compounds when nested. Two \`0.9em\` elements inside each other give 0.81, not 0.9, and a sidebar nested three deep is how text ends up at 66% of the size somebody set.

> [!NOTE]
> The typographic em and the CSS \`em\` share a name and a lineage, but a typographic em is a horizontal measure and the CSS one is a font size. They agree for square-bodied faces and diverge for everything else.`,
  },
  {
    title: 'Five inks, and when to reach for each',
    slug: 'five-inks-and-when-to-reach-for-each',
    excerpt: 'A highlighter is a reading tool, not a decoration. Five pigments, and which one you reach for is a claim about why the sentence matters: a definition, a warning and a number all want different colours.',
    category: 'Typography', tags: ['reading', 'colour', 'craft'],
    ago: 55,
    body: `A pen box has five colours in it and a student uses all five, but not at random. Over a term a private grammar develops: one colour for the thing that will be examined, another for the thing that was surprising, a third for the thing to come back to. Nobody writes the grammar down and everybody has one.

The same grammar is worth having on a page you publish, because a highlight makes a claim and the reader can tell when the claim is inconsistent.

## The five, and what they are good at

==Yellow is the default, and the only one that disappears.== It is the lowest-contrast of the five against a light page, which is exactly why it is right for the sentence you would underline in a book you own — present when looked for, invisible when reading straight through.

==Green marks the thing that turned out to be true.==#green A conclusion, a measured result, the sentence that survived being checked. It reads as settled, which is why it is wrong for anything provisional.

==Pink is for the correction.==#pink The place where the obvious answer is the wrong one. It is the loudest of the five on a light background and the one to spend most carefully.

==Blue is the aside==#blue — the definition, the piece of context, the thing you would put in a footnote if the footnote would actually be read. It is cool enough to sit under body text without pulling the eye off the line.

==Orange is the warning that is not yet a warning.==#orange The trap, the thing that will cost an afternoon. It sits between yellow's quiet and pink's alarm.

## The rule that makes it work

One colour per meaning, across the whole site, forever. A highlighter used for emphasis alone is just bold with extra steps; a highlighter used consistently is an index the reader builds without being told they are building one.

And use fewer than you think. A page with nine highlights has none, because ==the eye stops treating a colour as a signal once it is the most common thing on the page==.

## Why it is drawn and not filled

A coloured rectangle behind text is not what a pen does. A real stroke has chisel ends where the nib entered and left, it does not cover the descenders evenly, and it breaks at the end of a line rather than wrapping as one continuous block. Drawing it as an SVG stroke costs a reader 1.4 KB and nothing at all on a page with no highlight on it.`,
  },
  {
    title: 'Notes on reading, on paper and on glass',
    slug: 'reading-on-paper-and-glass',
    excerpt: 'A measure, a leading and a typeface walk into a column, and only one of them ever gets blamed. Paper and screen do not disagree about type — they disagree about light, distance, and how long anybody will sit still.',
    category: 'Typography', tags: ['reading', 'screens', 'paper'],
    ago: 118,
    body: `Reading on a screen is not reading on paper with the lights on. The differences are small individually and they compound, and almost all of them push in the same direction: a screen needs more air.

## Contrast is not the same problem

On paper, ink is darker than anything a screen emits, and the page reflects the light in the room. ==On a screen the page *is* the light source==#blue, so pure black on pure white is harsher than the equivalent on paper. Most well-set screen text is not black; it is a very dark grey, and the reason is comfort rather than style.

## The resolution argument is mostly over

For twenty years the honest answer to "why does this look worse on screen" was pixel density. That argument has largely expired: a modern phone resolves type better than newsprint. What remains is variability — the same page renders on a hundred different panels at a dozen brightnesses, and unlike a printed book you cannot tune for the medium because there is no single medium to tune for.

## What actually helps

Slightly more leading than you would set in print. A slightly shorter measure, because a screen is read at a less predictable distance. And a size chosen for the worst case rather than the best: someone reading on a bus, one-handed, at arm's length.

Put a number on it. If $L_t$ is the luminance of the text and $L_b$ that of its background, the contrast ratio is $C = (L_b + 0.05) / (L_t + 0.05)$ — and pure black on pure white gives

$$C = \\frac{1.00 + 0.05}{0.00 + 0.05} = 21$$

which is roughly double what ink on good paper manages. That surplus is not a bonus. It is the glare, and dropping the ground to a paper white takes $C$ back to about seventeen without costing a reader anything they were using.

None of that is exotic. It is the same craft, applied to a surface that moves.

## What that looks like in a stylesheet

Three declarations, and the third is the one everybody forgets:

\`\`\`css
.prose {
  max-width: 34rem;      /* the measure, not the window */
  line-height: 1.7;      /* looser on glass than on paper */
  hyphens: auto;         /* only once the column is wide enough */
}
\`\`\`

Set the measure in \`rem\` rather than in characters: \`ch\` is the width of a zero, and a zero is not the average letter in any language with diacritics.`,
  },
  {
    title: 'Kerning is not tracking, and neither is spacing',
    slug: 'kerning-is-not-tracking',
    excerpt: 'Three controls, three different jobs, and a great deal of type ruined by reaching for the wrong one. Kerning fixes a pair, tracking colours a paragraph, and letter-spacing is what you do to small caps and to nothing else.',
    category: 'Typography', tags: ['kerning', 'tracking', 'craft'],
    ago: 256,
    body: `**Spacing** is the sidebearing built into each glyph: how much air the designer left on either side of the letter. It applies always, to every pair, and you do not get to change it without editing the font.

**Kerning** is a correction to a specific pair. **AV** would gap without it; **To** would leave the o stranded. The font carries a table of these, sometimes thousands of them, each one a judgement the designer already made.

**Tracking** is a uniform adjustment across a run of text. It is the blunt instrument of the three, and it is the one most often misused, because it is the one exposed most prominently in every design tool.

## The rule of thumb

Tracking is for display sizes and for capitals. Large text needs slightly negative tracking because the spacing was drawn for reading sizes and looks loose when scaled up. Capitals and small capitals need slightly positive, because their forms are wide and even and they crowd each other.

==Body text needs neither.==#green If a paragraph looks too loose or too tight at reading size, the problem is almost always the typeface, the size, or the measure — not the tracking.

## When to override a kern pair

Almost never in text. Sometimes in a headline, where a single bad pair is large enough to be a visible hole, and where you are setting six words rather than six hundred. That is the honest boundary: kerning by hand is a display activity.`,
  },
]
