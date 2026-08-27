// Everything that styles an element the browser bundle CREATES.
//
// Split out of `public.css.ts` at the 400-line limit, and the seam is a real one rather
// than an arbitrary halfway point: none of these rules apply to the server-rendered page,
// so a reader with JavaScript off sees no gaps — the elements simply never exist. The two
// sheets are concatenated and inlined together, so this costs no extra request.

export const ISLANDS_CSS = `
/* --- islands -------------------------------------------------------------------
   Every rule below styles an element the browser bundle CREATES. None of it applies
   to the server-rendered page, so a reader with JavaScript off sees no gaps: the
   elements simply never exist. */

/* font-family explicitly, because this button lives INSIDE .prose pre and would otherwise
   inherit the code face. It is chrome sitting on top of code, not code. */
.code-copy{position:absolute;top:.4rem;right:.4rem;padding:.15rem .5rem;font-size:var(--fs-caption);
  line-height:var(--lh-caption);letter-spacing:var(--ls-caption);font-family:var(--font-sans);
  border:1px solid var(--c-rule);background:var(--c-bg);color:var(--c-meta);cursor:pointer;opacity:0;transition:opacity var(--dur-fast)}
.prose pre{position:relative}
.prose pre:hover .code-copy,.code-copy:focus-visible{opacity:1}

/* The reading-progress bar has NO script behind it: a scroll-driven animation reads the
   document's own scroll position. It therefore works with JavaScript off, and runs off the
   main thread. On an engine without scroll timelines the bar would sit at zero forever, so
   the @supports rule removes it entirely rather than leaving a dead hairline on the page.
   NOTE: no backticks anywhere in this file. It is one template literal, and a backtick in
   a comment ends the string. That has now cost two debugging sessions. */
.progress{display:none;position:fixed;inset-inline:0;top:0;height:2px;z-index:50}
.progress-fill{height:100%;background:var(--c-heading);transform:scaleX(0);transform-origin:0 50%}
@supports (animation-timeline:scroll()){
  .progress{display:block}
  .progress-fill{animation:read-progress linear both;animation-timeline:scroll(root block)}
}
@keyframes read-progress{to{transform:scaleX(1)}}


.to-top{position:fixed;bottom:1.25rem;right:1.25rem;z-index:40;display:flex;width:2.5rem;height:2.5rem;
  align-items:center;justify-content:center;border:1px solid var(--c-rule);border-radius:999px;
  background:var(--c-bg);color:var(--c-meta);cursor:pointer;opacity:0;pointer-events:none;transition:opacity var(--dur-base),color var(--dur-base)}
.to-top.shown{opacity:1;pointer-events:auto}
.to-top:hover{color:var(--c-heading)}

/* The way back into a half-read post (assets/js/resume.ts). The to-top button's own
   manners: paper, hairline, quiet corner — bottom CENTRE, because it speaks about the
   reader's place in the text rather than about the page. It leaves on its own the moment
   the reader starts scrolling; a control that answers a question nobody asked has to go
   quietly. */
.resume-pill{position:fixed;bottom:1.25rem;left:50%;transform:translateX(-50%);z-index:40;
  max-width:min(92vw,26rem);padding:.55rem 1.1rem;border:1px solid var(--c-rule);border-radius:999px;
  background:var(--c-bg);color:var(--c-body);cursor:pointer;font-size:var(--fs-small);
  line-height:var(--lh-small);letter-spacing:var(--ls-small);opacity:0;pointer-events:none;transition:opacity var(--dur-base),color var(--dur-base)}
.resume-pill.shown{opacity:1;pointer-events:auto}
.resume-pill:hover{color:var(--c-heading)}

/* The quote control, raised on a selection (assets/js/quote.ts).
   SOLID INK, and the first cut was not: it borrowed the to-top button's hairline-on-paper
   and came out a pale grey pill sitting on top of grey text, which the owner's word for was
   "khó nhìn". The to-top button can be quiet because it waits in an empty corner; this one
   appears IN the text, over the words, for two seconds. A control that interrupts reading
   has to look deliberate or it reads as a rendering fault. Ink and paper, inverted, is the
   loudest thing this palette can say without introducing a colour.
   Positioned in DOCUMENT space (absolute, not fixed): a fixed control has to be re-placed
   on every scroll frame, and this one is dismissed by scrolling anyway. */
.quote-copy{position:absolute;z-index:40;padding:.34rem .8rem;border:0;
  border-radius:999px;background:var(--c-heading);color:var(--c-bg);cursor:pointer;
  font-family:var(--font-sans);font-size:var(--fs-small);line-height:var(--lh-small);
  white-space:nowrap;
  letter-spacing:var(--ls-small);transition:opacity var(--dur-base)}
.quote-copy:hover{opacity:.85}
.quote-copy[hidden]{display:none}

/* A <dialog>, so Escape, focus trapping and the inert background come from the browser.
   The viewer is deliberately NOT themed: a light backdrop behind a photograph is a worse
   reading of the photograph, and readers expect a lightbox to be dark. */
.lightbox[open]{display:flex}
.lightbox{width:100%;max-width:100%;height:100%;max-height:100%;border:0;overflow:hidden;
  flex-direction:column;align-items:center;justify-content:center;gap:.75rem;padding:1rem;
  background:rgba(0,0,0,.9);color:#fff}
.lightbox::backdrop{background:rgba(0,0,0,.9)}
.lightbox-caption:empty{display:none}
.lightbox-img{max-height:85vh;max-width:100%;object-fit:contain}
.lightbox-caption{max-width:42rem;text-align:center;font-size:var(--fs-small);
  line-height:var(--lh-small);letter-spacing:var(--ls-small);color:rgba(255,255,255,.7);margin:0}
.lightbox button{position:absolute;display:flex;align-items:center;justify-content:center;
  border:0;border-radius:999px;background:transparent;color:rgba(255,255,255,.8);cursor:pointer;line-height:1}
.lightbox button:hover{background:rgba(255,255,255,.1);color:#fff}
.lightbox-close{top:.75rem;right:.75rem;width:2.5rem;height:2.5rem;font-size:1.5rem}
.lightbox-prev,.lightbox-next{top:50%;transform:translateY(-50%);width:3rem;height:3rem;font-size:1.875rem}
.lightbox-prev{left:.5rem}
.lightbox-next{right:.5rem}
.lightbox-count{position:absolute;bottom:1rem;font-size:var(--fs-caption);
  line-height:var(--lh-caption);letter-spacing:var(--ls-caption);
  font-variant-numeric:tabular-nums;color:rgba(255,255,255,.6)}

/* Scroll reveal: a card eases in as it enters the viewport. This is what the owner meant
   by the fade at the foot of the feed going missing - the markup has carried a .reveal
   class since M2 and NO rule ever matched it, so the cards simply appeared.

   GUARDED three ways, exactly as the frozen tree guards it: it may only ever HIDE content
   where it can also reveal it. Needs view() timelines, motion on, and no reduced-motion
   preference; anything else leaves .reveal a normal, fully visible element. There is no
   blank-page failure mode. */
@supports (animation-timeline:view()){
  @media (prefers-reduced-motion:no-preference){
    html[data-motion=on] .reveal{animation:reveal-in linear both;animation-timeline:view();
      /* Finishes in the lower third, where the eye is - not at the very bottom edge. */
      animation-range:entry 0% cover 20%}
  }
}
@keyframes reveal-in{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
/* The same reveal for engines with no view() timeline (Firefox today). Armed by the island
   ONLY on those engines, and only for cards that are not already on screen, so nothing
   above the fold can flash. */
@media (prefers-reduced-motion:no-preference){
  html[data-reveal-js=on] .reveal:not(.is-in){opacity:0;transform:translateY(24px)}
  html[data-reveal-js=on] .reveal{transition:opacity var(--dur-slow) ease,transform var(--dur-slow) ease}
}

/* Chunked feed. The server renders every card, so a reader with no JavaScript gets the
   whole archive and a crawler sees all of it; the island hides what is past the first page
   and hands it back a chunk at a time on scroll. The <noscript> counterpart is emitted with
   the list, so the hiding only ever applies where something can undo it. */
html[data-chunked] .post-list article[data-more]{display:none}

.preview-note{border:1px solid var(--c-rule);background:var(--c-rule);color:var(--c-meta);
  border-radius:.5rem;padding:.5rem 1rem;font-size:var(--fs-small);
  line-height:var(--lh-small);letter-spacing:var(--ls-small);margin:0 0 1.5rem}

/* Two ways to the same place: the reader's system preference, and the owner's Motion
   switch in Settings. The switch had no effect at all until this rule existed. */
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
html[data-motion=off] *{animation:none!important;transition:none!important}
`.trim()
