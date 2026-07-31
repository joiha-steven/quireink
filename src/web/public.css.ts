// The public stylesheet, hand-written (ADR 0008: no Tailwind on the public site).
//
// It is a string rather than a `.css` file because it is INLINED into every page, which
// removes a request from the critical path. That only stays a good idea while the sheet
// is small, which is the point of writing it by hand: a utility framework's output cannot
// be inlined without shipping the parts this site does not use.
//
// Every colour comes from a theme token (`--c-*`, set by `themesToCss`) and every size
// from a type role (`--fs-*`, set by `typographyToCss`). No hardcoded hex, no hardcoded
// px sizes: that rule survives from the frozen tree's conventions and is what keeps the
// palette switcher and the typography settings actually wired to something.


import { ISLANDS_CSS } from '@/web/islands.css'
import { IDE_CSS } from '@/web/ide.css'
import { MOBILE_CSS } from '@/web/mobile.css'
import { PROSE_CSS } from '@/web/prose.css'
import { FRONT_CSS } from '@/web/front.css'
import { UTILITY_CSS } from '@/web/utility.css'

const BASE_CSS = `
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
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
   .logo-dark is simply absent. */
header.site .logo-dark{display:none}
html.dark header.site .title:has(.logo-dark) .logo{display:none}
html.dark header.site .logo-dark{display:block}
header.site .tagline{color:var(--c-meta);font-size:var(--fs-small);
  line-height:var(--lh-small);letter-spacing:var(--ls-small);margin:.75rem 0 0}

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

figure{margin:calc(var(--sp) * 2) 0}
figure img{display:block;margin:0 auto;border-radius:.5rem}
figcaption{color:var(--c-meta);font-size:var(--fs-caption);line-height:var(--lh-caption);
  letter-spacing:var(--ls-caption);text-align:center;margin-top:calc(var(--sp) * .5)}
.img-left img{margin-left:0}
.img-right img{margin-right:0}
.img-wide{margin-left:calc(-1 * clamp(0px,4vw,4rem));margin-right:calc(-1 * clamp(0px,4vw,4rem))}
.gallery{display:grid;gap:calc(var(--sp) * .5);margin:calc(var(--sp) * 2) 0}
.gallery figure{margin:0}
.gallery-cols-2{grid-template-columns:repeat(2,1fr)}
.gallery-cols-3{grid-template-columns:repeat(3,1fr)}
.gallery-cols-4{grid-template-columns:repeat(4,1fr)}
/* Gallery shape and captions, as VARIABLES, so two places can set them without either
   knowing about the other: the site default on :root (pageStyles, from settings) and a
   per-gallery override on the tile, which wins on specificity. The var() fallbacks are what
   a gallery did before any of this existed, so an untouched site is unchanged.
   picture is inline, and an inline box is a poor containing block for a percentage width. */
.gallery picture{display:block}
.gallery figure img{aspect-ratio:var(--gallery-ratio,auto);width:var(--gallery-w,auto);object-fit:cover}
.gallery figcaption{display:var(--gallery-cap,block)}
/* Width rides with the ratio: a cropped tile fills its cell, an uncropped one must not. */
.gallery .g-asis{--gallery-ratio:auto;--gallery-w:auto}
.gallery .g-1x1{--gallery-ratio:1/1;--gallery-w:100%}
.gallery .g-3x2{--gallery-ratio:3/2;--gallery-w:100%}
.gallery .g-4x3{--gallery-ratio:4/3;--gallery-w:100%}
.gallery .g-cap{--gallery-cap:block}
.gallery .g-nocap{--gallery-cap:none}

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

/* Shiki emits a light colour inline and a --shiki-dark var; the dark palette swaps them. */
.dark .shiki,.dark .shiki span{color:var(--shiki-dark)!important;background-color:var(--shiki-dark-bg)!important}

/* THE RAIL: the listing sidebar and the post's table of contents, which are one piece of
   furniture wearing two sets of contents. All server-rendered, so these rules apply with
   or without JavaScript; only the aria-current highlight and the mobile drawer come from
   the bundle.

   BELOW the rail breakpoint it sits above the article, in normal flow, exactly as written
   here. ABOVE it, the rules generated by singleRailCss move it into the left gutter. The
   frozen tree also had a slide-out drawer and a toggle island for narrow screens; a list
   that simply sits above the article needs neither, so that island is not ported. */
:root{--rail-w:250px;--rail-gap:40px;
  /* Gap between a rail row's text and the accent marker beside it. */
  --rail-pad:14px;
  /* Space between the header and the first line of content. The rail's top matches it, so
     the rail's first line is level with the article's first line. */
  --rail-top:3rem}

/* Mobile FIRST: the rail is a slide-out drawer opened from the header menu button. The
   injected geometry promotes it into the gutter above the breakpoint. ONE piece of DOM
   serves both, which is why there is no second copy of the sidebar to keep in step. */
/* overflow-x is spelled out, and it is not decoration. A box with overflow-y:auto and no
   overflow-x computes overflow-x to auto as well, so the drawer became a horizontal
   scroller the moment anything inside it was a pixel too wide - which is how a gutter rule
   meant for the desktop rail taught every phone to pan the sidebar 32px sideways. */
.rail{position:fixed;top:0;bottom:0;left:0;z-index:40;width:min(300px,84vw);
  overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;padding:4.5rem 1.25rem 2rem;
  background:var(--c-bg);border-right:1px solid var(--c-rule);
  transform:translateX(-100%);transition:transform .25s ease}
html[data-rail=open] .rail{transform:none}
/* Two-rail listings only: on mobile there is no gutter, so the LEFT rail is hidden and its
   blocks appear in the right rail's drawer through .drawer-only. */
.rail-left{display:none}
/* Tap anywhere else to close. No dim: the drawer already owns a solid surface. */
.rail-scrim{position:fixed;inset:0;z-index:39}
.rail-inner{position:sticky;top:2.5rem}
.rail-inner > * + *,.drawer-only > * + *{margin-top:1.75rem}
.rail h2{margin:0 0 .75rem;padding-left:var(--rail-pad);font-weight:600;color:var(--c-heading);
  font-size:var(--fs-small);line-height:var(--lh-small);
  letter-spacing:var(--ls-small)}
.rail ul{list-style:none;margin:0;padding:0}
.rail li{margin-top:.5rem}
.rail li:first-child{margin-top:0}
.rail-row{position:relative;display:flex;justify-content:space-between;gap:.875rem;
  padding-left:var(--rail-pad);color:var(--c-meta)}
.rail-row:hover,.rail-tags a:hover{color:var(--c-heading)}
/* The one accent mark: a hairline beside the row you are already reading. In the drawer it
   sits left of the text; in the gutter the rail flips and it faces the divider. */
/* ::after, not ::before. A row can be BOTH aria-current and .rail-lead (the bullet) or
   .rail-sub (the IDE chrome's leading slash), and all of them wanted the SAME
   pseudo-element: the marker's empty content won, and the slash came out painted in the
   accent colour as a red diagonal at the row's right edge. Two marks, two elements. */
.rail-row[aria-current]::after{content:"";position:absolute;left:0;top:3px;bottom:3px;
  width:2px;background:var(--c-accent)}
/* Counts sit in their own right-aligned column so the labels stay aligned however many
   digits a count carries. The column is exactly as wide as the widest count on the page
   (--count-w, in ch, exact because the digits are tabular); a fixed em width would leave
   dead space on every single-digit row. */
.rail-count{min-width:var(--count-w,1ch);text-align:right;flex-shrink:0;
  font-variant-numeric:tabular-nums}
.rail-tags{display:flex;flex-wrap:wrap;column-gap:.75rem;row-gap:.25rem;padding-left:var(--rail-pad)}
.rail-tags a{color:var(--c-meta)}
/* Tags are many and short: a wrapped run of plain words, no chips, no boxes. */
.rail-tags.lower a{text-transform:lowercase}
/* The brackets are CSS, not markup, so the IDE chrome can swap them for square ones and
   switching it off puts them back. They used to be typed into the sidebar renderer, which
   is why the taxonomy read "(7)" while the list beside it read "[7]". */
/* No opacity. --c-meta is 4.56:1 against the page and passes AA with 0.06 to spare; at .6
   the count measured 2.26:1, which is a fail at any size. It only ever looked acceptable
   because the IDE chrome resets the opacity to 1, so the site the owner sees was never the
   one shipping the failure: switching that off produced unreadable counts. */
.term-count{margin-left:.25rem;font-variant-numeric:tabular-nums}
.term-count::before{content:"("}
.term-count::after{content:")"}
.rail-row.is-active,.rail-tags a.is-active{font-weight:500;color:var(--c-heading)}
.rail-tags a.is-active{text-decoration:underline;text-decoration-color:var(--c-accent);
  text-underline-offset:4px}
/* No panel: no border, no shadow, no background, just type sitting on the page. It had a
   left border and a padded box, which read as a widget parked beside the article.

   Nest visually ONLY when the post MIXES levels: an H2 row carries one bigger dot as a
   section marker and an H3 row simply goes smaller. So it reads as a few strong markers
   over quieter children rather than a column of identical bullets. The dot is an inline
   ::before, so it flows for BOTH rail orientations with no per-side handling. */
.rail-lead::before{content:"•";font-size:.72em;margin-inline-end:.5em;vertical-align:.12em;
  color:var(--c-meta)}
.rail-sub{font-size:var(--fs-caption);line-height:var(--lh-caption);
  letter-spacing:var(--ls-caption)}
.toc-end{margin-top:1rem}
/* Below the rail breakpoint the ToC is the drawer, and a post with a long index needs the
   whole column: the listing rail is not on this page to share it with. */
.toc li{margin-top:.5rem}
`.trim()

/**
 * The document sheet, the island sheet, the IDE chrome and the phone rules, in that order.
 *
 * The phone sheet is LAST because several of its rules win on a specificity tie alone: it
 * raises a floor on a control that already states its size, and undoes a hover-only opacity.
 */
export const PUBLIC_CSS = `${BASE_CSS}
${ISLANDS_CSS}
${FRONT_CSS}
${IDE_CSS}
${MOBILE_CSS}`
