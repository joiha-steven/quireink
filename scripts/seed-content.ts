// The posts the showcase fixture is built from. Split out of `seed-showcase.ts` at the
// 400-line cap; that file is the machinery, this one is the words.
//
// ONE SUBJECT: letterforms and the making of pages. Calligraphy, type, layout, printing, and
// nothing else. A demo whose posts wander across five topics reads as filler; a demo that
// stays on one reads as a real publication, and this one can talk about the thing the reader
// is looking at while they look at it.
//
// SEVERAL LANGUAGES, on purpose. The bundled subsets cover latin, latin-ext and vietnamese
// (`src/render/font-faces.ts`), so Vietnamese tone marks, German umlauts, Polish ogoneks,
// Czech hačeks, Turkish dotless i and Icelandic eth all render in the real face. CJK is
// deliberately absent: no bundled subset carries it, so it would fall back to a system font
// and demonstrate the opposite of the point.
//
// ONE LINE PER PARAGRAPH. The renderer turns a single newline into a `<br>`, so prose typed
// at 90 columns comes out ragged.

export type Seed = {
  title: string
  slug: string
  excerpt: string
  category: string
  tags: string[]
  /** Days before the newest post. Irregular on purpose: a real archive is not a metronome. */
  ago: number
  body: string
  series?: string
  order?: number
}

const SPECIMEN = `Every writing system asks something different of a typeface, and the ones below ask it all at once:

> Việt Nam — chữ Quốc ngữ chồng hai dấu lên một nguyên âm: **nhoẻn**, **khuỷu**, **được**.
> Deutsch — Größe, Fußnote, Maßstab.
> Polski — zażółć gęślą jaźń.
> Čeština — příliš žluťoučký kůň úpěl ďábelské ódy.
> Türkçe — ışık, İstanbul, yığın.
> Íslenska — það þótti æði.

If the accents collide with the line above, the leading is too tight for the language, not for the typeface.`

