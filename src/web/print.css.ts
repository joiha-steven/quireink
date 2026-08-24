// The printed page.
//
// There was no `@media print` rule anywhere in this repository — measured 2026-08-24, zero
// across twelve sheets — so a reader who printed an essay, or saved it as a PDF, got the
// SCREEN: the reading-progress bar across the top, the site bar's [search] [dark] [palette]
// [menu] controls, a "Chế độ đọc sách" button that does nothing on paper, then the related
// posts, the whole comment thread, the subscribe card and the site footer. Ten pages for a
// four-page essay, and the first thing on it is four dead buttons.
//
// That is worth a sheet of its own for a product whose tagline is "Letterforms, and the
// making of pages". Every serious reader of long essays prints or saves them; the platforms
// this one is measured against all print like a web page, because a print stylesheet is the
// last thing anybody writes and the first thing nobody tests.
//
// The rules divide into three: what a screen needs and paper does not, the palette a sheet
// of paper actually has, and the breaks a page has to respect.
//
// NO BACKTICKS anywhere below: this is one template literal and a backtick ends it.
// `check:css-literal` enforces that.

export const PRINT_CSS = `
@media print{
/* ── 1. The furniture ─────────────────────────────────────────────────────────────────
   Controls, conversation and invitations. Each one is a thing to DO, and none of them can
   be done on paper. Comments and related posts go too, and that is a judgement rather than
   an oversight: the reader asked for this essay, not for thirty replies to it and a list of
   links they cannot follow.
   !important, deliberately and only here. A print rule has to win against every screen rule
   in a 40 KB sheet, including ones written after this file — .book-overlay[open] sets
   display:grid, nav.toc.rail outranks .toc on specificity, and .to-top.shown re-enables what
   .to-top left off. Losing any one of those puts a fixed black circle over the text.
   .rail-toggle is NOT in this list and does not need to be: chrome.ts pushes it into the
   .site-actions nav above, so it is already gone. The test that checks every selector here
   is a selector the site still uses is what said so. */
.progress,.site-actions,.toc,.to-top,.book-fab,.meta-book,.skip-link,.quote-copy,
.book-overlay,.lightbox,.subscribe-overlay,.subscribe-card,form.subscribe,
#comments,.related,footer.site{display:none!important}
/* ...and the rule drawn ABOVE each of them, which would otherwise be left ruling off the
   end of the essay against nothing. The divider belongs to the block it introduces, and
   :has is how a stylesheet says that without the renderer having to know. */
hr:has(+ .related),hr:has(+ #comments){display:none!important}

/* ── 2. The palette of a sheet of paper ───────────────────────────────────────────────
   The TOKENS are redefined, not the rules: every public rule already paints in var(--c-*),
   so one block turns the whole site into ink on paper and nothing downstream has to know.
   This is the same job content/themes.ts does for a palette, and paper is a palette.
   !important because the palette blocks land AFTER this sheet in the document and
   html.dark wins on both order and specificity — a reader printing at night should not
   be handed a black page, and most browsers would drop the background and print white
   text on white anyway.
   --c-accent is left ALONE on purpose. It is the pen: the highlighter, the circled word,
   the underline drawn by hand. Those are the reason a page from this site looks like this
   site, and a colour printer should give the reader the marks the writer made. */
:root{--c-bg:#fff!important;--c-text:#1a1a1a!important;--c-heading:#000!important;
  --c-meta:#555!important;--c-link:#1a1a1a!important;--c-rule:#c8c8c8!important}

/* ── 3. The page ──────────────────────────────────────────────────────────────────────
   16mm inner, 18mm head and foot: room for a thumb, and the head margin larger than the
   inner is the same instinct as the article this site opens with. */
@page{margin:16mm 18mm}
html,body{background:#fff}
/* The shell width is a SCREEN measure (42rem inside a viewport, sized against a reading
   distance of arm's length). Paper is closer and A4 is wider, so the block is set in the
   paper's own units: 150mm at the 12pt a default 16px body prints as is about 70
   characters, the measure this site's own essay argues for. Dropped entirely at first,
   and the line ran
   the full 178mm of printable width — 110 characters, and the eye loses its place on the
   return sweep long before that.
   On .wrap rather than on main, because the masthead is in there too: measured on main
   alone, the site name sat hard against the paper's edge with the text block starting
   25mm inside it, and a header that does not stand over its own column reads as a
   printing fault. */
.wrap{max-width:150mm;padding:0;margin:0 auto}
.with-rail{display:block}
main{padding:0}

/* The masthead earns its ink once, as provenance: which site this came off. */
header.site{padding:0 0 .6rem;margin-bottom:1.6rem;border-bottom:.5pt solid var(--c-rule)}

/* The type is the OWNER'S, at the size and leading they set, and this block deliberately
   does not touch either.
   It did at first — 10.5pt body, 20pt title, the sizes a book is set at — and
   check:type-roles refused it: "a size on the reader's page that the owner cannot set".
   The guard is right and the reasoning is worth keeping. A blog that has chosen a large
   reading size has usually chosen it for a reason, and paper is not where to quietly undo
   that. A browser prints 1px as 1/96in, so a 16px body lands at 12pt, which is a page of
   a large-print edition rather than a mis-set one.
   What paper does need is hyphenation: the screen measure is set for a viewport and the
   printed one is fixed, so an unhyphenated rag opens holes that no reader can close. */
.prose{hyphens:auto}

/* A link on paper is a dead end unless it says where it went. Only in the prose, only when
   it leaves the site, and never for a footnote marker or an anchor — those point at a place
   already on the page. */
.prose a{text-decoration:underline}
.prose a[href^="http"]::after{content:" <" attr(href) ">";font-size:.85em;
  color:var(--c-meta);word-break:break-all}
.prose a[href^="#"]::after,.prose a.footnote-ref::after,.prose .footnotes a::after{content:none}

/* ── 4. What may not be cut in half ───────────────────────────────────────────────────
   A heading at the foot of a page is a heading for nothing; a table split across a fold is
   a table read twice. */
h1,h2,h3,h4,h5{break-after:avoid-page;break-inside:avoid}
figure,table,pre,blockquote,.callout,.math-block,.series,li{break-inside:avoid}
p,li{orphans:2;widows:2}
img{max-width:100%!important;height:auto}
/* A code block scrolls on a screen and cannot on paper, so it wraps instead of losing the
   right-hand end of every long line. */
pre{white-space:pre-wrap;word-wrap:break-word;border:.5pt solid var(--c-rule)}
table{width:100%;border-collapse:collapse}
}
`
