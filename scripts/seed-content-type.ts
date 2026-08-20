// Typography in English, minus the `Designing a reading page` series, which lives in
// `seed-content-page.ts` since lengthening the fixture pushed one file at the 400-line cap.
// Non-English typography is in `seed-content-intl.ts` — language wins over category, and the
// header there says why.
//
// Three of these carry a renderer feature the fixture had no example of:
// `what-a-subsetter-removes` carries the only code fences,
// `the-em-the-en-and-three-dashes` uses all five callout types on one page, and
// `five-inks-and-when-to-reach-for-each` uses all five pen colours. See the header of
// `seed-content.ts` for why a demo that never shows a feature does not have it.

import type { Seed } from './seed-content'

export const TYPE_POSTS: Seed[] = [
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

## The grammar, written down once

The point of writing it down is not obedience, it is arbitration: six months in, when a sentence seems to want two colours, the table answers instead of a coin toss.

| Ink | Claims | Never for |
|---|---|---|
| Yellow | worth re-finding | anything urgent |
| Green | checked, held up | a hope, a plan |
| Pink | the intuitive answer is wrong | mere emphasis |
| Blue | context, definition | conclusions |
| Orange | will bite later | things that already bit |

The last column earns its place. A grammar is defined at least as much by what a colour must never mark as by what it may, the same way a style guide's banned words do more work than its recommended ones.

## The pencil and the ballpoint

The highlighter is not the only thing on the desk. Two more gestures, straight from any borrowed textbook: ++the sentence worth underlining gets a pencil line under it++, and the single word everything turns on gets @@ringed@@ in ballpoint.

An underline claims less than a highlight — ++it says "noted", not "this will be examined"++ — and it stacks: a sentence can be ==highlighted for the term and underlined on the second pass==, exactly as paper accumulates readings. The line takes a colour when it needs one: ++a conclusion can be underlined in green++#green, ++a warning in orange++#orange.

The ring is for a word, not a sentence. The word that must @@cease@@, the number that is @@wrong@@, the term about to be defined — @@một chữ thôi@@#blue. Ring a whole clause and the loop stops meaning anything.

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

## Distance is the variable nobody designs for

A book is held where the hands put it, and the hands are consistent. A screen is read wherever it happens to be standing, and the span is enormous:

| Surface | Typical distance | 17px subtends |
|---|---:|---:|
| Phone, in hand | 30 cm | comfortable |
| Laptop | 50 cm | the design case |
| Desktop monitor | 70 cm | slightly small |
| TV across a room | 250 cm | unreadable |

The same pixel size is four different reading experiences, which is the honest argument for letting the reader change the type size and for testing a page at arm's length, not just at a desk. The setting on this site that scales the whole page exists because of the bottom half of that table.

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

## Numbers, since the tools never volunteer them

Every design tool exposes tracking as an unlabelled slider, so here is roughly where the slider should stop. In CSS terms, per em of the size being set:

| Setting | Tracking | Why |
|---|---:|---|
| Display, 40px up | −0.01 to −0.02 em | spacing was drawn for 17px |
| Headings | −0.005 em | the same effect, in moderation |
| Body | 0 | the designer already decided |
| Small text, captions | +0.01 em | crowded smalls merge |
| Capitals, small caps | +0.05 to +0.1 em | even widths need air |

The asymmetry is the lesson: the corrections above body size are tiny, and the one for capitals is five to ten times larger. Letterspacing lower case remains a firing offence; letterspacing capitals is a duty.

## When to override a kern pair

Almost never in text. Sometimes in a headline, where a single bad pair is large enough to be a visible hole, and where you are setting six words rather than six hundred. That is the honest boundary: kerning by hand is a display activity.`,
  },
]
