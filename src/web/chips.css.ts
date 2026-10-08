// The chip row's rules (chips.ts).
//
// The fixed half is in the hashed public sheet (`CHIPS_CSS`), and so is the band for a fresh
// install's column. Only an owner who has moved `contentWidth` pays for an inline `@media`,
// because the band's upper edge is the rail's breakpoint, which is computed from the column
// and cannot be read from a variable (the same arrangement as `rail-css.ts`). The look's own
// rules are in the `look-*.css.ts` sheets.
//
// One row, in reading order, scrolling sideways when it is too long. Its far edge fades, and
// the row carries as much trailing padding as the fade is wide: the last chip rests clear of
// the fade at the end of the scroll, and `scroll-padding-inline-end` keeps a chip reached by
// Tab out of it too.
//
// NO BACKTICKS anywhere below: this is one template literal and a backtick ends it.

import { breakpoint, DEFAULT_RAIL_WIDTH } from '@/render/rail-css'

/** Below this the drawer is the way in; from the rail's breakpoint up the rail is. */
const FROM = '40rem'

/** The band: the one place the row is shown. */
const band = (at: number): string =>
  `@media (min-width:${FROM}) and (max-width:${at - 1}px){.chips{display:flex}}`

/** For a column other than the default: put the sheet's band away, then draw this one. */
export function chipsBandCss(colWidth: number): string {
  if (colWidth === DEFAULT_RAIL_WIDTH) return ''
  return `@media (min-width:${FROM}){html .chips{display:none}}` +
    band(breakpoint(colWidth)).replace('.chips{', 'html .chips{')
}

export const CHIPS_CSS = `
.chips{display:none;gap:.5rem;margin-top:1rem;overflow-x:auto;overflow-y:hidden;
  padding-inline-end:2.5rem;scroll-padding-inline-end:2.5rem;scrollbar-width:none;
  overscroll-behavior-x:contain;
  -webkit-mask-image:linear-gradient(to right,var(--c-text) calc(100% - 2.5rem),transparent);
  mask-image:linear-gradient(to right,var(--c-text) calc(100% - 2.5rem),transparent)}
.chips::-webkit-scrollbar{display:none}
.chips .chip{flex:none;display:inline-flex;align-items:center;box-sizing:border-box;height:2.25rem;
  padding:0 .875rem;border:1px solid var(--c-rule);border-radius:999px;color:var(--c-text);
  text-decoration:none;white-space:nowrap;font-size:var(--fs-small);line-height:var(--lh-small);
  letter-spacing:var(--ls-small)}
.chips .chip:hover{border-color:var(--c-meta);color:var(--c-heading)}
.chips .chip:focus-visible{outline-offset:-2px}
/* The press every key on this site has, carved and not moved: a chip in a row that scrolls
   sideways should not shift under the finger. The current chip is made of the heading ink,
   so it is carved in the paper. */
.chips .chip:active{box-shadow:inset 0 1.5px 2.5px color-mix(in srgb,var(--c-heading) 22%,transparent)}
.chips .chip[aria-current]:active{box-shadow:inset 0 1.5px 2.5px color-mix(in srgb,var(--c-bg) 40%,transparent)}
.chips .chip[aria-current]{background:var(--c-heading);border-color:var(--c-heading);
  color:var(--c-bg);font-weight:500}
${band(breakpoint(DEFAULT_RAIL_WIDTH))}
`
