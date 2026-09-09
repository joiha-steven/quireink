// The notebook's fixture: five notes, three of them clips, so `/notes` and the notes MCP
// tools have something to show and a fresh reader sees what a clip looks like.
//
// A CLIP QUOTES A SENTENCE THAT CAN BE CHECKED. Each quote below is the opening sentence of
// the named Wikipedia article, copied verbatim on 2026-09-09 with its address, so the demo
// never puts words in a source's mouth. The notes between them are the fixture's own voice,
// on the fixture's own subject: letterforms and the making of pages.

export type SeedNote = {
  title: string
  slug: string
  /** Days before the newest post. */
  ago: number
  sourceUrl?: string
  sourceTitle?: string
  quote?: string
  content: string
}

export const NOTES: SeedNote[] = [
  {
    title: 'Where the name of this software comes from',
    slug: 'where-the-name-comes-from',
    ago: 1,
    sourceUrl: 'https://en.wikipedia.org/wiki/Section_(bookbinding)',
    sourceTitle: 'Section (bookbinding) - Wikipedia',
    quote: 'In bookbinding, a section, gathering, or signature is a group of sheets folded in half, to be worked into the binding as a unit.',
    content: 'A quire is the unit a book is actually made of: not the page, which is a face, and not the sheet, which is raw stock, but the folded gathering that gets sewn. Everything about imposition follows from that one fold. Kept here because the post on signatures says the same thing at length and this is the sentence to reach for.',
  },
  {
    title: 'The reed, before the steel nib',
    slug: 'the-reed-before-the-steel-nib',
    ago: 4,
    sourceUrl: 'https://en.wikipedia.org/wiki/Reed_pen',
    sourceTitle: 'Reed pen - Wikipedia',
    quote: 'A reed pen or bamboo pen is a writing implement made by cutting and shaping a single reed straw or length of bamboo.',
    content: 'Cutting and shaping: that is the whole of it. No manufacture, no parts. The Van Gogh letters were written with one of these, which is why the stroke in them thickens and thins exactly as a broad-edged calligraphy pen does. A tool anyone can make in a minute, and the hand that used it is the lesson.',
  },
  {
    title: 'Insular half-uncial: where to look',
    slug: 'insular-half-uncial-where-to-look',
    ago: 9,
    sourceUrl: 'https://en.wikipedia.org/wiki/Book_of_Kells',
    sourceTitle: 'Book of Kells - Wikipedia',
    quote: 'The Book of Kells is an illustrated manuscript and Celtic Gospel book in Latin, containing the four Gospels of the New Testament together with various prefatory texts and tables.',
    content: 'For the letterforms rather than the ornament, the pages to study are the plain text pages, not the Chi Rho: the half-uncial there is written at speed, with the wedge serifs the pen makes by itself. The famous page shows what the hand could do with a month; the text pages show what it did every day.',
  },
  {
    title: 'Ink colours, by task',
    slug: 'ink-colours-by-task',
    ago: 13,
    content: 'A private grammar, written down so it stops drifting. Yellow for the sentence to come back to. Green for a claim that checked out. Pink for the thing that surprised me. Blue for a definition. Orange for a number I will need again. The underline is for structure, never emphasis; the ring is for one word only.',
  },
  {
    title: 'Three books, in reading order',
    slug: 'three-books-in-reading-order',
    ago: 21,
    content: 'Not a bibliography, a sequence. First the one about the tool, because it puts a pen in your hand. Then the one about the page, because a page is what the tool makes. Then the one about the trade, because printing is where both were argued out for five hundred years. Read them the other way round and the first two look like footnotes to the third.',
  },
]
