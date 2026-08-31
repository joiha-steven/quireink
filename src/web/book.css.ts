// Book mode's chrome: the overlay, the paged flow, and the two ways into it.
//
// Split out of `islands.css.ts` on 2026-08-24, when the quote control put that file over
// the 400-line ceiling. The seam is the one the code already draws — `assets/js/book.ts`
// is the island, this is its sheet — and it is 300 of the 414 lines, so the cut is where
// the weight is rather than at an arbitrary halfway point.
//
// Order still matters and is preserved: `public.css.ts` interpolates this immediately
// after `ISLANDS_CSS`, exactly where these rules used to sit, so nothing below them in the
// cascade changed hands.
//
// NO BACKTICKS anywhere below: this is one template literal and a backtick ends it.
// `check:css-literal` enforces that.

export const BOOK_CSS = `
/* Book mode. Its OWN standard rather than the site theme: paper and ink, not the reader's
   palette, and the same on a dark site as a light one. Carried over from the frozen tree.
   The columns come from column-width, so the BROWSER paginates and turning a page is one
   transform on the flow rather than a measurement loop fighting the layout engine. */
/* Still WORDS, on a page made of words — a bordered box in the gutter of an article is
   furniture, and this panel is the quietest thing on the page. What it gains is a TARGET:
   the row is padded to a hand's height and pulled back out with a negative margin, so the
   hit area is 36px tall while the layout is exactly where it was. The icon says it does
   something; the ink says it is not another fact; the press comes from the shared click. */
.book-mode-toggle{display:inline-flex;align-items:center;gap:.4rem;font:inherit;font-weight:500;
  color:var(--c-heading);background:none;border:0;cursor:pointer;
  padding:.5rem .5rem;margin:-.5rem -.5rem;border-radius:var(--radius,.5rem);
  text-underline-offset:3px;transition:background-color var(--dur-fast),color var(--dur-fast)}
.book-mode-toggle svg{flex-shrink:0;opacity:.75}
.book-mode-toggle:hover{background:color-mix(in srgb,var(--c-rule) 45%,transparent);text-decoration:underline}
.book-mode-toggle:hover svg{opacity:1}
@media (max-width:767px){.meta-book,.book-mode-toggle{display:none}}

/* The phone's doorway into the reader. The desktop entries (the meta line, the info
   panel) are hidden under 768px because the meta line is cramped there — so this button
   is the mobile entry, and it speaks the to-top button's exact language: same circle, same
   border, same colours, parked one slot above it in the same column, and — the part that
   keeps it out of the way — the same appearing act: nothing until the reader has scrolled
   past the first viewport, then a fade-in. A reader who never scrolls never sees it. */
.book-fab{position:fixed;bottom:4.5rem;right:1.25rem;z-index:40;display:none;width:2.5rem;
  height:2.5rem;align-items:center;justify-content:center;border:1px solid var(--c-rule);
  border-radius:999px;background:var(--c-bg);color:var(--c-meta);cursor:pointer;opacity:0;
  pointer-events:none;transition:opacity var(--dur-base),color var(--dur-base)}
.book-fab.shown{opacity:1;pointer-events:auto}
.book-fab:hover{color:var(--c-heading)}
@media (max-width:767px){.book-fab{display:flex}}

body:has(.book-overlay[open]){overflow:hidden}
.book-overlay[open]{display:grid}
/* Book mode is its OWN standard, not the site theme and not dark mode: a printed page. ONE
   flat warm-paper background across the whole reader, near-black ink, with a grain baked
   into the background so a flat screen reads as printed stock. Overriding the theme TOKENS
   here recolours everything inside — prose text, headings, links, rules — in one place, and
   the base page keeps its own, so closing the reader restores the previous colours by
   itself. They must be the real --c-* tokens: anything else leaves the body text following
   the site theme, and dark mode then shows white ink on white paper. */
.book-overlay{position:fixed;inset:0;z-index:60;width:100%;max-width:100%;height:100%;
  max-height:100%;border:0;padding:0;grid-template-rows:auto 1fr;
  /* The overlay is the READING face throughout, chrome included: the running head is the
     article's own title. Tracking has to be stated for the same reason the family does, or
     it inherits the mono-chrome correction from body and sets a book serif at -0.05em.
     Measured 2026-07-29: the running head was running -0.7px per character. */
  font-family:var(--font-reading);letter-spacing:var(--ls-body);
  /* The stock was recut 2026-08-21, to read as classic rather than aged. What read as AGE was two things: a paper pulled hard toward yellow
     (#f9f4ec) and a grain printed at 0.62 opacity, together doing an impression of foxed
     stock. The paper is now a quiet warm ivory and the grain drops to a texture you feel
     more than see; the drop cap, the asterism and the spine — the CLASSIC half — stay. */
  --book-paper:#faf8f3;--c-bg:var(--book-paper);
  /* Reading text runs 5% larger in here — it MULTIPLIES the owner's --fs-* roles, so it
     tracks the site's own type setting rather than replacing it. Was 1.15 from 2026-07-29
     until it was revised on 2026-08-21 as slightly too large by default. 1.05 keeps
     the reader a touch more generous than the article without the large-print feel, and
     the A−/A+ control in the chrome (book.ts) now lets each reader move it themselves —
     that override rides as an inline style, so this remains only the default. */
  --type-scale:1.05;
  /* --c-meta measured 3.30:1 at #8d8676 on the OLD paper, which fails AA, and it is the
     running head and the page count: the two things a reader checks WITHOUT stopping to
     read. #6f6a5c re-measured 2026-08-21 on the new stock: 5.08:1, and still reads as
     pencil beside the ink. */
  --c-text:#211f1a;--c-heading:#16130d;--c-meta:#6f6a5c;--c-link:#2f2c25;
  --c-accent:#2f2c25;--c-rule:#e2ddd2;color:var(--c-text);
  background-color:var(--book-paper);background-blend-mode:multiply;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.24'/%3E%3C/svg%3E")}
.book-overlay::backdrop{background:#faf8f3}
.book-chrome{position:relative;display:flex;align-items:center;justify-content:center;
  min-height:56px;padding:0 clamp(16px,4vw,48px)}
.book-top{border-bottom:1px solid var(--c-rule)}
.book-title{font-size:var(--fs-small);line-height:var(--lh-small);
  letter-spacing:var(--ls-small);font-weight:400;color:var(--c-meta);text-align:center;
  /* The page count, the size buttons and the close button sit in an absolutely positioned
     box on the right, so they take part in no layout and a centred title runs straight
     under them. On a phone the running head printed over the counter: "owning your ow1 / 5".
     THE RESERVATION IS TWICE THE BOX, and getting that wrong is how the title landed on top
     of A− again on 2026-08-27: the head is CENTRED, so half of whatever width it is allowed
     grows to the right of the middle. Reserving the box once leaves the right half of a wide
     title free to run under it. The box is ~208px plus its clamp(12px,4vw,44px) offset and a
     gap, so 540 = 2 x 270. Only bites on a narrow screen. */
  max-width:min(70%,calc(100% - 540px),720px);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* Three THINGS, not four glyphs: the size control, the page count, the way out. The gaps
   say so — the pair is one box, the count sits at arm's length from it, and the close
   button is further still. Before this they were four items 16px apart in one weight and
   one colour, which reads as a string of characters ("A− A+ 1/3 ✕") rather than as
   controls, and that is exactly what the owner reported on 2026-08-27. */
.book-topright{position:absolute;right:clamp(12px,4vw,44px);top:0;height:100%;
  display:flex;align-items:center;gap:18px}
/* On a phone the reserved right box leaves the running head ~75px — three letters and an
   ellipsis pressed against A−. A chrome that can only stammer the title is better off
   silent: the reader opened this article seconds ago and the page count keeps the row. */
@media (max-width:519px){.book-title{display:none}}
/* The way out, and it should look like a button rather than another character in the row:
   a round target the pointer can find, which fills faintly under the hand. 34px is the
   smallest circle that still swallows a fingertip on the tablet this mode is really for. */
/* Further out than the gap between the pair and the count: leaving is not the third item
   in a set of reading controls, and the extra 8px is the whole difference between reading
   the row as "size, page, close" and as three equal buttons. */
.book-x{margin-left:8px;
  background:none;border:0;cursor:pointer;color:var(--c-meta);font-size:1rem;
  line-height:1;width:34px;height:34px;padding:0;border-radius:999px;
  display:flex;align-items:center;justify-content:center;
  transition:background-color .12s ease,color .12s ease}
.book-x:hover{color:var(--c-heading);background:color-mix(in srgb,var(--c-rule) 55%,transparent)}
@media (prefers-reduced-motion:reduce){.book-x{transition:none}}
/* The reader's own hand on the type: a small a and a large A, plain glyphs on the paper.
   The pill-with-a-rule cut before this one drew a segmented control, and the owner read
   it as exactly that — buttons, with a dark seam between them on first paint. The size
   difference IS the label, so nothing else is drawn.
   The two font sizes would misalign under flex centering, and an earlier cut shipped that
   — so both glyphs sit on the SAME baseline instead: line-height 1,
   both buttons bottom-aligned with one shared padding, and neither glyph has a descender,
   which makes the bottoms the baseline. */
.book-sizes{display:flex;align-items:flex-end}
.book-size{background:none;border:0;cursor:pointer;color:var(--c-meta);line-height:1;
  font-family:var(--font-reading);height:34px;min-width:32px;padding:0 7px 9px;
  display:flex;align-items:flex-end;justify-content:center;
  transition:color .12s ease}
.book-smaller{font-size:.8em}
.book-larger{font-size:1.2em}
.book-size:hover:not([disabled]){color:var(--c-heading)}
.book-size[disabled]{opacity:.4;cursor:default}
@media (prefers-reduced-motion:reduce){.book-size{transition:none}}
.book-count{font-size:var(--fs-caption);line-height:var(--lh-caption);
  letter-spacing:var(--ls-caption);color:var(--c-meta);font-variant-numeric:tabular-nums}
/* Holds the dialog's initial focus (see book.ts) — a reading surface, not a control,
   so it never wears a ring. */
.book-stage{position:relative;display:flex;align-items:center;justify-content:center;
  min-height:0;padding:clamp(20px,4vh,52px) 0;outline:none}
/* The reading area just CLIPS the flowing columns: no sheet, no shadow, so the one paper
   background and its grain show through everywhere. */
/* A flex:1 here silently beat the measured width — a flex item with a basis of 0 and
   grow 1 fills the stage no matter what the inline style says, so the spread ran the
   full viewport and the two facing pages became four. */
/* The crossfade between spreads: dim, jump, come back. Without it the turn is a hard cut,
   which is what "not smooth any more" meant. 200ms, matching the frozen tree, and the
   motion switch above zeroes it like everything else. */
.book-viewport{position:relative;height:100%;flex:0 0 auto;max-width:100%;overflow:hidden;
  padding:clamp(4px,2vh,24px) 0;transition:opacity var(--dur-fast) ease}
.book-flow{height:100%;column-gap:56px;column-width:var(--book-col-w,340px);column-fill:auto;
  max-width:none;
  /* Oldstyle figures and discretionary ligatures. Both were missing from every subset
     until scripts/ops/subset-fonts.py put them back, so this had never rendered. */
  font-feature-settings:"onum" 1,"liga" 1,"dlig" 1}
/* Media stays column-width and never taller than a page, so nothing overflows the spread. */
.book-flow :is(img,video,iframe,pre,table,blockquote,figure){break-inside:avoid}
.book-flow :is(img,video,iframe){max-width:100%;max-height:var(--book-page-h,70vh);object-fit:contain}
.book-flow pre{max-height:var(--book-page-h,70vh);overflow:auto}
/* A "wide" image has NO effect in here: it renders at column width like any other figure,
   so it can never spill into the next page. This overrides the desktop gutter-widening the
   rail geometry injects, which otherwise leaks in because the flow is also .prose. */
.book-flow.prose figure.img-wide,.book-flow.prose .video-wide{
  width:100%;max-width:100%;margin-left:auto;margin-right:auto}
/* The first column opens flush with the top of the page. */
.book-flow.prose > :first-child{margin-top:0}
/* Drop cap: the first paragraph opens with a large raised initial spanning about three
   lines, which is the classic chapter opening. The line beside it is not also indented. */
.book-flow.prose > p:first-child::first-letter{float:left;margin:.02em .09em 0 0;
  font-size:3.1em;line-height:.72;font-weight:600;color:var(--c-heading)}
.book-flow.prose > p:first-child{text-indent:0}
/* In the reader the same break becomes an asterism: more room, so the ornament can be a
   real one. The width and the top border are reset explicitly because the article's short
   rule is the more specific selector and would otherwise draw a line under the mark. */
.book-flow hr,.book-flow hr:not(.fn-rule){border:0;border-top:0;width:auto;height:auto;
  margin:1.5em 0;text-align:center;background:none}
.book-flow hr::before{content:"⁂";color:var(--c-meta);font-size:1.05em;letter-spacing:.35em}
/* A faint spine down the centre gutter. It sits on the viewport, so it stays put while the
   pages flip beneath it. */
.book-viewport::after{content:"";position:absolute;top:7%;bottom:7%;left:50%;width:1px;
  background:var(--c-rule);opacity:.7;pointer-events:none}
/* One page, so there is no gutter for a spine to sit in. */
.book-viewport[data-pages="1"]::after{display:none}
.book-arrow{position:absolute;top:50%;transform:translateY(-50%);z-index:2;background:none;
  border:0;cursor:pointer;color:var(--c-meta);font-size:2rem;line-height:1;padding:12px 16px}
.book-arrow:hover{color:var(--c-heading)}
.book-prev{left:clamp(4px,2vw,28px)}
.book-next{right:clamp(4px,2vw,28px)}
/* Under 640px the arrows retire: they are hover furniture sized for a mouse, and they sat
   on top of a margin the phone no longer spares. The page turns by swipe or by a tap in
   the outer thirds (book.ts) — the e-reader gestures a thumb already knows. */
@media (max-width:639px){.book-arrow{display:none}}

/* Comments and sign-up. The FORM is server-rendered markup, so these rules apply with or
   without JavaScript; the comment thread is built by the island, so its rules only ever
   match once the script has run. */
/* Grid view. The attribute is set by the island; with no script the list stays a list,
   which is the shape every reader gets by default anyway. */
[data-list="grid"] .post-list{display:grid;gap:1.5rem;grid-template-columns:repeat(auto-fill,minmax(15rem,1fr))}
[data-list="grid"] .post-list > article{margin:0}
[data-list="grid"] .post-list h2{font-size:var(--fs-h3);line-height:var(--lh-h3);
  letter-spacing:var(--ls-h3)}
[data-list="grid"] .post-list .t-body{display:none}
.listing-sentinel{height:1px}

/* Cards ease in as they enter the viewport, in CSS. The frozen tree shipped an
   IntersectionObserver fallback for engines without scroll-driven animations; 04-frontend.md
   called for deleting it, and this is that deletion. An engine without support simply shows
   the cards, which is the correct end state anyway. Motion is skipped entirely when the
   reader has asked for less of it. */
@supports (animation-timeline:view()){
  @media (prefers-reduced-motion:no-preference){
    .post-list > article{animation:card-in linear both;animation-timeline:view();animation-range:entry 0% entry 40%}
  }
}
@keyframes card-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}

.site-bar{display:flex;align-items:center;justify-content:space-between;gap:1rem}
/* -0.625rem optically aligns the LAST icon's glyph with the column's right margin: the
   40px button centres a 20px glyph, so the glyph sits 10px inside the button edge. Pulling
   the row right by that 10px lands it flush, matching the logo's flush-left edge. */
.site-actions{display:flex;align-items:center;gap:.125rem;flex-shrink:0;margin-right:-.625rem}
/* The owner's menu, in the same cluster as the controls, from 60rem up (narrower than that
   the row is a title and five controls already). The .5rem past the bar's own 1rem gap holds
   the first control further off than the next link, so it is not read as one of them. */
.site-menu{display:none}
@media (min-width:60rem){
  .site-menu{display:flex;align-items:center;gap:1.25rem;margin-left:auto;min-width:0;padding-right:.5rem}
  .site-menu a{color:var(--c-meta);text-decoration:none;white-space:nowrap}.site-menu a:hover{color:var(--c-heading)}
}
.icon-btn{display:flex;align-items:center;justify-content:center;width:2.5rem;height:2.5rem;
  border:0;border-radius:var(--radius,.5rem);background:none;color:var(--c-meta);cursor:pointer;text-decoration:none}
.icon-btn:hover{color:var(--c-heading);background:var(--c-rule)}
/* The short token beside each icon. Absent unless the IDE chrome is on: with the switch
   off this header is exactly the header it has always been. */
.btn-token{display:none;font-size:var(--fs-caption);line-height:var(--lh-caption);
  letter-spacing:var(--ls-caption)}

/* The overlays. Both are dialogs, so Escape and the inert background are the browser's. */
.overlay[open]{display:flex}
.overlay{flex-direction:column;border:1px solid var(--c-rule);border-radius:var(--radius,.5rem);padding:1.25rem;
  width:min(36rem,92vw);max-height:70vh;background:var(--c-bg);color:var(--c-text);margin-top:8vh}
.overlay::backdrop{background:rgba(0,0,0,.4)}
.search-close{position:absolute;top:.5rem;right:.5rem;border:0;background:none;color:var(--c-meta);
  font-size:1.25rem;line-height:1;cursor:pointer}
.search-input{padding:.6rem .75rem;border:1px solid var(--c-rule);border-radius:var(--radius,.5rem);
  background:var(--c-bg);color:var(--c-text);font:inherit;margin-right:2rem}
.search-results{list-style:none;padding:0;margin:1rem 0 0;overflow-y:auto}
.search-results li{margin:0 0 .6rem}
.search-results a{color:var(--c-heading);text-decoration:none}
.search-results a:hover{text-decoration:underline}


/* The thread runs at --fs-small throughout, which is the frozen tree's setting and the
   reason it holds: this is a conversation ABOUT the article, one step below it, and a
   comment set at the same size as the body reads as a continuation of the piece. The
   heading is h3, not h2 — h2 belongs to the reader's own subheadings inside the article,
   and a louder comments heading than any heading in the writing is the wrong emphasis.
   The port had it at h2. */
#comments{border-top:1px solid var(--c-rule);margin-top:3rem;padding-top:1.5rem;
  font-size:var(--fs-small);line-height:var(--lh-small);letter-spacing:var(--ls-small)}
#comments h2{font-size:var(--fs-h3);line-height:var(--lh-h3);letter-spacing:var(--ls-h3);
  color:var(--c-heading);font-weight:var(--fw-heading,600);margin:0 0 1.5rem}
.comment-list,.comment-replies{list-style:none;padding:0;margin:0}
/* Structure from a rule between top-level comments, not from margins alone. A thread with
   only whitespace between entries reads as one long block, and the reply indent was too
   shallow to say which entry a reply belonged to. */
.comment{margin:0}
.comment-list>.comment+.comment{border-top:1px solid var(--c-rule);margin-top:1.5rem;padding-top:1.5rem}
.comment-replies{margin:1.25rem 0 0;padding-left:1.25rem;border-left:1px solid var(--c-rule)}
.comment-replies .comment+.comment{margin-top:1.25rem}
.comment-meta{color:var(--c-meta);margin:0 0 .5rem}
.comment-name{color:var(--c-heading);font-weight:var(--fw-heading,600)}
/* A comment is somebody's WORDS, so it is set in the reading face like the article is —
   the frozen tree did this and the port dropped it, which left every comment in the chrome
   font. On this site that is JetBrains Mono, so the thread was rendering as monospace.

   And at the ARTICLE's size, not the thread's. The #comments section runs at --fs-small
   because it is chrome, and the body inherited that: the same face as the piece, two steps
   smaller
   than the piece, which reads as a caption rather than as somebody talking. The rest of the
   thread — the meta line, the reply link, the whole form — stays small. Only the words grow.
   Tracking and leading come with the size, or the line spacing stays tuned for a smaller
   face and the paragraph sets too tight. */
.comment-body{font-family:var(--font-reading);font-size:var(--fs-body);
  line-height:var(--lh-body);letter-spacing:var(--ls-body);color:var(--c-text)}
.comment-body p:last-child{margin-bottom:0}
.comment-reply{border:0;background:none;padding:0;margin-top:.5rem;color:var(--c-meta);
  font:inherit;cursor:pointer;text-decoration:underline}
.comment-reply:hover{color:var(--c-heading)}
/* The empty state is meta, not body: "no comments yet" is the absence of a conversation,
   and setting it at reading size made it the loudest thing under the article. */
#comments .empty{color:var(--c-meta);margin:0}
/* The form is a CARD, on the same terms as the newsletter block sitting directly above it
   on every post: same border, same radius, same padding. Before this it was the only thing
   on the page with no boundary at all — a Google button, three fields, a textarea, a
   Turnstile widget and a submit, each floating separately on the page background. That is
   what made the section read as belonging to some other site. */
.comment-form{margin-top:2rem;border:1px solid var(--c-rule);border-radius:var(--radius,.5rem);padding:1.25rem}
/* A reply form opens INSIDE the thread, where a second bordered card boxes a box. */
.comment .comment-form{margin-top:.75rem;padding:0;border:0}
/* Name and email are short. Full width each, they turned a three-field form into a column
   of wide empty boxes; side by side they read as one block of details. */
.comment-fields{display:grid;grid-template-columns:1fr 1fr;gap:1rem}
.comment-fields .comment-field:last-child{grid-column:1/-1}
@media (max-width:639px){.comment-fields{grid-template-columns:1fr}}
.comment-field{margin:0}
.comment-field label{display:block;color:var(--c-meta);margin-bottom:.375rem}
.comment-body-field{margin-top:1rem}
.comment-form input,.comment-form textarea{width:100%;padding:.5rem .75rem;border:1px solid var(--c-rule);
  border-radius:var(--radius,.5rem);background:var(--c-bg);color:var(--c-text);font:inherit}
/* The focus treatment the newsletter field already had, applied to the same-looking field. */
.comment-form input:focus,.comment-form textarea:focus{border-color:var(--c-heading)}
.comment-form textarea{display:block;resize:vertical}
/* Verification and the action share one line, the submit pushed to the far end. It wraps
   below 640px because the Turnstile widget is a fixed 300px and will not share the row. */
.comment-actions{display:flex;flex-wrap:wrap;align-items:center;gap:.75rem;margin-top:1rem}
.comment-form .comment-actions button{margin:0 0 0 auto}
@media (max-width:639px){.comment-form .comment-actions button{margin-left:0}}
.comment-form button{padding:.5rem 1rem;border:1px solid var(--c-rule);border-radius:var(--radius,.5rem);
  background:var(--c-bg);color:var(--c-heading);font:inherit;font-weight:500;cursor:pointer}
.comment-form button:hover{background:var(--c-rule)}
.comment-status:empty{display:none}
.comment-status{color:var(--c-meta);margin:.75rem 0 0}
/* The identity strip. The sign-in control is an anchor and the sign-out control a button,
   so both are given the surrounding type explicitly rather than a UA default. */
/* Ruled off from the fields below it, so the two ways in read as a choice rather than as a
   button that happens to sit above a form. */
.comment-identity{margin:0 0 1rem;padding-bottom:1rem;border-bottom:1px solid var(--c-rule);
  color:var(--c-meta)}
.comment-identity strong{color:var(--c-heading);font-weight:var(--fw-heading,600)}
.comment-google{display:inline-block;padding:.5rem 1rem;border:1px solid var(--c-rule);
  border-radius:var(--radius,.5rem);color:var(--c-heading);font:inherit;text-decoration:none}
.comment-google:hover{border-color:var(--c-heading)}
/* Two classes deep on purpose: the comment-form button rule above is more specific than a
   lone class, so a one-class rule here loses and sign-out renders as a second Post button. */
.comment-form .comment-signout{margin:0;border:0;background:none;padding:0;
  color:var(--c-meta);font:inherit;cursor:pointer;text-decoration:underline}
.comment-form .comment-signout:hover{color:var(--c-heading)}
`.trim()
