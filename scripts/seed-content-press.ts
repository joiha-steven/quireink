// Printing: what happens to a page once it stops being a file. Four of these run as the
// `Ink and press` series, oldest part first, so the fixture carries two series of different
// lengths rather than one — a reader who only ever sees a two-part series cannot tell the
// series navigation from a "previous post" link.
//
// `thirty-six-views` is the category's gallery post: Hokusai's prints ARE press work, so
// the committed scans in `scripts/art/` (provenance and copyright: `seed-art.ts`) let the
// series end on pages you can look at. Two other posts float a `#third` figure into the
// prose — the Gutenberg leaf and the Arles bedroom — for the same reason.

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

![An imposition sheet: eight pages a side, half of them upside down, all of them exactly where the fold needs them](/uploads/media/imposition-sheet.png)

The scheme has a name for every fold count — folio for one, quarto for two, octavo for three — and the names leaked into everything from book sizes to paper grades. When a bookseller calls a volume an octavo they are quoting, at four hundred years' distance, the number of times a printer folded a sheet.

The whole vocabulary is one doubling sequence, which is why it never needed writing down to survive:

| Folds | Name | Leaves | Pages | Typical height |
|---:|---|---:|---:|---|
| 1 | folio | 2 | 4 | 380 mm — a lectern book |
| 2 | quarto | 4 | 8 | 280 mm — a large atlas |
| 3 | octavo | 8 | 16 | 230 mm — the hardback |
| 4 | sextodecimo | 16 | 32 | 170 mm — the pocket book |

Every row halves the page and doubles the count, so the sheet size and the book size are one decision, not two. A publisher choosing "octavo" was choosing the paper bill and the shelf height in the same word.

## Why it survives digital

==Because folding survives.==#yellow A book printed today on a digital press is still imposed, still folded into gatherings, still trimmed on three edges. The arithmetic did not change when the plates did.

## The part that bites

Creep. The pages at the centre of a folded gathering stick out further than the ones on the outside, because they travel around more paper. On a thick gathering the trim removes more margin from the inner pages than the outer, so the margins you drew are not the margins you get.

The fix is to shift each page slightly inward as it approaches the centre of the gathering. Every imposition tool does this and every first-time self-publisher discovers it after the proof arrives.`,
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

## The oldest example most people have seen

![A leaf of the Gutenberg Bible: two columns of forty-two lines, gathered in quires of five folded sheets](/uploads/media/gutenberg-bible-epistle.jpg#right-third)

The page beside this paragraph is a leaf of the Gutenberg Bible, and it is quires all the way down. The book was printed around 1455 as some 320 gatherings, mostly of five sheets each — ten leaves, twenty pages — sewn one to the next. Every decision this site's Printing posts describe is already on it: two columns to keep the measure readable, margins in a canon a scribe would recognise, and a black dense enough that no reader ever wonders what the type is printed with.

What it does *not* have is the mark. Gutenberg's quires were collated by eye, and printed signature marks appear a generation later — which is the neatest proof that the mark is a workflow tool rather than a structural one. The structure was there first; the label was invented the first time somebody bound a book wrong.

## Four leaves, eight pages

The commonest quire is four sheets folded once: eight leaves, sixteen pages. Hence *quaternion*, hence the Latin *quaterni*, four together, which is where the word itself comes from.

It is a good word for a thing made of folded sheets. That is what a book is, and it is what this software is named after.`,
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

## A painter ran the same experiment

