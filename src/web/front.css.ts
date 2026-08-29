// The composed front page. ADR 0014, part 2.
//
// NO BACKTICKS ANYWHERE IN THIS FILE: the whole sheet is one template literal and a backtick
// inside a prose comment ends it, which turns the rest of the CSS into TypeScript. That has
// already cost this project a boot.
//
// Two rules shape everything here.
//
// 1. Hierarchy comes from SIZE, then standfirst, then image, then rules — measured on the
//    NYT front page, where most stories carry no picture at all. So the two site kinds are
//    one grammar with the dials turned, not two layouts. `.front-text` raises the headline
//    a step and lets the standfirst run; `.front-image` gives the space to a picture.
// 2. It has to look finished with the IDE chrome OFF, which is the default for everybody
//    who installs this. The markers and brackets are a layer a site may add, never the
//    thing holding the design up.
//
// No cards, no boxes, no shadows: rules and whitespace do the separating, which is both what
// a newspaper front does and what the rest of this site already does.

export const FRONT_CSS = `
/* The page is WIDER THAN THE READING COLUMN, and that is done by widening --shell-w for the
   whole document rather than by breaking this one element out of it.
   Photographed both ways. --shell-w is a measure tuned for one column of prose (672px by
   default), and three across inside it is not three columns, it is three slivers: the
   secondary headline came out in a 110px column, five ragged lines deep. Breaking only
   .front out fixed that and left the site header and footer still centred on the old narrow
   measure, visibly unrelated to the page under them. The override is emitted per render,
   beside the column counts, because the width is a setting. */
/* The gap under the lead's category line, declared once because TWO rules need the same
   number: the kicker's own margin, and the offset that drops the secondary column past it. */
.front{display:flex;flex-direction:column;gap:2.5rem;--fc-cat-gap:.35rem}
/* Every row after the first is ruled off. The rule is the section break; there is no box. */
.front-row+.front-row{border-top:1px solid var(--c-rule);padding-top:2.5rem}
.front-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:.35rem 1.25rem;margin:0 0 1.5rem}
/* The way on to the whole archive, on the right of the last heading. An auto left margin
   rather than a spacer, so it stays at the far edge with the topic links wrapping in front of
   it and drops to its own line, still at the edge, when the heading runs out of room. */
.front-more{margin-left:auto;color:var(--c-meta)}
/* A row label is a LABEL, so it is smaller than the headlines under it.
   It started at --fs-h4 and photographed as a competitor: h4 in a monospace chrome face
   reads wider and heavier than h3 in Literata, so the two sat at the same visual weight and
   the eye had no order to follow. Dropping it a step puts the headlines back on top, which
   is what the rest of this page already does with the label on the related-posts block. */
.front-label{font-size:var(--fs-small);line-height:var(--lh-small);letter-spacing:var(--ls-small);
  font-weight:var(--fw-heading,600);color:var(--c-heading);margin:0}
.front-label a{color:inherit;text-decoration:none}
/* The topic links, one step quieter again so the label reads first. Wrapped, never scrolled:
   a row that scrolls sideways on a phone hides half of itself and nothing says so. */
.front-topics{display:flex;flex-wrap:wrap;gap:.25rem .75rem;margin:0;color:var(--c-meta);
  font-size:var(--fs-small);line-height:var(--lh-small);letter-spacing:var(--ls-small)}
.front-topics a{color:inherit}
.front-grid{display:grid;gap:1.75rem}
.front-lines{display:flex;flex-direction:column;gap:1rem}
/* A row that ended up with ONE item still holds a reading measure. Left to fill the grid it
   set a standfirst 1120px wide, which is not a line anybody reads; and a lone full-bleed
   card reads as a mistake rather than as a row. */
.front-grid.cols-1{max-width:42rem}

/* ----- one item ---------------------------------------------------------- */
.fc{margin:0;min-width:0}
.fc-cat{margin:0 0 var(--fc-cat-gap);color:var(--c-meta)}
.fc-title{margin:0;font-weight:var(--fw-heading,600);color:var(--c-heading);
  font-size:var(--fs-h3);line-height:var(--lh-h3);letter-spacing:var(--ls-h3)}
.fc-title a{color:inherit;text-decoration:none}
.fc-title a:hover{text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:2px}
.fc-deck{margin:.5rem 0 0;color:var(--c-text);
  font-size:var(--fs-small);line-height:var(--lh-small);letter-spacing:var(--ls-small)}
.fc-meta{margin:.5rem 0 0}
/* The lead's opening lines. Body size and the reading face, because it IS the body: setting
   it a step down would read as a second standfirst rather than as the start of the piece. */
.fc-intro{margin:.75rem 0 0;color:var(--c-text);font-family:var(--font-reading);
  font-size:var(--fs-body);line-height:var(--lh-body);letter-spacing:var(--ls-body)}
.fc-media{margin:0 0 .75rem}
/* Reserve the box before the bytes arrive, so nothing below jumps as images land. A front
   page is mostly images-not-yet-loaded on a first visit, which is when this matters most. */
.fc-media img{display:block;width:100%;height:auto;aspect-ratio:16/9;object-fit:cover;
  background:var(--c-rule)}

/* ----- the lead ---------------------------------------------------------- */
.fc-lead .fc-title{font-size:var(--fs-h2);line-height:var(--lh-h2);letter-spacing:var(--ls-h2)}
.fc-lead .fc-deck{font-size:var(--fs-body);line-height:var(--lh-body);letter-spacing:var(--ls-body)}
.front-lead-row{display:flex;flex-direction:column;gap:1.75rem}
/* Headlines stacked under the lead, ruled off from each other and from it. */
.front-secondary{display:flex;flex-direction:column;gap:1rem;
  border-top:1px solid var(--c-rule);padding-top:1.25rem}
.fc-line .fc-title{font-size:var(--fs-h4);line-height:var(--lh-h4);letter-spacing:var(--ls-h4)}

/* ----- the text kind ----------------------------------------------------- */
/* One step louder everywhere, because the words are all there is. */
.front-text .fc-lead .fc-title{font-size:var(--fs-h1);line-height:var(--lh-h1);letter-spacing:var(--ls-h1)}
.front-text .fc-title{font-size:var(--fs-h3);line-height:var(--lh-h3);letter-spacing:var(--ls-h3)}
.front-text .fc-deck{font-family:var(--font-reading)}

/* ----- one column, then two, then three ---------------------------------- */
/* MOBILE FIRST, and all three counts live here rather than being emitted per render.
   They were emitted per render at first, into the page's inline style, which comes after
   this sheet — so the two-column rule won at every width and the phone got columns it could not
   fit, running the page off the side of the screen. The counts are sanitized to 1, 2 or 3,
   so there is nothing here that settings could ask for and this file could not already say. */
.front-grid{grid-template-columns:minmax(0,1fr)}
@media (min-width:641px){
  .front-grid.cols-2,.front-grid.cols-3{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media (min-width:901px){
  .front-grid.cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}
}
@media (max-width:640px){
  .front{gap:2rem}
  .front-row+.front-row{padding-top:2rem}
}

/* ----- the lead's two columns, on a wide screen only --------------------- */
/* The picture is AFTER the text in source order, which is what puts the headline above the
   image on a phone with no work at all. Here the grid puts it back on the right. Doing it
   the other way round means a phone reader scrolls past a photograph to find out what it is
   of, which is what the NYT front page avoids too. */
@media (min-width:901px){
  .front-image .fc-lead.has-media{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);
    gap:2rem;align-items:start}
  .front-image .fc-lead.has-media .fc-media{margin:0}
  .front-image .fc-lead.has-media .fc-media img{aspect-ratio:3/2}
  /* 2:1, not 3:1. At 3:1 the secondary column was 110px wide and every headline in it
     broke to five ragged lines. Aligning to start keeps the taller column from stretching
     the shorter one, which is what left a quarter of this row empty. */
  .front-lead-row{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:2.5rem;
    align-items:start}
  .front-lead-row .front-secondary{border-top:0;border-left:1px solid var(--c-rule);
    padding:0 0 0 1.75rem}
  /* Two top-aligned columns where only ONE of them opens with a category line put the
     secondary headlines 30px above the lead headline, measured at 1440, so the smaller
     column read first. The offset is that line: its size times its leading, plus the gap the
     kicker itself uses. Only applied when the lead actually prints one — a lead with no
     category has nothing to align past. */
  .front-lead-row.has-kicker .front-secondary{
    padding-top:calc(var(--fs-small) * var(--lh-small) + var(--fc-cat-gap))}
}
`.trim()
