// The public stylesheet, hand-written (ADR 0008: no Tailwind on the public site).
//
// It is a string rather than a `.css` file because it is ASSEMBLED — hand-written in pieces
// that compose in a deliberate order (see the bottom of this file), minified once and served
// from one hashed, immutable path by `assets.ts`. It was inlined into every page until
// 2026-07-30, when measuring three articles showed 41 KB of gzipped CSS re-sent for one
// page's worth of information; the static half moved to a cached file and only the
// settings-derived half stays inline. Re-measured 2026-08-28 on a throttled phone, in case
// the round trip had become the worse half again: it has not. Linked is 616 ms to first
// paint and inlining the whole sheet back into the HTML is 660 ms, because the preload
// scanner starts the sheet while the HTML is still streaming, so the request is free while
// the extra 45 KB in the document is not.
//
// Writing it by hand is what keeps it small enough for either answer to be on the table: a
// utility framework's output cannot be inlined without shipping the parts this site does
// not use.
//
// Every colour comes from a theme token (`--c-*`, set by `themesToCss`) and every size
// from a type role (`--fs-*`, set by `typographyToCss`). No hardcoded hex, no hardcoded
// px sizes: that rule survives from the frozen tree's conventions and is what keeps the
// palette switcher and the typography settings actually wired to something.


import { RAIL_CSS } from '@/web/rail.css'
import { ISLANDS_CSS } from '@/web/islands.css'
import { BOOK_CSS } from '@/web/book.css'
import { SUBSCRIBE_CSS } from '@/web/subscribe.css'
import { IDE_CSS } from '@/web/ide.css'
import { MOBILE_CSS } from '@/web/mobile.css'
import { PROSE_CSS } from '@/web/prose.css'
import { FRONT_CSS } from '@/web/front.css'
import { UTILITY_CSS } from '@/web/utility.css'
import { FIGURE_CSS } from '@/web/figure.css'
import { PRINT_CSS } from '@/web/print.css'

