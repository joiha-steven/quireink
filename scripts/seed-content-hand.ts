// Calligraphy: the hand before the punch. Two of these carry a renderer feature the fixture
// was thin on — `uncials-and-the-slow-hand` is the only English post with footnotes, and
// `ruling-a-page` sets its arithmetic as maths rather than describing it in prose.

import type { Seed } from './seed-content'

export const HAND_POSTS: Seed[] = [
  {
    title: 'The broad-edged pen, and what it still teaches',
    slug: 'the-broad-edged-pen',
    excerpt: 'Nearly every serif on your screen is a frozen record of a flat nib held at an angle. Hold a pen at thirty degrees, write an O, and the thick and thin you get is the same modulation a type designer spends a year redrawing.',
    category: 'Calligraphy', tags: ['pen', 'history', 'letterforms'],
    ago: 63,
    body: `Pick up a broad-edged pen, hold it at thirty degrees, and write an **o**. The stroke is thick on the down-left and thin on the up-right, and you did nothing to make it so: the nib is a flat edge, and the width of the mark is simply how much of that edge is facing the direction you are travelling.

==That single fact explains most of what a serif typeface looks like.==#yellow The thick and thin of a Garamond, the axis its round letters lean on, the way the join between bowl and stem thins to nothing — none of it is decoration. It is a record of a tool.

## The angle is the style

Hold the pen flatter and the contrast moves: you get the upright, heavy-footed look of an uncial. Hold it steeper and you approach the diagonal stress of an italic. Change nothing but the angle and the letterform changes family.

![The same stroke at three nib angles: flatten the pen and the weight sits upright, steepen it and the stress turns diagonal](/uploads/media/nib-angles.png)

This is why type designers still learn to write with a pen even though nobody sets books with one. The pen teaches which parts of a letter are structural and which are habit.

## What the pen cannot teach

It cannot teach spacing. A calligrapher spaces by feel, one letter at a time, and every line is different. A typeface has to space every possible pair in advance, forever, without knowing what will sit next to what.

That is the jump from writing to type, and it is a much larger jump than drawing the letters.

## Trying it without any equipment

You do not need a nib to feel this. Tape two pencils together, hold them at a steady angle, and write your name slowly. The double line the points draw is the ribbon a broad edge lays down, and every widening and thinning arrives on its own, without a single decision from you.

Now rotate your grip a little and write the name again. The letters are recognisably yours and recognisably different — heavier here, leaner there — and you have just performed, in thirty seconds, the experiment that separates one historical hand from another.

Do it a third time faster and watch the joins start to slur. That slurring, disciplined over a few centuries, is where italic came from. The history of Western letterforms is substantially a history of people in a hurry, and the pen records the hurry as faithfully as it records the angle.`,
  },
  {
    title: 'Uncials, half-uncials, and the shape of a slow hand',
    slug: 'uncials-and-the-slow-hand',
    excerpt: 'The roundest letters in the Latin tradition were written by scribes who had all the time in the world and no lower case to write with. What they left is a hand with almost no ascenders and a rhythm nothing since has matched.',
    category: 'Calligraphy', tags: ['history', 'letterforms', 'practice'],
    ago: 71,
    body: `Uncial is what happens when a formal alphabet meets a pen that prefers curves. Roman capitals were cut in stone, and their straight strokes and sharp corners are a chisel's preferences. Move the same alphabet onto vellum with a broad nib and the corners round off, because rounding is faster and the pen resists the turn.

The result, from about the fourth century, is a hand of wide round letters with almost no ascenders or descenders, written between two lines rather than four.[^1] It is unmistakable and it is slow: an uncial page is a page somebody spent a week on.

## Half-uncial is where lower case comes from

Half-uncial let the strokes run above and below the writing line. The **b**, **d**, **h** and **l** grew ascenders; the **p** and **q** grew descenders. That is the moment the two-case alphabet becomes possible, several centuries before anyone treated the cases as different alphabets rather than different formalities.[^2]

Insular half-uncial — the Irish and Northumbrian variety, the hand of the Book of Kells — pushed it furthest, and it is where the shape of our **g** was settled.

## Writing one

Nib angle very flat, between five and fifteen degrees, which is the whole difference from every later hand. Keep the letters wide: an uncial **o** is a full circle, not the oval an italic wants. Resist the urge to add slope. There is none.

==The hard part is not the letterforms, it is the pace.==#orange Uncial punishes speed in a way a running hand does not, because every curve is a slow, even turn and any hesitation shows as a flat spot on the arc.

## What it is good for now

Very little, honestly, and that is fine. It is the clearest way to feel what a nib angle *does*, because at five degrees the tool's behaviour is exaggerated to the point of being obvious. Ninety minutes of uncial teaches more about stress and contrast than a week of reading about them.

[^1]: The name is from Jerome, who used *uncialibus litteris* dismissively — roughly "inch-high letters" — complaining about scribes wasting vellum on show. The name for the hand comes from a complaint about it.
[^2]: Mixing the cases as a matter of grammar rather than display is Carolingian, and later still. For centuries a scribe chose a hand for the whole page, not a case for the word.`,
  },
  {
    title: 'Chancery italic in ninety minutes',
    slug: 'chancery-italic-in-ninety-minutes',
    excerpt: 'The Renaissance hand that became our italic, reduced to four shapes and one angle. Ninety minutes gets you a legible page; the remaining decade is spent making it look easy.',
    category: 'Calligraphy', tags: ['italic', 'practice', 'history'],
    ago: 79,
    body: `Cancellaresca, the chancery hand of sixteenth-century Rome, is the ancestor of every italic on your screen. It is also, unusually for a calligraphic hand, learnable in an afternoon, because almost all of it is built from four shapes.

## The four shapes

The first is a slightly compressed **o**, an oval rather than a circle, leaning about five degrees. Everything round in the hand comes from it.

The second is the **branching arch** of the **n**, which leaves the stem low, about a third up from the baseline, and curves out. Get the branch too high and you have a roman **n** in a hurry.

The third is the **a**, which is the oval with a stem. The fourth is the entry and exit stroke, the small diagonal that joins one letter to the next and gives the hand its slope and its speed.

## The angle, and the only rule that matters

Nib angle around forty degrees, slope around five to ten. ==Then keep both constant.==#green A page of chancery with a wandering slope looks worse than a page of a clumsier hand held steady, because the eye reads inconsistency long before it reads quality.

## Why bother

Because writing the letters teaches you where an italic's weight sits, and after ninety minutes you will never again mistake a slanted roman for an italic. One is a hand. The other is a transformation matrix.`,
  },
  {
    title: 'Ruling a page before you write on it',
    slug: 'ruling-a-page-before-you-write-on-it',
    excerpt: 'A scribe ruled the page before writing a word, and the ruling was arithmetic: nib widths in, line height out. Every margin on this site comes from the same calculation, done by a stylesheet instead of a lead point.',
    category: 'Calligraphy', tags: ['practice', 'layout', 'craft'],
    ago: 88,
    body: `Every formal hand is ruled before a single letter is written, and the ruling is not a matter of taste. It is derived from the nib, because the nib is the only fixed quantity on the desk.

## The unit is the nib width

Lay the pen flat on the page and step it, corner over corner, up the sheet. ==Each step is one **nib width**==#green, and every vertical measurement in the hand is a count of them. The x-height of a foundational hand is four nib widths; an uncial is about three and a half; a chancery italic is five.

That is why the same hand written with a wider nib is not just larger — it is identically proportioned, which is a stronger guarantee than any point size gives you.

## The arithmetic

For a nib of width $n$ and a hand whose x-height is $k$ nib widths, with ascenders and descenders each $a$ nib widths beyond it, the line height needs

$$\\ell = n\\,(k + 2a) + g$$

where $g$ is the gap you leave between the descenders of one line and the ascenders of the next. Set $g = 0$ and the lines interlock — legible, and used deliberately in some manuscript hands, but not what a beginner is aiming for.

| Hand | x-height ($k$) | Extenders ($a$) | Line height at $n = 2\\,\\mathrm{mm}$ |
|---|---:|---:|---:|
| Foundational | 4 | 3 | 20 mm + gap |
| Uncial | 3.5 | 1 | 11 mm + gap |
| Chancery italic | 5 | 4 | 26 mm + gap |
| Gothic textura | 5 | 2 | 18 mm + gap |

## Why the gap is the interesting number

Because it is the only free variable, and it is the one that decides whether a page reads as dense or as airy. Everything else is dictated by the nib. A scribe changing the feel of a page is almost always changing $g$ and nothing else — which is the same move as changing the leading and leaving the type size alone.

## Rule in pencil, and rule the verticals too

Two vertical lines for the text block's edges, and one more a nib width outside the left one, because ascenders and capitals overhang and a hard left edge on every line looks mechanical. Then erase nothing. A ruled line still faintly visible under the writing is what a manuscript page is supposed to look like.`,
  },
]
