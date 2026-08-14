// Printing: what happens to a page once it stops being a file. Three of these run as the
// `Ink and press` series, oldest part first, so the fixture carries two series of different
// lengths rather than one — a reader who only ever sees a two-part series cannot tell the
// series navigation from a "previous post" link.

import type { Seed } from './seed-content'

export const PRESS_POSTS: Seed[] = [
  {
    title: 'Paper weights, and the table nobody agrees on',
    slug: 'paper-weights-and-the-table-nobody-agrees-on',
    excerpt: 'Two paper systems, one of them measuring a quantity that changes depending on what the paper is for. Here is the conversion table, and the honest reason it can never be exact for every sheet on it.',
    category: 'Printing', tags: ['paper', 'stock', 'workflow'],
    ago: 130,
    body: `Ask for "80 pound paper" and you have not said anything until you also say what kind. The American basis-weight system weighs a ream of paper *at its basis size*, and the basis size is different for every grade. Text stock is measured at 25 × 38 inches, cover stock at 20 × 26, index at 25.5 × 30.5. So 80 lb text and 80 lb cover are not close: the cover is roughly twice the substance.

The metric system does not have this problem. ==Grams per square metre is grams per square metre, whatever the sheet is for.==#green

| Grade | Basis size (in) | 80 lb in gsm | 100 lb in gsm |
|---|---|---:|---:|
| Text / book | 25 × 38 | 118 | 148 |
| Cover | 20 × 26 | 216 | 270 |
| Bristol | 22.5 × 28.5 | 163 | 203 |
| Index | 25.5 × 30.5 | 146 | 180 |
| Tag | 24 × 36 | 148 | 185 |

> [!IMPORTANT]
> When a printer and a designer disagree about paper, this table is usually the reason, and neither of them is wrong. Say gsm and the disagreement disappears.

## Weight is not thickness

Two sheets at the same gsm can differ in thickness by a third, because bulk depends on how much air is left in the sheet. An uncoated antique stock is bulky; a coated gloss sheet at the same weight is thin and dense, because calendering has pressed the air out.

That ratio is the **bulk**, and it is what actually decides how thick the finished book is:

| Stock | 120 gsm, 200 leaves | Feel |
|---|---:|---|
| Coated gloss | 18 mm | thin, slick, heavy in the hand |
| Uncoated wove | 24 mm | the default trade book |
| Antique / bulky | 30 mm | a thin book made to look substantial |

## Show-through is the number that matters for text

A text block printed on both sides of a light sheet reads through, and the ghost of the reverse side sits between the lines. Below about 90 gsm on an uncoated stock it is visible on any page with an illustration; below 70 it is visible on plain text.

> [!TIP]
> Ask for a **dummy** — an unprinted copy bound to the exact page count and stock — before committing a run. It costs almost nothing and it is the only way to know what the thing will feel like. Every number above is a prediction; the dummy is the measurement.

## The one that catches people out

Paper has a **grain direction**, the way the fibres lie. A book must be bound with the grain running parallel to the spine, or the pages fight the fold, refuse to lie flat, and warp along the edge as humidity changes. It is invisible in a spec sheet, it costs nothing to get right, and it is unfixable once printed.`,
  },
  {
    title: 'Imposition: why page 1 sits beside page 8',
    slug: 'imposition-why-page-one-sits-beside-page-eight',
    excerpt: 'Fold a sheet three times and the page order stops being obvious — page one ends up beside page eight, upside down. Printers solved this before 1500, and every book you own is still assembled by their answer.',
    category: 'Printing', tags: ['imposition', 'binding', 'workflow'],
    ago: 141,
    body: `A book is not printed a page at a time. It is printed on large sheets, each carrying many pages, which are then folded, cut and gathered. Working out which page goes where on the sheet, and which way up, is called imposition, and getting it wrong wastes the whole run.

Take one sheet folded three times: eight pages a side, sixteen in all. On the outer face, page 1 sits beside page 8, because after the fold those two ends meet. Half the pages are printed upside down relative to the other half. Hold a cheap paperback up to the light at the spine and you can still see the logic.

## Why it survives digital

==Because folding survives.==#yellow A book printed today on a digital press is still imposed, still folded into gatherings, still trimmed on three edges. The arithmetic did not change when the plates did.

## The part that bites

Creep. The pages at the centre of a folded gathering stick out further than the ones on the outside, because they travel around more paper. On a thick gathering the trim removes more margin from the inner pages than the outer, so the margins you drew are not the margins you get.

The fix is to shift each page slightly inward as it approaches the centre of the gathering. Every imposition tool does this and every first-time self-publisher discovers it after the proof arrives.`,
  },
  {
    title: 'Trapping, overprint, and the black that is not black',
    slug: 'trapping-and-the-black-that-is-not-black',
    excerpt: 'Two adjacent colours will not line up perfectly, not on any press ever built. Trapping is deciding in advance which one loses, and rich black is the same decision made about the darkest thing on the page.',
    category: 'Printing', tags: ['colour', 'press', 'craft'],
    series: 'Ink and press', order: 3, ago: 152,
    body: `Registration is never perfect, so where two solid colours meet there will be a hairline of white paper on one side. Trapping is the deliberate overlap that hides it: one colour is spread slightly under the other, so a small misregistration eats into the overlap instead of showing paper.

Which colour spreads is not arbitrary. ==The lighter one always spreads under the darker==#blue, because the eye reads the darker colour's edge as the shape and will not notice the lighter one moving.

## Overprint is the same idea, taken to its limit

Set an object to overprint and it does not knock a hole in what is behind it — it prints on top. For black text on a colour panel that is exactly right: the black prints over the panel, there is no hole to register against, and no misregistration is possible.

\`\`\`text
knockout   panel prints, hole cut for the type, black fills the hole
           → 2 impressions must align to within ~0.1 mm

overprint  panel prints solid, black prints on top of it
           → alignment cannot fail, because there is nothing to align
\`\`\`

> [!WARNING]
> Overprint applied to **white** makes the object disappear. There is no white ink on a four-colour press — white is the paper — so an overprinting white object prints nothing at all. This has ruined more proofs than any other single setting, because on screen it looks correct right up to the moment it is output.

## Rich black, and the number behind it

Plain black ink over a large area looks thin, so printers add other inks under it. The mix matters:

\`\`\`text
plain black    C0  M0  Y0  K100   → correct for all type
rich black     C60 M40 Y40 K100   → correct for large solids
registration   C100 M100 Y100 K100 → NOT a colour. A press-alignment mark.
\`\`\`

Registration black exists so the pressroom can check all four plates at once on the trim edge. Used as a colour it lays down 400% ink coverage, which will not dry, will set off onto the next sheet, and may tear the paper coming off the blanket.

## The rule that prevents most of it

Plain black for type. Rich black for filled areas. Overprint black type on colour, knock out everything else. Never use registration black for anything you can see in the finished book.

Four sentences, and they are older than every piece of software involved in producing the file.`,
  },
  {
    title: 'A signature, a gathering, a quire',
    slug: 'a-signature-a-gathering-a-quire',
    excerpt: 'Three words for nearly the same thing, and the small differences that still matter at the bindery. One of them gave this software its name, which seemed worth explaining.',
    category: 'Printing', tags: ['binding', 'vocabulary', 'history'],
    ago: 167,
    body: `A **quire** is a set of sheets folded together and nested one inside another, ready to be sewn. It is one of the oldest units of bookmaking, older than printing, and it is why the pages of a hardback come in clumps rather than as loose leaves.

A **gathering** is the same object, described from the binder's side of the bench. ==A **signature** is strictly the mark==#green — a letter or number printed in the tail margin of the first page of each gathering, so the person collating them can see at a glance that gathering H follows G. The word slid across to mean the gathering itself, and now all three are used interchangeably by almost everyone.

## Why the distinction is not pedantry

Because the signature mark is the only one of the three you can point at on a finished book. Open an older hardback at the spine and look at the bottom of the first page of each clump: the small letters are still there, doing the job they did in 1490.

## Four leaves, eight pages

The commonest quire is four sheets folded once: eight leaves, sixteen pages. Hence *quaternion*, hence the Latin *quaterni*, four together, which is where the word itself comes from.

It is a good word for a thing made of folded sheets. That is what a book is, and it is what this software is named after.`,
  },
  {
    title: 'Registration, and the millimetre that ruins a spread',
    slug: 'registration-and-the-millimetre',
    excerpt: 'Four inks, four passes, and one of them a hair out of place. Everything you know about print colour — trapping, rich black, the fear of hairline type in three colours — follows from that single millimetre.',
    category: 'Printing', tags: ['colour', 'press', 'craft'],
    series: 'Ink and press', order: 2, ago: 195,
    body: `A colour page is printed four times: cyan, magenta, yellow, black, one after another. Registration is how precisely those four passes line up, and a misregistration of a fraction of a millimetre is visible to anyone, even people who could not name what they are seeing.

The tell is a coloured fringe along a hard edge. Black text on a white ground survives it, because black text is usually printed in black ink alone. Reversed text — white type knocked out of a coloured panel — does not, because now the edge of every letter is the boundary between four separate impressions.

## Why small reversed type is a trap

==At small sizes the stems are thinner than the registration tolerance of the press.==#orange The letters close up, fill in, or acquire a coloured halo. A design that looked crisp on screen arrives as mud, and no amount of arguing with the printer fixes it.

## Rich black, and knowing when not to

The arithmetic is unforgiving. A press holding registration to $\\pm t$ on each of two plates can put them out by $2t$ in the worst case, so a stem of width $w$ survives only while

$$w > 2t$$

At $t = 0.05\\,\\text{mm}$ — good commercial work — that is a floor of a tenth of a millimetre, which is a hairline serif at about six point. Below it the letter does not look thin, it looks coloured.

Solid black on a large area looks weak in plain black ink, so printers mix in some cyan to deepen it. That is rich black, and it is right for a filled panel. It is wrong for text, because now the text has two inks to register and you are back to fringed edges.

Plain black for type, rich black for areas. That one rule prevents most print colour disasters, and it is older than any of the software involved.`,
  },
  {
    title: 'Ink, paper, and the colour between them',
    slug: 'ink-paper-and-the-colour-between-them',
    excerpt: 'A palette is two decisions: what the ink is, and what it sits on. Everything else is adjustment, which is why one hex value can read warm on a cream page and dirty on a white one.',
    category: 'Printing', tags: ['colour', 'paper', 'palette'],
    series: 'Ink and press', order: 1, ago: 224,
    body: `Printers did not have palettes. They had an ink and a stock, and ==everything they could do with colour lived in the relationship between those two==.

That constraint produced better-looking pages than most colour pickers do, because it forced the only two decisions that matter to be made first and deliberately.

## Paper is a colour

==Uncoated paper is not white==#orange. It is warm, faintly yellow, and it absorbs ink so the same black reads softer than it does on a coated sheet. Choosing the stock sets the highlight of everything printed on it, which means ==it sets the contrast of the whole book before a single word is placed==#green.

## Ink is rarely black

Trade books are commonly printed in a black that has been warmed slightly, because ==a neutral black on a warm sheet looks like a hole==#pink. The adjustment is small enough that no reader would name it and large enough that every reader feels it.

## Translating the idea to a screen

A screen palette that begins from "what is the paper, what is the ink" produces calmer pages than one that begins from a brand colour. Set the background and the text colour first, and let the accent be the third decision rather than the first.

That is also the reason a good reading theme has so few colours in it. There were only ever two.`,
  },
]
