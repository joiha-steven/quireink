// The source-code dialect's two pieces that cannot live in its sheet (`look-code.css.ts`).
//
// Both sit inside a media query whose bound is computed from the reading column, and a static
// sheet has no width to compute it from. So the theme registry (`content/themes-builtin.ts`)
// hands them to `railThemeCss` (`render/rail-css.ts`), which wraps them in the queries this
// blog's column makes and inlines them. They used to be written inside that function, behind a
// comparison with this dialect's name. Their own file because the sheet sits at the 400-line
// ceiling.
//
// NO BACKTICKS anywhere below: each is one template literal and a backtick ends it.
// `check:css-literal` enforces that for the first.

/*
 * THE BAND, where the rail runs across the page above the column:
 *  - The menu's heading needs the marker every other chrome label carries, and it cannot get
 *    it from the sheet the way they do: the sheet marks `.rail h2::before`, this heading is not
 *    an h2, and its own ::before is already spoken for by the label. Without it the menu's
 *    heading stood bare directly above a marked "// Contents": two chrome headings, one
 *    screen, two registers (measured at 1180 on 2026-09-12).
 *  - And no line numbers on the menu there. In the gutter they stand in a column of their own
 *    out past the text, which is what a line number is. In the band there is no gutter: the
 *    ring lands INSIDE the 24px between two menu words, three pixels from each, and the row
 *    reads as one run-on string. The index keeps its numbers, because there each entry is a
 *    line of its own and the number falls at the end of it.
 */
export const LOOK_CODE_RAIL_BAND_CSS = `
html[data-look=code] .rail-inner > nav:not(.toc)::before{content:"// " attr(aria-label)}html[data-look=code] .rail-inner > nav:not(.toc) li::before{content:none}
`.trim()

/*
 * THE LISTING'S RIGHT RAIL, mirrored. The rings, the overhang that keeps them from being
 * clipped and the scrollbar's lane are all written for a rail in the LEFT gutter, so they hang
 * off its right edge, which on the right rail is the viewport's. Here they hang off the left
 * edge, on that rail's own divider, and the scrollbar keeps the default far side.
 */
export const LOOK_CODE_RAIL_ASIDE_CSS = `
html[data-look=code] .rail-aside .rail-inner{direction:ltr;width:calc(100% + var(--rail-gap));margin-left:calc(-1 * var(--rail-gap));padding:0 12px 0 var(--rail-gap)}html[data-look=code] .rail-aside li::before{right:auto;left:-21.5px}html[data-look=code] .rail-aside .rail-row[aria-current]::after{right:auto;left:3px}
`.trim()
