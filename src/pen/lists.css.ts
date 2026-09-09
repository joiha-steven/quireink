// The pen at the head of a list: ink dots, level dashes, and numerals in a hand.
//
// Rides in the always-loaded prose sheet (`web/prose.css.ts`) rather than in the two pen
// sheets, because a list is on most pages and the whole of this is a dozen tiny masks and
// one 1.4 KB font face that only downloads when a numbered list is on the page — the browser
// fetches a face the first time a glyph needs it, so no page detection is required.
//
// The marks are MASKS painted in currentColor, so they are in the ink of the words beside
// them on every palette and in both modes (`dies-lists.ts` has the argument). That is also
// what keeps this sheet inside the colour rule: no pigment appears here at all.
//
// Two lists keep their own marker: a task item (`li.task`, stamped by the renderer round a
// GFM checkbox) and the editor's task list (`ul[data-type=taskList]`). And an ordered list
// that STARTS somewhere other than 1 keeps the browser's numbering, because a CSS counter
// cannot read the `start` attribute on every browser this site supports.
//
// The owner can turn the whole thing off (`features.penLists`); the off path lives in
// `web/layout.ts` and restores the disc and the decimal, on the same no-bytes-when-default
// bargain as the other gestures.

import { DASH_MASKS, DOT_MASKS, NUMERAL_LEANS } from '@/pen/dies-lists'

const dots = () => DOT_MASKS
  .map((m, i) => `.prose ul>li:nth-child(${DOT_MASKS.length}n+${i + 1})::before{--pen-mark:${m}}`)
  .join('\n')

const dashes = () => DASH_MASKS
  .map((m, i) => `.prose ul ul>li:nth-child(${DASH_MASKS.length}n+${i + 1})::before{--pen-mark:${m}}`)
  .join('\n')

const leans = () => NUMERAL_LEANS
  .map((l, i) => `.prose ol>li:nth-child(${NUMERAL_LEANS.length}n+${i + 1})::before`
    + `{transform:rotate(${l.rot}deg) translate(${l.dx}px,${l.dy}px)}`)
  .join('\n')

export const LISTS_INK_CSS = `
/* The numerals: ten digits and a full stop of Kalam, self-hosted like every other face,
   and declared here so that it is fetched only when a numbered list puts a glyph on the page. */
@font-face{font-family:'Kalam Digits';src:url(/fonts/kalam-digits.woff2) format('woff2');
  font-weight:400;font-style:normal;font-display:swap;unicode-range:U+0030-0039,U+002E}
/* A list keeps the browser's marker OFF and draws its own before each item. The mark is a
   mask painted in the text colour, so one shape serves every palette in both modes. */
.prose ul{list-style:none;padding-left:1.5em}
.prose ol{list-style:none;padding-left:1.7em;counter-reset:pen-n}
.prose li{position:relative}
.prose ul>li::before{content:'';position:absolute;left:-1.38em;top:.5em;width:.6em;height:.6em;
  background:currentColor;
  -webkit-mask:var(--pen-mark) center/contain no-repeat;mask:var(--pen-mark) center/contain no-repeat}
${dots()}
/* A level down, a short dash — as a person writes a sub-point. */
.prose ul ul>li::before{width:.7em;height:.6em;left:-1.42em}
${dashes()}
/* The numbered list counts in the hand's numerals, each with its own small lean. The face
   takes the reading size as it is: a literal here would cut the numeral loose from the
   owner's type setting. */
.prose ol>li{counter-increment:pen-n}
.prose ol>li::before{content:counter(pen-n) '.';position:absolute;left:-1.75em;top:0;width:1.4em;
  text-align:right;font-family:'Kalam Digits',var(--font-reading);font-weight:400;
  font-style:normal;line-height:inherit;transform-origin:center}
${leans()}
/* What keeps its own marker: a task item, the editor's task list, and a list that starts
   past 1. */
.prose li.task::before,.prose ul[data-type=taskList]>li::before{content:none}
.prose ol[start]{list-style:decimal;padding-left:1.4em}
.prose ol[start]>li::before{content:none}
`.trim()

/** The off path: the browser's disc and decimal back, and nothing drawn before an item. */
export const LISTS_PLAIN_CSS = '.prose ul{list-style:disc;padding-left:1.4em}'
  + '.prose ol{list-style:decimal;padding-left:1.4em}'
  + '.prose ul>li::before,.prose ol>li::before{content:none}'
