import type { SiteLang } from '@/types'
import { t } from '@/i18n/i18n'
// The newspaper dialect (settings.look = 'paper'). Its own sheet, linked only when this
// look is on (`web/assets.ts`).
//
// This is the one dialect that TOUCHES THE READING COLUMN, and it does so on purpose: a
// paper numbers its sections, numbers its figures and its tables, and prints its byline
// under the headline rather than out in a margin. The source-code dialect's hard rule (never
// touch the column, `docs/conventions/looks.md`) exists because THAT look's argument is the
// contrast between a technical frame and an analogue text. This one's argument is that the
// whole page is a publication, so the rule does not carry over. What it still never does is
// change the reading face, the measure, or the words.
//
// NO BACKTICKS anywhere below: this is one template literal and a backtick ends it.
// `check:css-literal` enforces that, and this file is IN its list.

export const LOOK_PAPER_CSS = `
/* --- THE PAPER'S OWN INK ----------------------------------------------------
   THE ONE LOOK THAT BRINGS ITS OWN PALETTE, and the reason is that a newspaper is a
   MATERIAL: ink on newsprint, black and one grey and a rule. Inheriting whichever of the
   six palettes an owner happened to pick meant a paper printed in forest green, which is
   not a paper. Measured against the real thing on 2026-09-13: the New York Times sets its
   text at #121212, its secondary at #666 and its rules at about #dfdfdf, and carries no
   other colour on the front page at all.

   These are the same seven tokens every palette declares, so nothing downstream knows the
   difference — custom CSS, the pen, the tables and the reader's dark toggle all keep
   working off them. The reader's LIGHT/DARK choice still decides which half applies; it is
   the six HUES this look overrules, not the switch.

   A night edition rather than an inverted page: newsprint in the dark is not #000. */
html[data-look=paper]{--c-bg:#ffffff;--c-text:#121212;--c-heading:#121212;
  --c-meta:#666666;--c-rule:#dfdfdf;--c-link:#326891;--c-accent:#326891}
html[data-look=paper].dark{--c-bg:#121212;--c-text:#d8d8d8;--c-heading:#ffffff;
  --c-meta:#8b8b8b;--c-rule:#2c2c2c;--c-link:#7aa9d6;--c-accent:#7aa9d6}
@media (prefers-color-scheme:dark){
  html[data-look=paper]:not([data-scheme=light]){--c-bg:#121212;--c-text:#d8d8d8;
    --c-heading:#ffffff;--c-meta:#8b8b8b;--c-rule:#2c2c2c;--c-link:#7aa9d6;
    --c-accent:#7aa9d6}
}

/* --- THE HEADLINE FACE ------------------------------------------------------
   A SECOND SERIF, beside the one the words are set in, which is what a paper does: the
   Times sets headlines in Cheltenham and body in Imperial. Source Serif 4 is already in
   the tree as a reading preset, so a blog wearing this look downloads one more file and
   every other blog downloads nothing.

   AND AT REGULAR WEIGHT. Measured on the real front page: 400, leading 1.15, tracking
   +0.01em — not bold. The authority is in the face and the leading, and a bold serif at
   that size reads as a blog shouting rather than as a paper. The SIZES stay the owner's:
   this sets the two numbers a scale does not fix. */
html[data-look=paper] :is(h1,h2,h3,.fc-title,.read-next-title){
  font-family:'Source Serif 4','Source Serif 4 Fallback','Source Serif 4 Fallback 2',
    Georgia,'Times New Roman',serif;
  font-weight:400;line-height:1.15;letter-spacing:.01em}
html[data-look=paper] .post-list :is(h1,h2,h3){font-weight:400}
/* TWO SIZES THE SCALE CANNOT HOLD, and both are the same argument: a paper's masthead and
   a paper's headline are not headings in a document, they are the two things the page is
   recognised by across a room. Both are DERIVED from the owner's h1 rather than typed, so
   they still move with their scale. */
html[data-look=paper] article > header h1{font-size:calc(var(--fs-h1) * 1.3);
  line-height:1.1;letter-spacing:-.012em}
html[data-look=paper] .site-bar > .title{font-size:calc(var(--fs-h1) * 1.5);
  line-height:1.05;letter-spacing:-.02em}

/* --- LABELS ARE A GROTESQUE, SMALL, LETTERSPACED ----------------------------
   Every kicker, section head, byline and date on a paper is set in a sans at ten or eleven
   pixels with the letters opened up, and that single habit is most of what separates a
   newspaper from a website. Uppercase by TEXT-TRANSFORM, never by typing capitals: the feed,
   the search result and the screen reader all still receive the word as it was written. */
/* The shelf's own headings are labels, not headlines: "Contents" over a list of sections is
   the same kind of word as "Featured" over a row of cards. */
html[data-look=paper] :is(.front-label,.fc-cat,.read-next-label,.rail h2),
/* Its own rule, and that is not tidiness: :is() is a FORGIVING selector list, so a
   pseudo-element written inside it is dropped in silence and the rest of the list goes on
   working. The shelf's invented heading sat in that list for one build and was the only
   label on the page still in sentence case, with nothing anywhere saying why. */
html[data-look=paper] article .rail-inner > nav:not(.toc)::before{
  font-family:'Inter','Inter Fallback',system-ui,-apple-system,'Segoe UI',sans-serif;
  text-transform:uppercase;letter-spacing:.08em;font-weight:600}
html[data-look=paper] :is(.post-meta,.fc-meta,.t-small.text-meta,.post-taxo){
  font-family:'Inter','Inter Fallback',system-ui,-apple-system,'Segoe UI',sans-serif;
  letter-spacing:.02em}

/* --- THE CHROME IS SET IN THE READING FACE ----------------------------------
   A paper has no monospace on it anywhere, and this is the move that changes the most:
   rail, meta, panel and footer stop being a second voice. The file is on the page
   either way, so it costs nothing to load. On body, never on --font-sans: see the
   note in look-code.css.ts for what moving that variable does to the article. */
html[data-look=paper] body{font-family:var(--font-reading)}

/* --- THE MASTHEAD -----------------------------------------------------------
   A paper announces itself once, in the middle: the name, the strapline under it, then
   the sections, then a heavy rule closing the lot.

   'display:contents' on the bar is what makes that ORDER possible. The name, the section
   menu and the controls all live inside .site-bar while the strapline is its sibling, so
   no amount of alignment inside the bar can put the strapline between them. Dropping the
   bar's own box promotes its three children into the header's flex column, where 'order'
   can interleave them with the strapline.

   'margin-inline:0' on the name is load-bearing: in the bar's own flex ROW it carries
   'margin-right:auto' to push the controls to the far end, and once the bar's box is gone
   that auto margin ate 917px of the column and pinned the name to the left edge while the
   strapline under it sat centred.

   The controls come out of the flow entirely. On the composed front page the section menu
   is IN this bar, and absolutely positioning them was the only way to stop four icons
   being painted over the last word of it. */
html[data-look=paper] header.site{display:flex;flex-direction:column;align-items:center;
  position:relative;padding-bottom:.85rem;border-bottom:3px solid var(--c-heading)}
html[data-look=paper] .site-bar{display:contents}
html[data-look=paper] .site-bar > .title{order:1;margin-inline:0;
  font-family:var(--font-reading);font-size:var(--fs-h1);line-height:var(--lh-h1);
  letter-spacing:var(--ls-h1)}
html[data-look=paper] header.site .tagline{order:2;text-align:center;font-style:italic;
  margin-top:.35rem}
html[data-look=paper] .site-bar > .site-menu{order:3;display:flex;flex-wrap:wrap;
  justify-content:center;gap:.3rem 1.5rem;margin-top:.7rem;padding-top:.55rem;
  border-top:1px solid var(--c-rule);width:100%}
html[data-look=paper] .site-bar > .site-actions{position:absolute;top:0;right:0;margin:0}

/* --- THE PIECE'S OWN PAGE SHAPE ---------------------------------------------
   The facts about the piece leave the right-hand panel and go under the headline where a
   paper puts them, and the taxonomy returns to the foot. This is the half that makes it a
   different page rather than the same page with rules drawn on it. */
html[data-look=paper] .post-info{display:none}
html[data-look=paper] .post-meta{display:block;text-align:center;letter-spacing:.04em}
html[data-look=paper] .taxo-rule,html[data-look=paper] .post-taxo{display:block}
html[data-look=paper] .post-taxo{text-align:center}
html[data-look=paper] article > header{text-align:center;padding-bottom:.2rem}
html[data-look=paper] article > header h1{margin-top:.5rem;text-wrap:balance}
html[data-look=paper] article > header .mt-2{margin-top:.5rem}

/* THE STANDFIRST BECOMES AN ABSTRACT: ranged left inside a narrower measure, between two
   hairlines, a size down. No word is added anywhere in this sheet - the shape is the
   label - because a word would need eleven translations and a renderer to place it. */
html[data-look=paper] .deck{text-align:left;max-width:88%;margin:1.5rem auto 0;
  padding:.95rem 0;border-top:1px solid var(--c-rule);border-bottom:1px solid var(--c-rule);
  font-size:var(--fs-small);line-height:var(--lh-small);letter-spacing:var(--ls-small)}

/* --- SECTIONS ARE NUMBERED --------------------------------------------------
   A sub-heading is numbered WITHIN its section, so 2.1 says where it lives instead of
   where it falls in a flat run. counter-SET on the parent, never counter-reset: a reset
   scoped to the heading creates a new instance its siblings go on reading, which is the
   bug the contents index already shipped once (rail-css.test.ts holds it).

   THE NUMBERS ARE CSS, so they are on the page and nowhere else: not in the feed, not in
   the newsletter, not in a search result, and not in what a reader copies. Do not write
   prose that refers to "section 2.1"; the reader who follows that reference from anywhere
   but this page will not find a number there. */
html[data-look=paper] .prose{counter-reset:sec sub fig tbl}
html[data-look=paper] .prose h2{counter-increment:sec;counter-set:sub 0;
  border-bottom:1px solid var(--c-rule);padding-bottom:.3rem}
html[data-look=paper] .prose h3{counter-increment:sub}
html[data-look=paper] .prose h2::before,
html[data-look=paper] .prose h3::before{color:var(--c-meta);
  font-variant-numeric:tabular-nums;margin-right:.5ch}
html[data-look=paper] .prose h2::before{content:counter(sec) "."}
html[data-look=paper] .prose h3::before{content:counter(sec) "." counter(sub)}

/* FIGURES AND TABLES carry a number and nothing else HERE. The word in front of it is the
   one thing this dialect needs language for, and a content string cannot be translated, so
   it is written per page from the locale instead - paperLabelCss, at the foot of this
   file, overrides both of these. */
html[data-look=paper] .prose figure{counter-increment:fig}
html[data-look=paper] figcaption{text-align:left;padding-top:.55rem}
html[data-look=paper] figcaption::before{content:counter(fig) ". ";
  color:var(--c-heading);font-weight:var(--fw-heading,600)}
html[data-look=paper] .prose .table-scroll{counter-increment:tbl}
html[data-look=paper] .prose .table-scroll::before{content:counter(tbl) ".";
  display:block;margin-bottom:.45rem;color:var(--c-heading);
  font-weight:var(--fw-heading,600);font-size:var(--fs-small);line-height:var(--lh-small);
  letter-spacing:var(--ls-small)}

/* TABLES, ruled the way a paper rules them: a line over the head, a line under it, a line
   under the body, and nothing vertical. The variables are the owner's table knobs
   (content/settings-table.ts); this dialect answers them for the length of the look. */
html[data-look=paper] .prose table{--tbl-rule-x:0;--tbl-rule-y:0;--tbl-head-bg:transparent;
  --tbl-head-rule:1px;border-top:2px solid var(--c-heading);
  border-bottom:2px solid var(--c-heading);font-size:var(--fs-small);
  line-height:var(--lh-small);letter-spacing:var(--ls-small)}
html[data-look=paper] .prose th{border-bottom-color:var(--c-heading)}

/* NOTES at the foot: the short rule a printed page uses, not a full-width one. */
html[data-look=paper] hr.fn-rule{width:8rem;margin-left:0;border-top-color:var(--c-heading)}
html[data-look=paper] .footnotes{font-size:var(--fs-small);line-height:var(--lh-small);
  letter-spacing:var(--ls-small)}

/* The apparatus at the end takes the same rule as a section head, so the page closes the
   way it opened. */
html[data-look=paper] .related h2,
html[data-look=paper] #comments h2{border-bottom:1px solid var(--c-rule);
  padding-bottom:.3rem}

/* --- THE FRONT PAGE, IN ALL THREE SHAPES ------------------------------------
   Section heads on the composed front: a label between two rules, the width of the page,
   the way a paper separates Business from Sport. */
html[data-look=paper] .front-head{border-top:2px solid var(--c-heading);
  border-bottom:1px solid var(--c-rule);margin-bottom:1.1rem}
html[data-look=paper] .front-label{padding:.3rem 0}

/* COLUMN RULES, centred IN the gap rather than drawn at the edge of a card: the grid sets
   28px between columns and 40px beside the lead, so each rule is pulled back by half of
   its own gap and pads it straight back. Nothing moves; a line appears between columns. */
html[data-look=paper] .front-grid > .fc + .fc{border-left:1px solid var(--c-rule);
  margin-left:-14px;padding-left:14px}
html[data-look=paper] .front-secondary{border-left:1px solid var(--c-rule);
  margin-left:-20px;padding-left:20px}
html[data-look=paper] .front-secondary > .fc + .fc{border-top:1px solid var(--c-rule);
  padding-top:.85rem;margin-top:.85rem}
/* The lead headline is the one thing on a front page allowed to shout. */
html[data-look=paper] .fc-lead .fc-title{font-size:calc(var(--fs-h1) * 1.45);
  line-height:1.08;letter-spacing:-.022em;text-wrap:balance}
html[data-look=paper] .fc-cat{letter-spacing:.06em}

/* IN LIST MODE the entries are separated by one rule, the way a contents page is. A
   DESCENDANT selector, not a child one: the feed wraps each year's entries in their own
   block, so the rows are not children of the list. */
html[data-look=paper] .post-list article + article{border-top:1px solid var(--c-rule);
  padding-top:calc(var(--sp) * 1.1)}

/* IN GRID MODE every card takes a rule ACROSS ITS HEAD rather than down its side. A column
   rule was tried first and does not survive a wrapping grid: the number of columns changes
   with the width, the feed wraps each year in its own block so nth-child counts the year
   marker as the first child, and the rule landed down the left of cards already in the
   first column. A rule over each card needs to know none of that, and a paper's column of
   briefs is ruled that way anyway. */
html[data-look=paper][data-list=grid] .post-list article{
  border-top:1px solid var(--c-rule);padding-top:.75rem}

/* --- NO NAVIGATION RUNNING DOWN THE MARGIN, ON A PIECE ----------------------
   A paper does not carry a site menu beside its text, and with the facts already moved out
   of the right-hand panel the piece was sitting against one full gutter and one empty one.
   The shelf becomes what a printed paper puts there: a contents block at the head of the
   piece, under a rule.

   ON A PIECE ONLY. A listing has no contents of its own to head, and its shelf IS the
   navigation: moved inline there it landed at y=8167, under thirty-three posts, which is
   not a menu. The hook is structural - on a piece the shelf sits INSIDE the <article>, on a
   listing it is a sibling of the feed - and deliberately not a class, because the first
   hook tried was the book-typography class, which is a SETTING: the dialect would have come
   apart silently on any blog that turned that setting off.

   These rules restate the layout the rail already takes between 60rem and the rail
   breakpoint (render/rail-css.ts). Restated rather than shared because that block is
   generated per column width inside a media query, and this one is neither. */
html[data-look=paper] article .rail{text-align:left;position:static;width:auto;height:auto;
  margin:1.5rem 0 2.5rem;padding:0 0 1.25rem;border:0;
  border-bottom:1px solid var(--c-rule);background:none;transform:none;visibility:visible;
  overflow:visible;transition:none}
html[data-look=paper] article .rail::after{display:none}
html[data-look=paper] article .rail-inner{position:static;max-height:none;overflow:visible;
  width:auto;padding:0}
html[data-look=paper] article .rail-inner > * + *{margin-top:1rem}
html[data-look=paper] article .rail h2{margin:0;padding-left:0}
html[data-look=paper] article .rail-inner > nav:not(.toc)::before{content:attr(aria-label);
  display:block;margin-bottom:.5rem;font-weight:var(--fw-heading,600);color:var(--c-heading);
  font-size:var(--fs-small);line-height:var(--lh-small);letter-spacing:var(--ls-small)}
html[data-look=paper] article .rail ul{display:flex;flex-wrap:wrap;gap:.4rem 1.5rem}
html[data-look=paper] article .rail li,
html[data-look=paper] article .toc li{margin-top:0}
html[data-look=paper] article .toc ul{display:block;counter-reset:tocsec}
html[data-look=paper] article .toc li{width:max-content;max-width:100%;margin-top:.45rem;
  counter-increment:tocsec}
html[data-look=paper] article .toc li:first-child{margin-top:0}
html[data-look=paper] article .rail-row{padding-left:0}
html[data-look=paper] article .rail-row[aria-current]::after{left:0;right:0;top:auto;
  bottom:-4px;width:auto;height:2px}
html[data-look=paper] article .toc-end{margin-top:0}
html[data-look=paper] article .toc summary{pointer-events:auto;cursor:pointer;display:flex;
  align-items:center;gap:.5rem;margin-bottom:.6rem}
html[data-look=paper] article .toc summary h2{margin:0}
html[data-look=paper] article .toc summary::before{content:"";width:.4em;height:.4em;
  flex:none;border-right:1.5px solid var(--c-meta);border-bottom:1.5px solid var(--c-meta);
  transform:rotate(-45deg)}
html[data-look=paper] article .toc details[open] > summary::before{transform:rotate(45deg)}
html[data-look=paper] article .rail-toggle,
html[data-look=paper] article .rail-scrim{display:none}
/* THE CONTENTS CARRY THE SECTION NUMBERS, so the index and the piece agree. The first row
   is the title and the last is the jump to the taxonomy; neither is a section, so neither
   takes a number. Ranged left and tight: .rail-row spreads its children with
   space-between, which is right for a label and its count and put the number hard against
   the far edge of the rail, a thumb's width from the words it belongs to. */
html[data-look=paper] article .toc .rail-row{justify-content:flex-start;gap:.6ch}
html[data-look=paper] article .toc li:first-child,
html[data-look=paper] article .toc li:has(.toc-end){counter-increment:none}
html[data-look=paper] article .toc li:not(:first-child):not(:has(.toc-end)) .rail-row::before{
  content:counter(tocsec) ".";color:var(--c-meta);flex:none;
  font-variant-numeric:tabular-nums}
`.trim()

/**
 * The two words this dialect needs, and the only part of it that is not cached.
 *
 * Everything else in this sheet is punctuation, a rule or a counter, which needs no
 * language. "Fig." and "Table" do — and a CSS `content` string cannot be translated, so
 * they cannot live in the hashed sheet that is shared by every blog on earth. They ride in
 * the per-page settings block instead, which is already per-blog and already carries the
 * palette and the type scale. About 120 bytes, on the pages of one look.
 *
 * A counter and a word in one `content` string, because the number has to sit next to the
 * word: `Fig. 3.` is one label, not a word and a figure that happen to be adjacent.
 */
export function paperLabelCss(lang: SiteLang): string {
  const d = t(lang)
  return `html[data-look=paper] figcaption::before{content:${JSON.stringify(d.figureLabel + ' ')} counter(fig) ". "}`
    + `html[data-look=paper] .prose .table-scroll::before{content:${JSON.stringify(d.tableLabel + ' ')} counter(tbl)}`
}