export const POSTS: Seed[] = [
  {
    title: 'The measure is the design',
    slug: 'the-measure-is-the-design',
    excerpt: 'Sixty-six characters is not a superstition. It is the width at which the eye stops losing its place.',
    category: 'Typography', tags: ['measure', 'reading', 'layout'],
    series: 'Designing a reading page', order: 1, ago: 0,
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
    title: 'A type scale you can defend',
    slug: 'a-type-scale-you-can-defend',
    excerpt: 'Every size on the page comes from a role, so one setting changes the page rather than one heading.',
    category: 'Typography', tags: ['scale', 'layout', 'craft'],
    series: 'Designing a reading page', order: 2, ago: 9,
    body: `Most type scales are a list of numbers somebody liked. That works until the day you want the whole page a little larger, and you discover the numbers were never related to each other at all.

A scale is defensible when every size is derived, and when each size belongs to a **role** rather than to a place. Not "the h2 on the article page" but "a section heading" — because the moment a size is attached to a location, the same heading in a second location gets a second number, and the two drift.

## A ratio, and the honesty to break it

Pick a ratio and generate from the body size. A minor third (1.2) is quiet and works for text-heavy pages; a perfect fourth (1.333) is dramatic and runs out of room quickly on a small screen.

Then allow yourself to round. A scale that produces 27.65px is a scale nobody will follow, and the rounding is not a compromise: the eye cannot tell 27.65 from 28, and the person maintaining the page can.

## Leading and tracking travel with the size

The mistake that survives longest is treating leading as one number. Large text needs proportionally *less* leading than small text, and display sizes usually want negative tracking while small sizes want a touch of positive. So a role is not a size, it is a triple: size, leading, tracking. Set all three or you will set them by accident later.`,
  },
  {
    title: 'Dấu phụ tiếng Việt và chiều cao chữ hoa',
    slug: 'dau-phu-tieng-viet',
    excerpt: 'Chữ Quốc ngữ chồng hai dấu lên một nguyên âm. Đó là bài kiểm tra khắc nghiệt nhất cho khoảng cách dòng.',
    category: 'Typography', tags: ['vietnamese', 'diacritics', 'leading'],
    ago: 21,
    body: `Tiếng Việt là một trong số ít chữ viết Latinh chồng **hai** dấu lên cùng một nguyên âm: một dấu phụ chỉ âm, một dấu thanh. Chữ **ế** mang mũ rồi mang sắc; chữ **ườ** mang móc rồi mang huyền.

Hệ quả là phần trên của dòng chữ tiếng Việt cao hơn hầu hết các ngôn ngữ khác dùng cùng bộ chữ cái. Một khoảng cách dòng vừa đủ cho tiếng Anh sẽ khiến dấu sắc của dòng dưới chạm vào chân chữ **g** hoặc **y** của dòng trên.

## Ba chỗ hay hỏng

Chữ hoa có dấu là chỗ hỏng đầu tiên: **Ế**, **Ộ**, **Ữ** đẩy dấu lên trên cả chiều cao chữ hoa, nên tiêu đề viết hoa toàn phần gần như luôn phải nới thêm.

Chỗ thứ hai là tiêu đề cỡ lớn, nơi khoảng cách dòng thường bị siết xuống dưới 1.1. Với tiếng Anh thì đẹp, với tiếng Việt thì dấu chồng lên nhau.

Chỗ thứ ba là font không thật sự hỗ trợ tiếng Việt mà chỉ có sẵn vài chữ dựng tạm. Dấu sẽ đúng hình nhưng sai vị trí, và người đọc nhận ra ngay dù không gọi tên được vấn đề.

## Cách kiểm nhanh

Đặt cạnh nhau hai dòng chữ hoa có dấu, để khoảng cách dòng bạn định dùng, rồi nhìn khoảng trống giữa chúng. Nếu phải nhìn kỹ mới thấy nó đủ, tức là chưa đủ.

Deutsch, Polski und Türkçe stellen dieselbe Frage in kleinerem Maßstab: Größe, zażółć, ışık.`,
  },
  {
    title: 'Die Kunst der Kapitälchen',
    slug: 'die-kunst-der-kapitaelchen',
    excerpt: 'Echte Kapitälchen sind gezeichnet. Alles andere ist verkleinerte Versalschrift und sieht auch so aus.',
    category: 'Typography', tags: ['small caps', 'craft'],
    ago: 34,
    body: `Kapitälchen sind der stillste Akzent, den die Typografie kennt. Sie heben ein Wort hervor, ohne die Zeile zu stören, weil sie die Höhe der Kleinbuchstaben behalten und trotzdem die Form der Großbuchstaben tragen.

Der Unterschied zwischen echten und gefälschten Kapitälchen ist keine Feinheit. Echte sind eigens gezeichnet, mit kräftigeren Strichen und weiterem Abstand. Gefälschte entstehen, indem der Browser Versalien verkleinert — und dabei werden die Striche dünner als die der umgebenden Schrift, sodass das hervorgehobene Wort blasser wirkt als der Text, aus dem es herausstechen soll.

## Wo sie hingehören

An den Anfang eines Kapitels, für die erste Zeile nach einer Initiale. Für Abkürzungen, die sonst als Versalienblock die Zeile zerschneiden. Für Namen in einem Register.

Nicht für ganze Absätze. Kapitälchen sind schwerer zu lesen als Kleinbuchstaben, weil ihnen die Ober- und Unterlängen fehlen, an denen das Auge die Wortform erkennt.

## Ein Wort zur Sperrung

Kapitälchen brauchen mehr Laufweite als Kleinbuchstaben, aus demselben Grund wie Versalien: Ihre Formen sind breiter und gleichmäßiger, und ohne zusätzlichen Raum kleben sie aneinander.`,
  },
  {
    title: 'La chasse, l’approche et le gris typographique',
    slug: 'la-chasse-et-l-approche',
    excerpt: 'Trois mots français pour trois choses que l’anglais confond sous le mot spacing.',
    category: 'Typography', tags: ['kerning', 'tracking', 'craft'],
    ago: 48,
    body: `Le français distingue ce que l'anglais mélange. La **chasse** est la largeur propre d'un caractère, gravée dans la fonte. L'**approche** est l'espace entre deux caractères. Le **gris typographique** est la teinte moyenne que produit un bloc de texte quand on le regarde de loin, les yeux mi-clos.

Ces trois notions ne se règlent pas au même endroit, et les confondre est la source de la plupart des pages mal composées.

## Le crénage n'est pas l'interlettrage

Le crénage corrige une paire précise : **AV**, **To**, **Ye**. Il est inscrit dans la fonte par le dessinateur, qui a vu le problème avant vous.

L'interlettrage agit sur tout un bloc. On l'ouvre légèrement pour les capitales et les petites capitales, on le resserre un peu pour les grands corps. Sur un texte courant, y toucher revient presque toujours à abîmer le gris.

## Regarder le gris plutôt que les lettres

Pour juger une composition, éloignez-vous jusqu'à ne plus lire. Les mots deviennent une texture. Si cette texture montre des trous, des rivières blanches qui descendent le long du bloc, le problème est dans la justification, pas dans la police.

Same test, other languages: Íslenska, Čeština, Türkçe. Cùng một phép thử với tiếng Việt.`,
  },
  {
    title: 'The broad-edged pen, and what it still teaches',
    slug: 'the-broad-edged-pen',
    excerpt: 'Nearly every serif on your screen is a frozen record of a flat nib held at an angle.',
    category: 'Calligraphy', tags: ['pen', 'history', 'letterforms'],
    ago: 63,
    body: `Pick up a broad-edged pen, hold it at thirty degrees, and write an **o**. The stroke is thick on the down-left and thin on the up-right, and you did nothing to make it so: the nib is a flat edge, and the width of the mark is simply how much of that edge is facing the direction you are travelling.

That single fact explains most of what a serif typeface looks like. The thick and thin of a Garamond, the axis its round letters lean on, the way the join between bowl and stem thins to nothing — none of it is decoration. It is a record of a tool.

## The angle is the style

Hold the pen flatter and the contrast moves: you get the upright, heavy-footed look of an uncial. Hold it steeper and you approach the diagonal stress of an italic. Change nothing but the angle and the letterform changes family.

This is why type designers still learn to write with a pen even though nobody sets books with one. The pen teaches which parts of a letter are structural and which are habit.

## What the pen cannot teach

It cannot teach spacing. A calligrapher spaces by feel, one letter at a time, and every line is different. A typeface has to space every possible pair in advance, forever, without knowing what will sit next to what.

That is the jump from writing to type, and it is a much larger jump than drawing the letters.`,
  },
  {
    title: 'Chancery italic in ninety minutes',
    slug: 'chancery-italic-in-ninety-minutes',
    excerpt: 'The Renaissance hand that became our italic, reduced to four shapes and one angle.',
    category: 'Calligraphy', tags: ['italic', 'practice', 'history'],
    ago: 79,
    body: `Cancellaresca, the chancery hand of sixteenth-century Rome, is the ancestor of every italic on your screen. It is also, unusually for a calligraphic hand, learnable in an afternoon, because almost all of it is built from four shapes.

## The four shapes

The first is a slightly compressed **o**, an oval rather than a circle, leaning about five degrees. Everything round in the hand comes from it.

The second is the **branching arch** of the **n**, which leaves the stem low, about a third up from the baseline, and curves out. Get the branch too high and you have a roman **n** in a hurry.

The third is the **a**, which is the oval with a stem. The fourth is the entry and exit stroke, the small diagonal that joins one letter to the next and gives the hand its slope and its speed.

## The angle, and the only rule that matters

Nib angle around forty degrees, slope around five to ten. Then keep both constant. A page of chancery with a wandering slope looks worse than a page of a clumsier hand held steady, because the eye reads inconsistency long before it reads quality.

## Why bother

Because writing the letters teaches you where an italic's weight sits, and after ninety minutes you will never again mistake a slanted roman for an italic. One is a hand. The other is a transformation matrix.`,
  },
  {
    title: 'Thư pháp và nhịp thở',
    slug: 'thu-phap-va-nhip-tho',
    excerpt: 'Nét chữ đẹp không đến từ cổ tay. Nó đến từ chỗ người viết quyết định dừng lại.',
    category: 'Calligraphy', tags: ['vietnamese', 'practice', 'rhythm'],
    ago: 96,
    body: `Người mới học thư pháp thường tập trung vào hình dáng từng chữ. Người viết lâu năm tập trung vào khoảng nghỉ giữa các chữ, vì đó mới là chỗ quyết định cả trang giấy nhìn có sống hay không.

Một dòng chữ đẹp có nhịp. Nét xuống nặng, nét lên nhẹ, rồi một quãng ngắt trước khi bắt đầu chữ tiếp theo. Nhịp ấy đến từ hơi thở của người viết chứ không từ thước kẻ, và đó là lý do một dòng chép lại từ bản mẫu bao giờ cũng cứng hơn bản gốc.

## Ba lỗi thường gặp

Thứ nhất là viết quá chậm. Nét chậm bị run, và mực đọng lại ở chỗ ngòi dừng, làm dày lên những chỗ lẽ ra phải mảnh.

Thứ hai là cố sửa một nét đã viết hỏng. Trong thư pháp không có nút hoàn tác; một nét sửa bao giờ cũng lộ hơn một nét sai.

Thứ ba là canh chữ theo từng chữ thay vì theo cả dòng. Mắt đọc theo dòng, nên một dòng có nhịp đều sẽ đẹp hơn một dòng gồm toàn những chữ đẹp rời rạc.

## Tập gì trước

Tập một nét duy nhất, lặp lại kín một trang, cho tới khi nét thứ năm mươi giống nét đầu tiên. Đó là bài tập chán nhất và cũng là bài tập duy nhất thật sự có tác dụng.`,
  },
  {
    title: 'Notes on reading, on paper and on glass',
    slug: 'reading-on-paper-and-glass',
    excerpt: 'A measure, a leading and a typeface walk into a column. Only one of them is usually blamed.',
    category: 'Typography', tags: ['reading', 'screens', 'paper'],
    ago: 118,
    body: `Reading on a screen is not reading on paper with the lights on. The differences are small individually and they compound, and almost all of them push in the same direction: a screen needs more air.

## Contrast is not the same problem

On paper, ink is darker than anything a screen emits, and the page reflects the light in the room. On a screen the page *is* the light source, so pure black on pure white is harsher than the equivalent on paper. Most well-set screen text is not black; it is a very dark grey, and the reason is comfort rather than style.

## The resolution argument is mostly over

For twenty years the honest answer to "why does this look worse on screen" was pixel density. That argument has largely expired: a modern phone resolves type better than newsprint. What remains is variability — the same page renders on a hundred different panels at a dozen brightnesses, and unlike a printed book you cannot tune for the medium because there is no single medium to tune for.

## What actually helps

Slightly more leading than you would set in print. A slightly shorter measure, because a screen is read at a less predictable distance. And a size chosen for the worst case rather than the best: someone reading on a bus, one-handed, at arm's length.

None of that is exotic. It is the same craft, applied to a surface that moves.`,
  },
  {
    title: 'Imposition: why page 1 sits beside page 8',
    slug: 'imposition-why-page-one-sits-beside-page-eight',
    excerpt: 'Fold a sheet three times and the page order stops being obvious. Printers solved this before 1500.',
    category: 'Printing', tags: ['imposition', 'binding', 'workflow'],
    ago: 141,
    body: `A book is not printed a page at a time. It is printed on large sheets, each carrying many pages, which are then folded, cut and gathered. Working out which page goes where on the sheet, and which way up, is called imposition, and getting it wrong wastes the whole run.

Take one sheet folded three times: eight pages a side, sixteen in all. On the outer face, page 1 sits beside page 8, because after the fold those two ends meet. Half the pages are printed upside down relative to the other half. Hold a cheap paperback up to the light at the spine and you can still see the logic.

## Why it survives digital

Because folding survives. A book printed today on a digital press is still imposed, still folded into gatherings, still trimmed on three edges. The arithmetic did not change when the plates did.

## The part that bites

Creep. The pages at the centre of a folded gathering stick out further than the ones on the outside, because they travel around more paper. On a thick gathering the trim removes more margin from the inner pages than the outer, so the margins you drew are not the margins you get.

The fix is to shift each page slightly inward as it approaches the centre of the gathering. Every imposition tool does this and every first-time self-publisher discovers it after the proof arrives.`,
  },
  {
    title: 'A signature, a gathering, a quire',
    slug: 'a-signature-a-gathering-a-quire',
    excerpt: 'Three words for nearly the same thing, and the small differences that still matter at the bindery.',
    category: 'Printing', tags: ['binding', 'vocabulary', 'history'],
    ago: 167,
    body: `A **quire** is a set of sheets folded together and nested one inside another, ready to be sewn. It is one of the oldest units of bookmaking, older than printing, and it is why the pages of a hardback come in clumps rather than as loose leaves.

A **gathering** is the same object, described from the binder's side of the bench. A **signature** is strictly the mark — a letter or number printed in the tail margin of the first page of each gathering, so the person collating them can see at a glance that gathering H follows G. The word slid across to mean the gathering itself, and now all three are used interchangeably by almost everyone.

## Why the distinction is not pedantry

Because the signature mark is the only one of the three you can point at on a finished book. Open an older hardback at the spine and look at the bottom of the first page of each clump: the small letters are still there, doing the job they did in 1490.

## Four leaves, eight pages

The commonest quire is four sheets folded once: eight leaves, sixteen pages. Hence *quaternion*, hence the Latin *quaterni*, four together, which is where the word itself comes from.

It is a good word for a thing made of folded sheets. That is what a book is, and it is what this software is named after.`,
  },
  {
    title: 'Registration, and the millimetre that ruins a spread',
    slug: 'registration-and-the-millimetre',
    excerpt: 'Four inks, four passes, and one of them a hair out of place. Everything you know about print colour follows from this.',
    category: 'Printing', tags: ['colour', 'press', 'craft'],
    ago: 195,
    body: `A colour page is printed four times: cyan, magenta, yellow, black, one after another. Registration is how precisely those four passes line up, and a misregistration of a fraction of a millimetre is visible to anyone, even people who could not name what they are seeing.

The tell is a coloured fringe along a hard edge. Black text on a white ground survives it, because black text is usually printed in black ink alone. Reversed text — white type knocked out of a coloured panel — does not, because now the edge of every letter is the boundary between four separate impressions.

## Why small reversed type is a trap

At small sizes the stems are thinner than the registration tolerance of the press. The letters close up, fill in, or acquire a coloured halo. A design that looked crisp on screen arrives as mud, and no amount of arguing with the printer fixes it.

## Rich black, and knowing when not to

Solid black on a large area looks weak in plain black ink, so printers mix in some cyan to deepen it. That is rich black, and it is right for a filled panel. It is wrong for text, because now the text has two inks to register and you are back to fringed edges.

Plain black for type, rich black for areas. That one rule prevents most print colour disasters, and it is older than any of the software involved.`,
  },
  {
    title: 'Ink, paper, and the colour between them',
    slug: 'ink-paper-and-the-colour-between-them',
    excerpt: 'A palette is two decisions: what the ink is, and what it sits on. Everything else is adjustment.',
    category: 'Printing', tags: ['colour', 'paper', 'palette'],
    ago: 224,
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
  {
    title: 'Kerning is not tracking, and neither is spacing',
    slug: 'kerning-is-not-tracking',
    excerpt: 'Three controls, three different jobs, and a great deal of type ruined by reaching for the wrong one.',
    category: 'Typography', tags: ['kerning', 'tracking', 'craft'],
    ago: 256,
    body: `**Spacing** is the sidebearing built into each glyph: how much air the designer left on either side of the letter. It applies always, to every pair, and you do not get to change it without editing the font.

**Kerning** is a correction to a specific pair. **AV** would gap without it; **To** would leave the o stranded. The font carries a table of these, sometimes thousands of them, each one a judgement the designer already made.

**Tracking** is a uniform adjustment across a run of text. It is the blunt instrument of the three, and it is the one most often misused, because it is the one exposed most prominently in every design tool.

## The rule of thumb

Tracking is for display sizes and for capitals. Large text needs slightly negative tracking because the spacing was drawn for reading sizes and looks loose when scaled up. Capitals and small capitals need slightly positive, because their forms are wide and even and they crowd each other.

Body text needs neither. If a paragraph looks too loose or too tight at reading size, the problem is almost always the typeface, the size, or the measure — not the tracking.

## When to override a kern pair

Almost never in text. Sometimes in a headline, where a single bad pair is large enough to be a visible hole, and where you are setting six words rather than six hundred. That is the honest boundary: kerning by hand is a display activity.`,
  },
]