const BASE_CSS = `
/* MOTION TOKENS. Three durations, and no easing token. docs/conventions/motion.md promised these
   since the frozen tree and 2.0 had none, so every duration in islands.css.ts was a literal.
   Counted before deciding: twelve motion declarations across three files, and FOUR values for
   three intents — .13s and .15s are the same idea written twice, which is exactly the drift a
   token set exists to stop. So the tiers are named and .13s becomes .15s.

   --ease is DELIBERATELY not here. Its value would have been the keyword ease, which is
   indirection with no payload; and the three scroll-driven animations must stay linear, since
   easing a timeline a reader is scrubbing with their thumb is wrong rather than slower.
   Introduce one when a real curve is chosen, not to complete a set.

   Static, so they live in the immutable sheet rather than the per-page inline half: they are
   not derived from any setting. data-motion=off and prefers-reduced-motion still switch all of
   it off in one rule each, at the foot of islands.css.ts. NOTE the sign-in page does not get
   this sheet — see the comment in login.css.ts. */
:root{--dur-fast:.15s;--dur-base:.2s;--dur-slow:.5s}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
/* The hidden ATTRIBUTE means hidden, and it takes an !important to say so.
   Its own rule is a UA default of display:none, which any class setting a display value
   outranks - so setting .hidden = true in script on anything carrying .icon-btn
   (display:flex) did nothing at all. That shipped: the grid toggle hides itself on a page
   with no list, and it was visible on every article, every /search and every 404 on the
   demo, aria-pressed and all. This is the SECOND time the bug was found; the first was
   patched as .theme-menu[hidden] in islands.css, one component at a time. A general rule
   is the only version that covers the component nobody has written yet. */
[hidden]{display:none!important}
/* TWO font handles, and which one is the DEFAULT matters more than it looks. --font-sans
   is the system chrome face: header, footer, rail, dates, reading times, everything that
   is not the reader's own words. --font-reading is the reader's words, and it is opted
   INTO by .prose and .reading-font. This said --font-reading, so the whole site rendered
   in the article face and the owner's chrome font was never seen anywhere. */
body{
  margin:0;background:var(--c-bg);color:var(--c-text);
  font-family:var(--font-sans);font-size:var(--fs-body);line-height:var(--lh-body);
  letter-spacing:var(--ls-body);font-optical-sizing:auto;
}
/* Block margins to zero, and let the components state their own spacing.
   The frozen tree got this from Tailwind's preflight and its layout is built on top of it:
   the listing card sets .mt-2 / .mt-3 and expects nothing from the browser. Without the
   reset the card's first paragraph carried a 1em default margin, it collapsed out through
   the card, and the whole feed sat 14px lower than the rail beside it - which is the
   three-columns-not-level the owner spotted. Rhythm INSIDE the body copy is restored by
   .prose > * + * in prose.css.ts, exactly as the frozen tree restores it. */
h1,h2,h3,h4,h5,h6,p,figure,blockquote,ol,ul,dl,dd,pre{margin:0}
/* The SECOND thing the frozen tree got free from Tailwind's preflight, and the second one
   to go missing. A form control does not inherit its font: left alone, every button on the
   site paints in the browser's UI face at the browser's size, not in the owner's typeface
   at a --fs- token. Measured before this rule existed: "Sao chép" on every code block and
   "Lên đầu trang" on every article rendered in Arial at 12px/normal, and the theme and menu
   buttons at 13.33px/normal - four controls on a site whose own rule is one typeface and no
   hardcoded sizes. The shorthand is deliberate: font:inherit carries line-height too, which
   font-family alone would leave at the UA's "normal". */
button,input,select,textarea,optgroup{font:inherit;color:inherit;letter-spacing:inherit}
img,video,iframe{max-width:100%;height:auto}
a{color:var(--c-link);text-decoration:underline;text-underline-offset:.15em}
a:hover{color:var(--c-heading)}
/* ONE focus signature for the whole public site, the ring the sign-in page already used.
   Everything out here relied on the browser default, except the sign-up field, which
   replaced the outline with a 1px border-colour change: on a dark theme that is invisible,
   so a reader navigating by keyboard lost the cursor entirely. :focus-visible, not :focus,
   so a mouse click does not draw it. */
:focus-visible{outline:2px solid var(--c-accent);outline-offset:2px}
hr{border:0;border-top:1px solid var(--c-rule);margin:2.5rem 0}

/* WHAT A SELECTION LOOKS LIKE. Owner's call, 2026-08-24: black on a light page, grey on a
   dark one, in place of the browser's blue.
   The blue is the one colour on the whole reading page that came from nowhere: this site
   sets its palette down to the hairline and then hands the most physical gesture a reader
   makes — dragging across a sentence — to the operating system's accent. Ink on paper is
   what the rest of the page already is, and inverted it reads like a marker.
   Dark mode takes --c-meta rather than --c-heading on purpose: heading is near-white in
   every dark palette, and a white block over dark text is a flashbulb in the middle of a
   paragraph. The mid-grey reads as a mark; the text on it stays the page's own ground.
   Three selectors and not one, for the same reason content/themes.ts writes three: the
   island sets .dark and data-scheme, and before it runs, a reader whose SYSTEM is dark
   is on the dark palette with neither attribute set. Without the media query that reader
   gets a black block on a black page for one paint, which is a selection they cannot see. */
::selection{background:var(--c-heading);color:var(--c-bg)}
html.dark ::selection{background:var(--c-meta);color:var(--c-bg)}
@media (prefers-color-scheme:dark){
  html:not([data-scheme]) ::selection{background:var(--c-meta);color:var(--c-bg)}
}

/* The column width is --shell-w, not a constant: the layout sets it from the owner's
   contentWidth and a two-rail listing overrides it with something narrower. It read
   --content-width, which nothing ever set, so every page has been 42rem wide regardless
   of the setting.

   The 2rem gutter is the same at EVERY width, which the frozen tree's markup does not
   admit: it says "px-8 sm:px-5", but no .sm\\:px-5 rule was ever compiled into its
   stylesheet, so 2rem is what actually shipped. Measured off the rendered page, not read
   off the class list — the two disagreed by 24px of column, which is one word per line. */
/* dvh after vh, not instead of it: iOS counts the URL bar inside 100vh, so a full-height
   shell overshoots the visible page by the height of the bar and the footer sits under it.
   The vh line stays as the fallback for an engine that does not know dvh. */
.wrap{max-width:var(--shell-w,42rem);margin:0 auto;padding:0 2rem;
  display:flex;min-height:100vh;min-height:100dvh;flex-direction:column}
/* The rail is absolutely placed against THIS box, not the page, so it never displaces the
   reading column and the column stays centred exactly as it does with no rail at all. It
   wraps the content and not the header, which is what puts the rail's first line level
   with the article's first line. */
.with-rail{position:relative;display:flex;flex:1;flex-direction:column}
main{flex:1;padding:3rem 0 1rem}

/* Off-screen until it takes focus, then a real control at the top left of the page. Moved
   rather than sized to nothing: a zero-size element is skipped by some screen readers, and
   display:none would take it out of the tab order entirely, which is the one thing it must
   never be. */
.skip-link{position:absolute;left:-9999px;top:0;z-index:60}
.skip-link:focus{left:.5rem;top:.5rem;padding:.5rem .75rem;background:var(--c-bg);
  border:1px solid var(--c-rule);border-radius:.5rem;color:var(--c-heading);
  text-decoration:none}

header.site{padding:1.75rem 0}
header.site .title{font-family:var(--font-sans);font-weight:600;color:var(--c-heading);
  text-decoration:none;font-size:var(--fs-h4);line-height:var(--lh-h4);
  letter-spacing:var(--ls-h4)}
/* width+height on the tag reserve the space, so the header does not jump when the logo
   arrives; the CSS width keeps it responsive and height:auto keeps the ratio. */
header.site .logo{display:block;height:auto}
/* When the owner has uploaded a dark twin both are in the markup and exactly one shows.
   The :has() test keeps the light one visible on a site with no dark logo, where
   .logo-dark is simply absent.

   :not(.logo-dark) is load-bearing. The dark twin is class="logo logo-dark", so without it
   the hide rule matched BOTH marks - and at (0,6,2) against the show rule's (0,3,2) it won,
   so a site with a dark logo had no logo at all in dark mode. It shipped that way because no
   instance had ever set one: found on the first live site that did. */
header.site .logo-dark{display:none}
html.dark header.site .title:has(.logo-dark) .logo:not(.logo-dark){display:none}
html.dark header.site .logo-dark{display:block}
/* Tight to the wordmark: the two are one lockup, and at .75rem the tagline floated far
   enough to read as a separate element ("slogan với logo xa quá"). */
header.site .tagline{color:var(--c-meta);font-size:var(--fs-small);
  line-height:var(--lh-small);letter-spacing:var(--ls-small);margin:.35rem 0 0}

/* The reading face for .prose is in prose.css.ts, with the rest of the .prose rules, so the
   editor gets it too. There is deliberately no "article h1" rule: an article IS also the
   listing card, and a bare element selector here silently restyled every card title. Sizes
   come from the type-role classes. */
article > header h1{color:var(--c-heading);margin:0}
article > header .t-small{margin:0}
/* Standfirst: the excerpt, so a long read opens on a sentence rather than a wall.
   It is the AUTHOR'S words — the same string a list card prints — so it is set in the
   reading face. It was not: with no family of its own it fell to --font-sans, so the same
   excerpt rendered in Literata on the home page and in JetBrains Mono under the title of
   the post it belongs to. A book serif headline with a terminal subtitle under it, and the
   one seam on the page where the two faces touch. Same class as the comment body, which
   lost its reading face in the port for the same reason. */
.deck{margin:1rem 0 0;color:var(--c-meta);font-family:var(--font-reading);
  font-size:var(--fs-h4);line-height:var(--lh-h4);letter-spacing:var(--ls-h4)}
#post-body{margin-top:2.5rem}
/* Tags and categories over a rule: the rule is where the article ends. Without it the
   taxonomy reads as one more paragraph. */
.post-taxo p{margin:0 0 .25rem}
/* The end-of-article anchors the contents list jumps to. Their own empty elements, because
   the taxonomy they used to sit on is hidden in the wide layout and an anchor with no box
   cannot be scrolled to. Zero height, so they cost the flow nothing at either width. */
.anchor{display:block;height:0;scroll-margin-top:6rem}
/* The right gutter of an article: the same facts as the meta line and the taxonomy, one per
   line, placed by singleRailCss above the rail breakpoint. Absent by default — below that
   breakpoint there is no gutter, and the in-flow originals are what the reader gets. */
.post-info{display:none}
.post-info p{margin:0}
.post-info p + p{margin-top:.35rem}
/* One even rhythm through the facts — the tags and categories used to be set apart and the
   owner asked for them level with the rest. The ACTION is the only thing set apart, because
   it is the one row that is not a fact: it does something. */
.post-info .info-action{margin-top:1.25rem;color:var(--c-heading);font-weight:500}
/* The VALUES are a step darker than the words around them, the same ink the contents list
   uses for the row you are on. The panel is the only place a desktop reader sees the date
   and the length, so it carries the whole hierarchy on its own. */
.post-info time,.post-info .num{color:var(--c-heading)}
/* End-of-article furniture, and it needs its own scale rather than the page's. The link had
   NO size rule at all, so a related title inherited the BODY size: the quietest thing on the
   page (a list of "you might also read") was set as large as the writing, and in the chrome
   face, which on a monospace setting is visibly wider again. h5 is the title role that sits
   below body. The whole block is now ONE size: at h5 the titles still read as headings under
   a chrome font that is monospace on this site, and the owner asked for them smaller again.
   So the label, the titles and the dates are all --fs-small and nothing here competes with
   the article; weight and colour do the separating, which is how a book sets its back
   matter. */
/* One pointer forward at the article's end. The label whispers like .related's heading;
   the title is the only thing at reading size, because the title is the offer. */
.read-next-label{font-size:var(--fs-small);line-height:var(--lh-small);
  letter-spacing:var(--ls-small);font-weight:600;color:var(--c-meta);margin:0 0 .5rem}
.read-next-title{margin:0;font-size:var(--fs-h3);line-height:var(--lh-h3);letter-spacing:var(--ls-h3)}
.read-next-title a{font-weight:600;color:var(--c-heading)}
.related{font-size:var(--fs-small);line-height:var(--lh-small);
  letter-spacing:var(--ls-small)}
/* The size is stated even though the block already sets it: an h2 carries a UA default of
   1.5em, so leaving it to inherit made the quiet label the largest thing in the block. */
.related h2{font-size:var(--fs-small);line-height:var(--lh-small);
  letter-spacing:var(--ls-small);font-weight:600;color:var(--c-meta);margin:0 0 1.25rem}
.related ul{list-style:none;padding:0;margin:0}
.related li + li{margin-top:1rem}
.related a{font-weight:600;color:var(--c-heading)}
.related p{margin:.125rem 0 0}
article + .subscribe-card,article + #comments{margin-top:2.5rem}

${PROSE_CSS}

/* An archive heading is chrome, not the reader's words: it stays in --font-sans and it is
   BOLD, where a post title is 600. Both come from the frozen tree's own markup. */
.listing-head{margin:0 0 2rem}
.listing-head h1{font-size:var(--fs-h1);line-height:var(--lh-h1);
  letter-spacing:var(--ls-h1);color:var(--c-heading);margin:0;font-weight:700}
.lower{text-transform:lowercase}
${UTILITY_CSS}

/* Cards are separated by SPACE, not by a rule. The border-bottom here was mine, not the
   frozen tree's, and it turned a quiet feed into a table. The gap has to be wide enough to
   read as a break rather than a paragraph space, which is what 4rem buys. */
.post-list{display:flex;flex-direction:column;gap:4rem}
.post-list > article > p:first-of-type{margin:0}
/* The timeline groups its cards by year, so the gap moves onto the cards themselves: the
   year marker is zero-height and sticky, and a flex gap would still reserve a row for it. */
.post-list.tl-feed{display:block}
.tl-feed .tl-yr article{margin-top:4rem}
.tl-feed > .tl-yr:first-child > article:first-of-type{margin-top:0}
[data-list=grid] .tl-yr{display:contents}
[data-list=grid] .tl-feed article{margin-top:0} /* the grid supplies its own gap */
/* A node ON the spine, not under it. The spine is .post-list::after, a pseudo-element of
   the LIST, so it paints after the list's children and drew straight over every month
   dot; and unlike the year tag the mark carried no background, so the hairline ran
   through the label too. Both fixed the way the year already solved it: a --c-bg mask
   that breaks the line, and a stacking order above it. */
.tl-mark{align-items:center;gap:.5rem;white-space:nowrap;color:var(--c-meta);
  background:var(--c-bg);padding:.1rem 3rem .1rem 0;z-index:1}
/* The sticky year is a --c-bg tag, so months sliding up to the top pass UNDER it and
   disappear instead of overlapping; the right padding widens the mask to cover the
   longest month label. */
.tl-year-tag{align-items:center;gap:.5rem;white-space:nowrap;color:var(--c-heading);
  font-weight:600;background:var(--c-bg);padding:.1rem 3rem .1rem 0;
  font-size:var(--fs-h3);line-height:var(--lh-h3);
  letter-spacing:var(--ls-h3)}
.tl-year-tag .tl-dot{background:var(--c-accent)}
.tl-dot{flex:0 0 auto;width:8px;height:8px;border-radius:50%;background:var(--c-meta)}
.empty{color:var(--c-meta)}
.pager{display:flex;justify-content:space-between;align-items:center;gap:1rem;
  border-top:1px solid var(--c-rule);padding-top:1rem;margin-top:1rem;
  font-size:var(--fs-small);line-height:var(--lh-small);letter-spacing:var(--ls-small)}
.pager-count{color:var(--c-meta)}
form.search{display:flex;gap:.5rem;margin:0 0 2rem}
/* min-width:0 is what stops this row leaving the viewport. An <input> carries an intrinsic
   width from its size attribute, a flex item will not shrink below its own min-content by
   default, so at 390px the pair measured wider than the column and the button's right
   border sat off-screen: the page scrolled sideways. form.subscribe already carried this
   rule; the search form was written from the same shape and lost it. */
form.search input{min-width:0;flex:1;padding:.5rem .75rem;border:1px solid var(--c-rule);
  border-radius:.5rem;background:var(--c-bg);color:var(--c-text);font:inherit}
/* nowrap because the label is what pushed the row wide: "Tìm kiếm" broke over two lines and
   took the whole control to 78px tall to make room for itself. */
form.search button{padding:.5rem 1rem;border:1px solid var(--c-rule);border-radius:.5rem;
  background:var(--c-bg);color:var(--c-heading);font:inherit;cursor:pointer;white-space:nowrap}
/* Stacked on a phone, exactly as the sign-up form stacks and at the same width. */
@media (max-width:639px){form.search{flex-direction:column}}
/* The series box: a bordered card at the TOP of the post, as the frozen tree had it. The
   port turned it into a plain rule at the foot of the article, which is the wrong end — the
   point of it is knowing you are in part 3 of 6 BEFORE reading, not after. */
aside.series{border:1px solid var(--c-rule);border-radius:.5rem;padding:1.25rem 1.5rem;
  margin:2rem 0 0;font-size:var(--fs-small);line-height:var(--lh-small);
  letter-spacing:var(--ls-small)}
aside.series .series-head{margin:0;color:var(--c-meta)}
aside.series ol{margin:1rem 0 0;padding-left:1.25rem}
aside.series li{margin-top:.5rem}
aside.series li a{color:var(--c-meta);text-decoration:none}
aside.series li a:hover{color:var(--c-heading)}
/* The part you are reading is not a link, and it is the one thing in the card set in the
   heading colour: the card answers "where am I" before it answers "what else is there". */
aside.series li[aria-current]{color:var(--c-heading);font-weight:600}
p.tags{margin-top:1.5rem;font-size:var(--fs-small);line-height:var(--lh-small);
  letter-spacing:var(--ls-small);color:var(--c-meta)}


.video-embed,.video-file{margin:calc(var(--sp) * 2) 0}
.video-embed{position:relative;padding-top:56.25%}
.video-embed iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.video-file video{width:100%;display:block}
.audio-embed iframe{width:100%;height:9.25rem;border:0}

.callout{border-left:2px solid var(--c-accent);
  padding:calc(var(--sp) * .75) 0 calc(var(--sp) * .75) var(--sp);
  margin:calc(var(--sp) * 1.75) 0}
.callout-label{font-weight:600;color:var(--c-heading);margin:0 0 calc(var(--sp) * .35)}
.callout p:last-child{margin-bottom:0}

/* applyFootnotes already emits an <hr class="fn-rule">; a border-top here as well
   drew TWO lines above the notes. Caught by opening the page, not by reading it. */
.prose .fn-rule{margin-top:2.5em}
.footnotes{font-size:var(--fs-small);line-height:var(--lh-small);
  letter-spacing:var(--ls-small);color:var(--c-meta)}
.footnotes ol{padding-left:calc(var(--sp) * 1.25)}
sup.fnref a{text-decoration:none}

footer.site{padding:3rem 0;text-align:center;color:var(--c-meta);
  font-size:var(--fs-small);line-height:var(--lh-small);letter-spacing:var(--ls-small)}
.footer-text{margin:0}
footer.site a{text-decoration:underline;text-underline-offset:2px}
footer.site a:hover{color:var(--c-text)}

/* Shiki emits a light colour inline and a --shiki-dark var; the dark palette swaps them.

   The TOKEN colours only. The background half of this rule used to ride along, painting
   #121212 from Shiki's dark theme over whatever palette the reader had chosen -- the same
   defect the light side had (see prose.css.ts), just less visible because a dark theme's
   grey sits closer to a dark palette's ground. The panel is --c-code-panel on both sides
   now, so all six palettes own their code block in both modes. */
.dark .shiki,.dark .shiki span{color:var(--shiki-dark)!important}
`.trim()

/**
 * The document sheet, the island sheet, the IDE chrome and the phone rules, in that order.
 *
 * The phone sheet is LAST because several of its rules win on a specificity tie alone: it
 * raises a floor on a control that already states its size, and undoes a hover-only opacity.
 *
 * ...except the PRINT sheet, which is after it for the same reason one step further: it has
 * to win against everything above, on paper, and it can only affect paper.
 */
export const PUBLIC_CSS = `${BASE_CSS}

${FIGURE_CSS}

${RAIL_CSS}
${ISLANDS_CSS}
${BOOK_CSS}
${SUBSCRIBE_CSS}
${FRONT_CSS}
${IDE_CSS}
${MOBILE_CSS}
${PRINT_CSS}`
