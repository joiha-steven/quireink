# 0043 — The reader gets a pen, and it writes in their browser first

Date: 2026-09-09
Status: accepted

## Context

Every gesture the pen makes on a page — the highlighter (0018), the underline and the ring
(0026), the marks at the head of a list (0042) — belonged to the writer. A reader could
copy a sentence with a link back to it (the quote gesture) and be offered their reading
position (`resume.ts`), and that was the whole of what the page let them do to it. On paper
it is the other way round: the marks that make a book somebody's are the reader's.

The question that stalled this was where a reader's marks would live. The reflex answer
was an account — and an account is a sign-up wall in front of the first highlight, a
password to reset, and a server that now holds what strangers underlined. Medium asks for
the account first, and that is why its readers do not highlight.

Three things were already true here and shaped the answer more than the reflex did:

- The comment gate needs no account (0032) and the reading position lives in the
  reader's own browser. "The blog does not need to know who you are to be polite to you"
  is a rule this product has already made twice.
- Commenters can already sign in with Google (0013), so a reader who wants their marks
  to follow them has an identity the site knows, without a new account system.
- Every blog is one process with one database (0021). A reader's marks across ten blogs
  would sit on ten servers; the only place they can be one notebook is somewhere the
  reader owns.

## Decision

**Three tiers, and no tier may gate the one before it.** This ADR ships the first:

1. **In the browser, asked nothing.** Select words on a post and a bar offers the five
   inks, the underline, the ring, a note, and the quote. A mark is stored in
   `localStorage` under the page's path — the words, their surroundings, the gesture, the
   ink, the note — and drawn again on the next visit. Nothing is sent, and the owner
   cannot see it.
2. *(later)* **"Keep these"** — the reader who has marked a few things is offered sync
   through the sign-in commenters already have, or a notebook code in the shape of
   `SETUP_CODE`, for those who will not use Google.
3. *(later)* **A notebook of the reader's own** — every mark can be sent to the reader's
   own Quire Ink, or any site that speaks Micropub, with IndieAuth for identity and
   Webmention back to the author. The commonplace book, on the reader's server.

**A mark is anchored to words, never to positions.** A text-quote selector, the W3C Web
Annotation shape: the exact words, and thirty-two characters either side to tell two
occurrences apart. Positions break the moment the owner fixes a typo three paragraphs up;
a quote survives every edit that leaves its sentence alone, and when the sentence is gone
the mark fails to land rather than landing on the wrong words. Whitespace that re-flows is
forgiven (the same words, any spacing); the words themselves are not.

**It draws with the writer's pen.** A reader's highlight is `<mark data-pen data-ink
data-reader>`, an underline `<u data-pen data-reader>`, a ring `<mark data-form="o">` —
the same elements, the same dies, the same two sheets. The variant is dealt by the same
hash of the words, from the same short or long half of the deck. There is one hand on the
page, and it is the site's.

**The sheets are linked on demand.** 0027 keeps the pen off a page with no ink on it, and
this holds: the island links `pen-marks` and `pen-lines` itself, the moment a mark needs
them. A reader's own mark arriving a beat after the words is the one late stylesheet this
site accepts, because the reader made it and knows where it is.

**Its own bundle, its own switch, and it takes over the selection.** `reader-pen.js` is
fetched only where `features.readerPen` is on (on by default), and while it is on the
page, `quote.ts` stands down: the copy gesture rides in the bar, so one selection raises
one menu.

**A note is a card under the paragraph.** In the sans face, in the meta colour, marked
`data-pen-skip` so its words never become part of another mark's anchor. A margin proper
belongs to a later tier and a wider design.

## Consequences

- `reader-pen.js` costs 9.2 KB minified (~3.5 KB gzipped) on a page that has the switch
  on; nothing on a page that does not. The other bundles are unchanged — an early cut
  exported a function from the entry and Bun answered by adding its ESM shim to EVERY
  bundle in the build, +550 bytes each, which is recorded here so nobody exports from an
  entry again.
- Marks live in one browser. Clearing site data loses them, and that is the honest cost of
  tier one; tier two exists to answer it. The store caps at five hundred per page.
- A mark across bold or a link is several elements sharing one `data-reader`; a mark
  laid over another nests, and both strokes show — as two passes of a pen would.
- The owner learns nothing from it, and there is nothing to moderate. "Most highlighted"
  waits for a tier where the reader has chosen to send something.
