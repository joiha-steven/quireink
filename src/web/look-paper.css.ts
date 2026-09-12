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
// The SHELF lives in `look-paper-shelf.css.ts` and is concatenated back on at the foot of
// this file: one sheet reaches the page, and every guard still reads one string. It was cut
// out when this file passed the 400-line cap, by subject rather than by size.
//
// NO BACKTICKS anywhere below: this is one template literal and a backtick ends it.
// `check:css-literal` enforces that, and this file is IN its list.

import { LOOK_PAPER_SHELF_CSS } from '@/web/look-paper-shelf.css'

const LOOK_PAPER_HEAD_CSS = `
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
/* The nameplate is set in the HEADLINE face, not the reading one: on a paper the name and
   the headlines are cut from the same metal, and it is the one line every page opens with.
   This rule shipped once already and never applied - the masthead block below restated
   font-size four rules later, at plain --fs-h1 and in the reading face, and same-specificity
   order handed it the argument. */
html[data-look=paper] .site-bar > .title{font-size:calc(var(--fs-h1) * 1.5);
  line-height:1.05;letter-spacing:-.02em;
  font-family:'Source Serif 4','Source Serif 4 Fallback','Source Serif 4 Fallback 2',
    Georgia,'Times New Roman',serif}

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
   A paper announces itself once, in the middle: the name, then one line carrying the
   strapline in the centre and the reader's controls at the right end of it, then the
   sections, then a heavy rule closing the lot.

   A GRID, and that is what puts the controls on the strapline's line. They cannot share a
   row in a column flex: the name, the section menu and the controls live inside .site-bar
   while the strapline is its sibling, so the four become siblings only once the bar's own
   box is dropped - and in a column every sibling then takes a row of its own. Explicit
   placement also stops the DOM order mattering: the controls are written third and sit on
   the second row.

   THE CONTROLS USED TO BE ABSOLUTE, pinned to the top right corner, and that is what this
   replaces. On a masthead whose every other part is centred they hung in the corner with
   nothing opposite them, higher up the page than the name itself; on an article, which
   carries no section menu, they sat alone above 90px of empty white.

   '1fr auto 1fr' keeps the strapline centred on the PAGE rather than in what the controls
   leave of it: the outer columns stay equal whatever those controls measure, so the
   strapline sits on the same axis as the name above it. Measured at 1440: name centre
   720.0, strapline centre 720.0.

   'margin-inline:0' on the name is load-bearing: in the bar's own flex ROW it carries
   'margin-right:auto' to push the controls to the far end, and once the bar's box is gone
   that auto margin ate 917px of the column and pinned the name to the left edge while the
   strapline under it sat centred. */
html[data-look=paper] header.site{display:grid;grid-template-columns:1fr auto 1fr;
  align-items:center;padding-bottom:.9rem;border-bottom:3px solid var(--c-heading)}
html[data-look=paper] .site-bar{display:contents}
/* The name is the <a> on most pages and an <h1> wrapping it on a listing whose lead card
   is switched off, so the placement has to name both or the masthead loses its row on
   exactly those pages. */
html[data-look=paper] .site-bar > :is(.title,.site-h1){grid-area:1/1/2/-1;
  justify-self:center;margin-inline:0}
html[data-look=paper] header.site .tagline{grid-area:2/2/3/3;text-align:center;
  font-style:italic;margin:0}
/* THE CONTROLS END THE STRAPLINE'S ROW. -.625rem is the base sheet's own optical
   correction, put back: a 40px hit box round a 20px glyph carries 10px of air inside it,
   so a box flush with the column edge draws the last icon 10px short of the rule that
   closes the masthead, and the eye reads the icons as falling short rather than as
   aligned. The box still ends where the rule does; only the glyph moves. */
html[data-look=paper] .site-bar > .site-actions{grid-area:2/3/3/4;justify-self:end;
  margin:0 -.625rem 0 0}
/* BOTH margins to zero, and the padding with them. The base sheet pushes this menu to the
   right of the header row with 'margin-left:auto' and clears the controls with
   'padding-right:.5rem'; in a grid cell an auto margin beats the default stretch, so the
   sections came out flush right - centre 1021.5 under a name centred on 720 - and the half
   rem of padding would have thrown the centring 4px out even once that was fixed. */
/* NO 'display' HERE, and that is the fix rather than an omission. The base sheet hides this
   menu under 60rem and shows it above, because below that width the header is the name and
   up to five controls and the sections live in the drawer instead. This rule used to set
   'display:flex' flat, which outranked the hide and put the sections back on a phone - in
   the DEFAULT link colour and underlined, since the base only paints them inside that same
   media query, so a phone masthead carried five blue underlined links; and on the composed
   front page it offered the same five links the drawer button opens. Everything else here
   is inert while the menu is hidden. */
html[data-look=paper] .site-bar > .site-menu{grid-area:3/1/4/-1;flex-wrap:wrap;
  justify-content:center;gap:.3rem 1.5rem;margin:.8rem 0 0;padding:.65rem 0 0;
  border-top:1px solid var(--c-rule)}

/* NARROW: THE CONTROLS TAKE THEIR OWN ROW, centred under a centred nameplate. Sharing the
   strapline's line needs room for the strapline, a symmetric column opposite the controls
   and the controls themselves; measured at 390 with a 36-character strapline it did not
   have it - the strapline was squeezed to 186px hard against the left edge with four icons
   on the right, under a name centred between them. The optical -.625rem goes with it: it
   exists to line the last glyph up with a rule at the column edge, and centred there is no
   edge to line up with. */
@media (max-width:44rem){
  html[data-look=paper] header.site{grid-template-columns:1fr}
  html[data-look=paper] .site-bar > :is(.title,.site-h1){grid-area:1/1/2/2}
  html[data-look=paper] header.site .tagline{grid-area:2/1/3/2}
  html[data-look=paper] .site-bar > .site-actions{grid-area:3/1/4/2;justify-self:center;
    margin:.45rem 0 0}
  html[data-look=paper] .site-bar > .site-menu{grid-area:4/1/5/2}
}

/* --- THE PIECE'S OWN PAGE SHAPE ---------------------------------------------
   The facts about the piece leave the right-hand panel and go under the headline where a
   paper puts them, and the taxonomy returns to the foot. This is the half that makes it a
   different page rather than the same page with rules drawn on it. */
html[data-look=paper] .post-info{display:none}
html[data-look=paper] .post-meta{display:contents;letter-spacing:.04em}
html[data-look=paper] .taxo-rule,html[data-look=paper] .post-taxo{display:block}
html[data-look=paper] .post-taxo{text-align:center}

/* THE SECTION OVER THE HEADLINE, THE DATE AND THE BYLINE UNDER IT. Every paper does this,
   and the web habit of stacking all of it above the title is what made the page open on a
   grey line of housekeeping instead of on a headline.

   The four are ONE PARAGRAPH and a heading in the markup, so nothing can reorder them until
   the paragraph gives up its box: 'display:contents' above promotes the section link and
   the facts to siblings of the headline and the standfirst, and this grid then places all
   four by hand. Same move as the masthead, for the same reason.

   Row 1 is empty on a piece filed under nothing, and an empty grid row with no gap set
   measures zero, so the headline stays where it was. */
html[data-look=paper] article > header{display:grid;text-align:center;padding-bottom:.2rem}
html[data-look=paper] .post-cat{grid-row:1;justify-self:center}
html[data-look=paper] article > header h1{grid-row:2;margin-top:.5rem;text-wrap:balance}
html[data-look=paper] article > header .deck{grid-row:3}
html[data-look=paper] .post-facts{grid-row:4;justify-self:center;margin-top:1.1rem}
/* The middot the base sheet sets between the two is a separator between two halves of one
   sentence. They are not one sentence any more. */
html[data-look=paper] .post-cat::after{content:none}
/* The section is a KICKER: the same small letterspaced capitals the front page puts over a
   card, so a piece opens the way its own summary on the front page did. */
html[data-look=paper] .post-cat{font-family:'Inter','Inter Fallback',system-ui,-apple-system,
    'Segoe UI',sans-serif;
  text-transform:uppercase;letter-spacing:.08em;font-weight:600;color:var(--c-heading);
  text-decoration:none}
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

/* --- THE SERIES BOX IS A STANDING BOX ---------------------------------------
   A rounded card with a hairline all round it is a web component, and it was the one thing
   left on the page that said so. A paper sets a standing box the way it sets a section: a
   heavy rule over it, the head as small letterspaced capitals on a band of its own, a
   hairline under that, then the list. Nothing else on this page draws a corner radius, and
   nothing else should.

   Capitals by TEXT-TRANSFORM, never typed: the series name reaches the feed, the search
   result and a screen reader as the owner wrote it.

   The marker beside the part being read is the margin's CHANGE BAR, which is a printed
   convention rather than a borrowed web one - so it moves to the column edge and takes
   heading ink. It was the accent, which in this look is the link blue, and a blue bar
   beside a line of black type says the line is a link. */
html[data-look=paper] aside.series{border:0;border-radius:0;padding:0 0 1rem;
  border-top:2px solid var(--c-heading);border-bottom:1px solid var(--c-rule)}
html[data-look=paper] aside.series .series-head{margin:0 0 1rem;padding:.45rem 0;
  line-height:1;color:var(--c-heading);border-bottom:1px solid var(--c-rule);
  font-family:'Inter','Inter Fallback',system-ui,-apple-system,'Segoe UI',sans-serif;
  text-transform:uppercase;letter-spacing:.08em;font-weight:600}
html[data-look=paper] aside.series .series-head a{color:inherit;text-decoration:none}
html[data-look=paper] aside.series ol{border-top:0;padding:0 0 0 1.25rem}
html[data-look=paper] aside.series li[aria-current]::after{left:-1.25rem;
  background:var(--c-heading)}

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
/* LINE-HEIGHT 1 IS WHAT CENTRES THE LABEL, not the padding. A line box carries room for a
   descender under the baseline and room for an ascender over the cap, and an all-caps word
   uses neither: at the inherited leading the band read 7px of air over the caps and 9px
   under the baseline, so the label sat 2px high inside its own rules. At leading 1 this
   face puts the same 2.1px above the cap as below the baseline, because Inter's ascender
   less its cap height (0.2413em) is its descender (0.2412em) - so equal padding then
   centres the ink rather than the box. Measured after: 9.3 over, 9.3 under. */
html[data-look=paper] .front-label{padding:.45rem 0;line-height:1}

/* COLUMN RULES, centred IN the gap rather than drawn at the edge of a card: the grid sets
   28px between columns and 40px beside the lead, so each rule is pulled back by half of
   its own gap and pads it straight back. Nothing moves; a line appears between columns. */
/* ONE GUTTER FOR EVERY COLUMN RULE ON THE PAGE. The row beside the lead sets 40px and the
   card grid set 28, so the same hairline stood 20px off the words in one place and 14px in
   the other - and 14px beside a card whose picture is a filled block read as a rule leaning
   on the picture. The grid takes the row's gutter, so both rules now breathe the same. */
html[data-look=paper] .front-grid{column-gap:40px}
html[data-look=paper] .front-grid > .fc + .fc{border-left:1px solid var(--c-rule);
  margin-left:-20px;padding-left:20px}
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

`.trim()

/** The dialect, in one string: everything above, then the shelf. */
export const LOOK_PAPER_CSS = `${LOOK_PAPER_HEAD_CSS}\n${LOOK_PAPER_SHELF_CSS}`

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
