// The phone's book reader: the same paper as the desktop spread, scrolled instead of turned.
//
// Its own sheet because it is its own thing — the spread is a modal <dialog> that takes the
// scroll off the document, and this deliberately does not, so that iOS keeps retracting its
// own bars while the reader reads. `book.css.ts` was also at its 400-line ceiling.
//
// NO BACKTICKS anywhere below: check:css-literal enforces that, and one in a comment ends
// the template literal this file is.
export const BOOK_PHONE_CSS = `
/* THE PHONE'S READER: the same paper, scrolled instead of turned (book-scroll.ts).
   It is not a dialog, so the DOCUMENT scrolls — which is the whole point, because iOS only
   retracts its address bar and toolbar while the page itself is moving. Measured on an
   iPhone at 844px: Safari kept 190px and the reader's own bar another 56, so the words had
   under 600 and a nineteen-page article turned a page every four sentences.
   The page's own content is hidden by one rule rather than by touching every element, so
   closing the reader restores the page with nothing to remember. */
/* THE GROUND BEHIND SAFARI'S OWN BARS IS THE PAPER, and that is the whole of this rule.
   iOS paints the status bar's strip, and the area its address bar retracts from, with the
   document's background - the site's page colour, white on the default palette - not with
   whatever element happens to be under it. So the reader had a white band above its paper
   on an iPhone, exactly where an ordinary page shows none, because an ordinary page IS
   white there. The reader is paper to the top of the glass only if the document is. The
   island also sets theme-color to the same stock while the reader is open (book-scroll.ts),
   which is what Safari reads first when it is present. */
html.book-reading,html.book-reading body{background:#faf8f3}
html.book-reading{overflow-x:hidden}
html.book-reading body>*:not(.book-reader){display:none}
.book-reader{min-height:100dvh;font-family:var(--font-reading);letter-spacing:var(--ls-body);
  --book-paper:#faf8f3;--c-bg:var(--book-paper);--type-scale:1.05;
  --c-text:#211f1a;--c-heading:#16130d;--c-meta:#6f6a5c;--c-link:#2f2c25;
  --c-accent:#2f2c25;--c-rule:#e2ddd2;color:var(--c-text);
  background-color:var(--book-paper);background-blend-mode:multiply;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.24'/%3E%3C/svg%3E")}
/* FIXED, not sticky: Safari resizes the visual viewport as its own bars collapse, and a
   sticky bar rides that resize in steps while the thumb is still moving. Fixed, plus the
   direction rule in the island, is what makes it feel like a reading app rather than like
   a header being dragged. */
.book-reader .book-chrome{position:fixed;inset-inline:0;top:0;z-index:2;
  padding-top:env(safe-area-inset-top,0px);background:var(--book-paper);
  transition:transform var(--dur-fast) ease}
.book-reader.chrome-away .book-chrome{transform:translateY(-100%)}
/* THE STATUS BAR'S OWN STRIP, and it stays when the chrome leaves.
   With the reader open the page asks for viewport-fit=cover (book-scroll.ts), because that
   is what makes iOS report a real safe-area inset — and what lets the paper run to the very
   top of the glass instead of stopping at a seam. The cost of covering is that the clock and
   the battery are then drawn OVER the page, so a line of type scrolling past sits under them
   and is unreadable for those pixels. This strip is the paper that catches it: the line goes
   behind a band of the same stock rather than behind the status bar. Zero-height on any
   device that has no inset, so nothing changes there. */
.book-reader::before{content:'';position:fixed;inset-inline:0;top:0;z-index:3;
  height:env(safe-area-inset-top,0px);background:var(--book-paper)}
/* The inset, the bar and its rule, so the first line clears all three when the bar shows. */
.book-page{padding:calc(env(safe-area-inset-top,0px) + 56px + 1.5rem) 20px calc(3rem + env(safe-area-inset-bottom,0px))}
.book-reader .book-flow{max-width:38rem;margin:0 auto;columns:auto;column-width:auto;width:auto}
/* Motion off is the engine gate in motion.css.ts, not a rule here. */
`.trim()
