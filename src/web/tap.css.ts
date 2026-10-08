// A finger or a pointer needs 24 by 24 CSS px to land on a link (WCAG 2.5.8), and the small
// text links of an article are 19 to 23px tall: the line box of a 14px role. Measured at 375
// and 768 in all four looks: the kicker on a listing card, the parts of a series, the related
// and latest lists, the author's name, the series name, the byline, the category above a
// title and the 404's "Back home".
//
// The HIT AREA grows and nothing else does. Padding on an inline link adds to the box that
// takes the click, not to the line box, so the lines, the baselines and the vertical rhythm
// stay exactly where they were; on a link that is a block (the category on a phone) the
// equal negative margin gives the padding back. 0.25em a side on a 19px box makes 26px, and
// every list these sit in keeps at least 0.65rem between its rows, so two neighbours never
// overlap. This sheet sits BEFORE the coarse
// pointer's 44px (FIXLIST 7.10) in mobile.css.ts so that, where both match, the larger wins.
//
// NO BACKTICKS anywhere below: check:css-literal enforces that.

export const TAP_CSS = `
@media (max-width:48rem){
.card-kick a,aside.series li a,aside.series .series-name a,.related li a,.author-name a,
.byline a,a.post-cat,p.mt-3 > a{padding-block:.25em;margin-block:-.25em}
}
`.trim()