![The Bedroom, 1888. Every colour in it is tuned against the pale ground it sits on](/uploads/media/van-gogh-bedroom-in-arles.jpg#left-third)

The painting beside this paragraph is the ink-and-stock decision made with oil paint. Van Gogh primed the canvas pale and then, as he wrote to Theo while working on it, pushed every colour to do the room's work — the walls violet, the floor a broken red, the furniture "the yellow of fresh butter" — each one chosen against that ground, not against a colour chart.

Swap the ground and the picture dies. That is not a metaphor for the printer's problem; it is the identical problem, one layer up. The stock is the ground, the ink is the pigment, and no swatch means anything until it is lying on the surface it will live on.

## Translating the idea to a screen

A screen palette that begins from "what is the paper, what is the ink" produces calmer pages than one that begins from a brand colour. Set the background and the text colour first, and let the accent be the third decision rather than the first.

That is also the reason a good reading theme has so few colours in it. There were only ever two.`,
  },
  {
    title: 'Registration, and the millimetre that ruins a spread',
    slug: 'registration-and-the-millimetre',
    excerpt: 'Four inks, four passes, and one of them a hair out of place. Everything you know about print colour — trapping, rich black, the fear of hairline type in three colours — follows from that single millimetre.',
    category: 'Printing', tags: ['colour', 'press', 'craft'],
    series: 'Ink and press', order: 2, ago: 195,
    body: `A colour page is printed four times: cyan, magenta, yellow, black, one after another. Registration is how precisely those four passes line up, and a misregistration of a fraction of a millimetre is visible to anyone, even people who could not name what they are seeing.

The tell is a coloured fringe along a hard edge. Black text on a white ground survives it, because black text is usually printed in black ink alone. Reversed text — white type knocked out of a coloured panel — does not, because now the edge of every letter is the boundary between four separate impressions.

![A registration target: four passes over one cross, and the fraction of a millimetre they disagree by](/uploads/media/registration-target.png)

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
    title: 'Thirty-six views, ten thousand impressions',
    slug: 'thirty-six-views-ten-thousand-impressions',
    excerpt: 'The Great Wave is not a painting. It is a print run — four trades, a dozen blocks, and a registration system made of two notches in the wood. Everything this series has said about presses, Edo said first with cherry planks.',
    category: 'Printing', tags: ['woodblock', 'colour', 'history'],
    series: 'Ink and press', order: 4, ago: 4,
    body: `The most recognised image ever printed is not a painting. Under the Wave off Kanagawa exists as thousands of impressions — plausibly five to eight thousand in the Edo period alone[^1] — pulled from hand-carved cherry blocks until the blocks wore out, recut, and pulled again. It is press work, and every idea this series has described was already in it, two centuries before offset.

![The Great Wave off Kanagawa, from Thirty-six Views of Mount Fuji, about 1831](/uploads/media/hokusai-great-wave.jpg)

## Four trades, one sheet

Hokusai never touched the finished print. Ukiyo-e was a production line with the labour divided the way a modern press room divides it, and the credit followed the money, not the work:

| Trade | Who | Does | Modern equivalent |
|---|---|---|---|
| Eshi | the designer | brush drawing, colour notes | the designer |
| Horishi | the block cutter | one block per colour | plate-making |
| Surishi | the printer | inks, registers, pulls each sheet | the press operator |
| Hanmoto | the publisher | commissions, owns the blocks | the publisher |

The blocks belonged to the publisher, which is why editions kept flowing after an artist's death and why "an original Hokusai print" means an original *impression*, not an original drawing. The drawing was destroyed in the making: it was pasted face-down on the first block and cut through.

## Registration, with two notches

A colour print passed through the press once per colour — the Wave used around eight blocks — and every pass had to land on the last one to within a hairline. The solution was the **kentō**: an L-shaped notch and a straight one, carved into every block just outside the image. The printer seated the sheet's corner into the L, its edge against the bar, and pulled.

That is the whole mechanism. No pins, no optical alignment, no iron — ==two carved marks and a craftsman's thumb, holding registration a modern press would be content with==#green. The coloured fringes that betray a misregistered offset sheet are exactly what a worn kentō produces, which is why late impressions of famous prints have blurred outlines: the notch, not the block, is what wore first.

## The blue that made the series possible

The Wave's sky and water are Prussian blue, a synthetic pigment that had just become cheap through import. Every blue Japan had before it faded in years; Prussian blue held. The Thirty-six Views were advertised on the strength of the new colour, and ==the most famous image in printmaking is, among other things, an ink launch==#blue.

![Fine Wind, Clear Morning: Fuji in three colours, the reward of owning the red](/uploads/media/hokusai-red-fuji.jpg#grid-3x2)

![Rainstorm Beneath the Summit: the same mountain, the same blocks of sky, lightning cut into the key block](/uploads/media/hokusai-storm-below-the-summit.jpg#grid-3x2)

The two prints above are the same mountain from the same series, and comparing them is a lesson in what a colour block is: the compositions share their bones, but each carries its own small set of blocks, and the publisher could reprint whichever one sold.

## An edition is not an object

> [!NOTE]
> Two impressions of the same print can differ in colour, sharpness and even mood — early pulls from crisp blocks with careful inking, late pulls rushed from worn wood. Museums date impressions, not designs. When this series said a proof is a measurement and the file is a prediction, this is the oldest version of that sentence.

The press this site's posts keep circling — [registration](/registration-and-the-millimetre), trapping, the ink-and-paper decision — is usually the European one, iron and lead. It is worth ending the series somewhere else: a press of cherry wood and water-based ink, run by four trades who never signed together, holding tolerances we now need machines for. The constraints are eternal; the ironmongery is optional.

[^1]: Edo-period impression counts are estimates from publishers' records and surviving copies; scholars' figures for the Wave run from about five thousand to eight thousand, with later recuttings adding more. The honest number is "nobody knows, and it kept selling".`,
  },
]
