// The IDE chrome (settings.ideChrome). Split out of `islands.css.ts` at the 400-line
// limit, and the seam is a real one: every rule here is behind ONE attribute and none of
// it applies unless the owner turned the switch on.
//
// NO BACKTICKS anywhere below: this is one template literal and a backtick ends it.
// `check:css-literal` enforces that — and this file is IN its list, which is the mistake
// `prose.css.ts` made by being split out without being added.

export const IDE_CSS = `
/* --- IDE CHROME (settings.ideChrome, html[data-ide-chrome=on]) -------------------
   One deliberate contrast: the reading column stays analogue - a book serif, ranged
   left, no ornament - and everything AROUND it reads as source code. The two halves
   are supposed to disagree; that disagreement is the design.

   Every rule below is additive and lives behind one attribute, so turning the switch
   off in Admin leaves not a trace of it. Nothing here touches .prose, the post title,
   the card excerpts or the comment bodies: those are the reader's own words and they
   are the half that must NOT look technical.

   Colour comes from theme tokens only, as everywhere else. The two roles a code
   editor actually distinguishes are the comment and the literal, so that is what is
   borrowed: labels are comments (--c-meta), counts and dates are literals
   (--c-text). No third colour, and no hex.

   The literal was --c-accent for one deploy. This blog's Mono accent is red, so every
   date and count read as a link that was not one. --c-text is the ink the article is
   already set in: a clear step darker than the label, and silent. */

/* Labels are comments. The marker is CSS, not markup, so the heading a screen reader
   and a feed see stays the plain word.

   ONE list, covering every chrome label the site has. It used to be the rail alone, and
   the treatment stopped halfway down the article: the rail said "// Muc luc" and then the
   related posts, the sign-up card, the comment thread and the series head - all of them
   furniture, none of them the reader's words - said nothing at all. The tagline is in
   here because that is exactly what it is: the line under the name that says what this
   file is for. */
html[data-ide-chrome=on] .rail h2::before,
html[data-ide-chrome=on] header.site .tagline::before,
html[data-ide-chrome=on] aside.series .series-head::before,
html[data-ide-chrome=on] .related h2::before,
html[data-ide-chrome=on] .subscribe-card h2::before,
html[data-ide-chrome=on] .front-label::before,
html[data-ide-chrome=on] #comments h2::before,
html[data-ide-chrome=on] .empty::before,
/* The two things that DO something rather than state something, so they take the label's
   marker rather than a literal's brackets: the panel's book-mode button, and the front
   page's way on to the whole archive, which sits on a heading row beside a label that is
   already marked and read as the one unmarked thing in the row without it. */
html[data-ide-chrome=on] .front-more::before,
html[data-ide-chrome=on] .info-action::before{content:"// ";color:var(--c-meta)}
/* ...except in the comment thread. "Be the first to comment" is an invitation to the
   reader, not a label on a section, and the owner asked for the marker off it. */
html[data-ide-chrome=on] #comments .empty::before{content:none}
/* The commenter's name takes the marker too. Not because it is a label — it is a person —
   but because it opens an entry, the way every other marker on the page opens a block, and
   the meta line was the one row in the thread with nothing saying where an entry begins.
   The name keeps its own weight and colour; only the marker is meta.
   NO BACKTICKS IN THIS FILE: the whole sheet is one template literal and a backtick in a
   comment ends it, which turns the rest of the CSS into TypeScript. It has now done that. */
html[data-ide-chrome=on] .comment-name::before{content:"// ";color:var(--c-meta);font-weight:400}

/* Counts are literals, bracketed like an index — every count, in the same brackets. The
   rail's own counts were bracketed and the taxonomy's were in ROUND ones, because those
   came from the markup rather than from here; the pager's "1 / 5" had nothing. The
   parentheses now come from CSS too, so this can swap them for square without touching a
   renderer, and switching the chrome off puts them back. */
/* Dates and figures are literals too, and they take the SAME brackets. That is the whole
   of the syntax highlighting, and it is why the counts in a meta line are wrapped in
   markup: "1,240 tu - 6 phut doc" has to be able to set the digits apart from the units.

   The brackets are a shade LIGHTER than what they hold. They are punctuation, not the
   value, and at the same weight as the digits a meta line reads as a row of boxes rather
   than as a date followed by two figures. */
/* ONE bracket for every literal, and the term counts are in it too. They were a filled
   ring for one deploy, on the reasoning that a term cloud has no sequence to punctuate;
   the owner looked at it and said it was ugly, which settles it. Brackets everywhere is
   also the simpler rule to hold. */
html[data-ide-chrome=on] .rail-count,
html[data-ide-chrome=on] .term-count,
html[data-ide-chrome=on] .pager-count,
html[data-ide-chrome=on] .t-small time,
html[data-ide-chrome=on] .comment-meta time,
html[data-ide-chrome=on] .related p,
html[data-ide-chrome=on] .num{color:var(--c-text)}
html[data-ide-chrome=on] .term-count{opacity:1}
html[data-ide-chrome=on] .rail-count::before,
html[data-ide-chrome=on] .term-count::before,
html[data-ide-chrome=on] .pager-count::before,
html[data-ide-chrome=on] .t-small time::before,
html[data-ide-chrome=on] .comment-meta time::before,
html[data-ide-chrome=on] .related p::before,
html[data-ide-chrome=on] .num::before{content:"[";color:var(--c-meta)}
html[data-ide-chrome=on] .rail-count::after,
html[data-ide-chrome=on] .term-count::after,
html[data-ide-chrome=on] .pager-count::after,
html[data-ide-chrome=on] .t-small time::after,
html[data-ide-chrome=on] .comment-meta time::after,
html[data-ide-chrome=on] .related p::after,
html[data-ide-chrome=on] .num::after{content:"]";color:var(--c-meta)}
/* Darker inside the info panel than anywhere else, at the owner's ask: the same ink the
   contents list gives the row you are on. That panel is the only place a desktop reader
   sees the date and the length, so it has to carry the hierarchy by itself — everywhere
   else the literal sits in a line that already has a heading over it. */
html[data-ide-chrome=on] .post-info time,
html[data-ide-chrome=on] .post-info .num{color:var(--c-heading)}

/* A post's tags and categories are a comma-separated run already. In brackets they read
   as the array literal they are: tags: [css, typography]. The label and its colon are
   the markup's; only the brackets are ours. Unscoped, because the same run appears in the
   article footer on a narrow screen and in the right-hand info panel on a wide one. */
html[data-ide-chrome=on] .term-list::before{content:"[";color:var(--c-meta)}
html[data-ide-chrome=on] .term-list::after{content:"]";color:var(--c-meta)}

/* Two more lists that were bare: the related posts and the parts of a series. Both are
   indexed rather than counted, so they take the same brackets ranged in their own column
   — a references panel, not a bulleted list. The series had decimal markers, which is the
   one place the switch REPLACES something rather than adding to it. */
html[data-ide-chrome=on] .related ul{counter-reset:rel}
html[data-ide-chrome=on] .related li{counter-increment:rel;position:relative;padding-left:4ch}
html[data-ide-chrome=on] .related li::before{content:"[" counter(rel) "]";position:absolute;
  left:0;top:0;color:var(--c-meta);font-variant-numeric:tabular-nums}
html[data-ide-chrome=on] aside.series ol{list-style:none;padding-left:0;counter-reset:part}
html[data-ide-chrome=on] aside.series li{counter-increment:part;position:relative;padding-left:4ch}
html[data-ide-chrome=on] aside.series li::before{content:"[" counter(part) "]";position:absolute;
  left:0;top:0;color:var(--c-meta);font-variant-numeric:tabular-nums}
/* The accent bar hugs the card's inner edge in both modes; this list has no ol padding, so
   the offset that reaches that edge is the card's own 1.5rem, not the base list's 2.75. */
html[data-ide-chrome=on] aside.series li[aria-current]::after{left:-1.5rem}

/* The feed's right gutter is a year over its months, which is a PATH and not a count — so
   it takes a separator rather than brackets. The year is sticky, so exactly one is ever on
   screen, and the month markers below it read as the next segment: 2026/ ... Thang 6.
   The tag is a flex row with a .5rem gap, and a pseudo-element is a flex ITEM, so the gap
   would push the slash a space clear of the digits. The negative margin cancels it. */
html[data-ide-chrome=on] .tl-year-tag::after{content:"/";margin-left:-.5rem;color:var(--c-meta)}

/* THE HEADER CONTROLS. Four round line-art glyphs are the language of a phone app, and
   they were the last thing on the page still speaking it. Under the switch each button
   drops its icon and shows a bracketed token instead: [/tim] [toi] [luoi] [@email].

   Both are in the markup and exactly one has a box, which is the same arrangement the
   article's info panel uses — because the switch has to leave NO trace when it is off. A
   reader who does not want the terminal look gets the icons the site has always had.

   Only from 640px up. Five tokens are far wider than five 40px buttons, and on a phone
   they would wrap the header onto two lines; below that width the icons stay. */
@media (min-width:640px){
  html[data-ide-chrome=on] .icon-btn svg{display:none}
  html[data-ide-chrome=on] .btn-token{display:inline}
  html[data-ide-chrome=on] .btn-token::before{content:"[";color:var(--c-meta)}
  html[data-ide-chrome=on] .btn-token::after{content:"]";color:var(--c-meta)}
  /* The 40px square was sized around a 20px glyph, and the button states no size of its
     own — so a WORD in it inherited the 18px BODY size and the row came out as five large
     words spread wide. The token is caption-sized (islands.css.ts) and the box shrinks to
     it: this row is the quietest chrome on the page, not a menu bar. */
  /* min-height, though: the box shrinking to caption-sized text left the four header
     controls 24px tall, and this rule starts at 640px, which a phone in landscape and a
     small tablet both clear while still being tapped with a thumb. The row stays visually
     the same height, because the text is centred in a box that is only taller than it
     needs to be. */
  html[data-ide-chrome=on] .icon-btn{width:auto;height:auto;padding:.15rem .2rem;
    min-height:2.25rem}
  html[data-ide-chrome=on] .site-actions{gap:.4rem;margin-right:-.2rem}
}

/* THE GUTTER. A counter on the list, ranged right in its own column, exactly as an
   editor numbers lines. It is decoration, so it is aria-hidden by being generated
   content on the <li> rather than inside the link - the row's accessible name is
   still the label and its count.

   It is --c-meta and not the hairline token, which measured 1.16:1 against the page:
   invisible, and a generated counter is still announced by some screen readers. A real
   editor's gutter is perfectly legible; what makes it a gutter is where it sits and
   that its figures are tabular, not that you cannot read it.

   The column is in ch of the mono chrome, so two digits always fit and the labels
   stay aligned however long the list runs. Tabular figures are what stop the numbers
   shifting the labels as the count crosses 9. */
/* The rail keeps the alignment it has with the switch off: ranged right, hugging the
   article. An earlier pass ranged it LEFT to put the gutter where an editor puts it;
   the owner asked for the opposite, so the GUTTER moves to the far right instead and
   nothing else about the rail changes. The active marker stays where the gutter layout
   put it, at the row's right edge, which is now 3.5ch clear of the numbers. */
/* EVERYTHING BELOW IS GUTTER-ONLY, and the gutter starts at 640px.
   Under it the rail is not a gutter at all, it is a slide-out drawer: no divider hairline
   for a ring to sit on, and no .rail-inner scroller for an overhang to rescue, because
   rail-css.ts injects that scroller inside the same breakpoint. Ungated, these rules made
   the DRAWER pan sideways by 32px on every phone - the overhang widened .rail-inner to
   calc(100% + 32px) inside a 259px box, and .rail sets overflow-y:auto, which computes
   overflow-x to auto whether or not anyone asked for it. The header already drops the
   tokens below this width for its own reasons; the rail drops its gutter here. */
@media (min-width:640px){
html[data-ide-chrome=on] .rail ul{counter-reset:ln}
/* The number sits in a small ring ON the rail's divider, the same language the feed's
   year and month markers already speak: a node on a hairline. It costs the rail NO
   width - the ring lives out on the line, past the text - which is why the row keeps its
   normal padding and nothing here reserves a column.

   -22px = the divider's own -13px offset, minus half the 18px ring. The ring carries a
   --c-bg fill so the line breaks around it rather than running through it. */
html[data-ide-chrome=on] .rail li{counter-increment:ln;position:relative}
html[data-ide-chrome=on] .rail li::before{content:counter(ln);position:absolute;
  top:.05em;right:-23px;width:18px;height:18px;border-radius:50%;
  display:flex;align-items:center;justify-content:center;
  background:var(--c-bg);border:1px solid var(--c-rule);color:var(--c-meta);
  /* Air around the ring, the way the feed's markers get it: their --c-bg mask is a
     text line tall, so the spine stops well clear of the dot instead of touching it.
     A ring-sized mask left the hairline running into the border. The shadow paints
     the same break and costs no layout. */
  box-shadow:0 0 0 5px var(--c-bg);
  font-size:.62em;font-variant-numeric:tabular-nums;pointer-events:none}
/* .rail-inner scrolls a long index, and overflow-y:auto clips horizontally too - so the
   ring would be cut in half by its own container. The box grows right by the overhang and
   pads it back, which puts the ring inside the padding box where nothing clips it. */
html[data-ide-chrome=on] .rail-inner{width:calc(100% + 24px);padding-right:24px}
/* The active marker sits at the row's right edge, which used to be the rail's edge and
   nothing else - now the ring is out past it, so at 0 the hairline read as belonging to
   the ring rather than to the row it marks. Pulled in, but only 3px: 6px put it close
   enough to the words to crowd them, which is the opposite complaint. The row's own
   padding is 14px, so this leaves 11px of air on the text side and 10px to the circle. */
html[data-ide-chrome=on] .rail-row[aria-current]::after{right:3px}
/* The article index numbers its HEADINGS and nothing else. Its first row is the post
   title (a click is "back to the top") and its last is the jump to tags / categories /
   comments - neither is a line of the piece, and numbering them made the index look one
   heading longer than the post.

   Keyed on POSITION and on .toc-end, deliberately not on .is-active: the ToC island moves
   that class to whichever heading you are level with, so a rule hanging off it would drop
   the number from a different row as you scrolled. */
html[data-ide-chrome=on] .toc li:first-child,
html[data-ide-chrome=on] .toc li:has(.toc-end){counter-increment:none}
html[data-ide-chrome=on] .toc li:first-child::before,
html[data-ide-chrome=on] .toc li:has(.toc-end)::before{content:none}

/* The tag cloud is a run of words, not a list, so it has no lines to number. */
html[data-ide-chrome=on] .rail-tags{counter-reset:none}

/* NESTING. The article index used to say "this is a sub-heading" with a smaller size and a
   bullet on the PARENT, and at a glance neither reads: the two sizes are close and the
   bullet sits at the far end of a right-ranged row. And the numbers counted every row 1..12
   straight through, so a sub-heading of section 2 was numbered 7 and looked like a section.

   A child is a path segment now. Same size, same weight as its parent, with a leading "/" —
   the same mark the feed's gutter year already uses, and the only one on the site that
   means "inside". The parent keeps its plain number; the child is numbered WITHIN it, so
   "2.1" says where it lives instead of where it falls in a flat list.

   Only under the switch. With the chrome off the index keeps the bullet and the smaller
   size it has always had. */
html[data-ide-chrome=on] .rail-lead::before{content:none}
html[data-ide-chrome=on] .rail-sub{font-size:var(--fs-small);line-height:var(--lh-small);
  letter-spacing:var(--ls-small)}
/* gap:0 on the row: .rail-row spreads its flex children by .875rem, which is right for a
   label and its count and puts the slash a thumb width away from the word it belongs to. */
html[data-ide-chrome=on] .toc .rail-sub{gap:0}
html[data-ide-chrome=on] .rail-sub::before{content:"/";color:var(--c-meta);margin-inline-end:.35em}
html[data-ide-chrome=on] .toc ul{counter-reset:ln h2 h3}
/* counter-SET, not counter-reset. A reset on the parent row creates a new instance
   scoped to that row and its following siblings, and the children read the outer one
   regardless: measured, the numbers ran 1.1 1.2 2.3 2.4 2.5 3.6 straight through. */
html[data-ide-chrome=on] .toc li:has(.rail-lead){counter-increment:h2;counter-set:h3 0}
html[data-ide-chrome=on] .toc li:has(.rail-lead)::before{content:counter(h2)}
html[data-ide-chrome=on] .toc li:has(.rail-sub){counter-increment:h3}
/* A pill rather than a circle: "2.1" is three characters and will not fit an 18px ring.
   Wider, and pushed out by half the extra width, so its centre stays on the divider. */
html[data-ide-chrome=on] .toc li:has(.rail-sub)::before{content:counter(h2) "." counter(h3);
  width:30px;right:-29px;border-radius:999px}
html[data-ide-chrome=on] .toc .rail-inner{width:calc(100% + 32px);padding-right:32px}
}
`.trim()
