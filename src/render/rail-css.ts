// Rail geometry as CSS strings, injected at runtime because a media query can't read a
// CSS variable — the breakpoint is COMPUTED from the reading-column width. Shared by the
// blog layout (single left ToC rail, post/default width) and the listing sidebar (TWO
// rails + a narrower column). Keep in sync with globals.css `.rail` base + `--rail-*`.
//
// The column width is exposed as `--shell-w` (the layout's shell reads it, falling back to
// the owner's contentWidth). Listing pages set a narrower `--shell-w` AND emit the two-rail
// rules; because those use the higher-specificity `.rail.rail-left` / `.rail.rail-right`
// selectors, they win over the layout's single-rail `.rail` rules with no ordering games.

// THE DIVIDERS SIT BEHIND (z-index:-1). Each is a pseudo-element of `.rail`, so it paints
// AFTER the rail's own children — and a marker inside cannot climb over it, because
// `.rail-inner` is position:sticky and therefore a stacking context that traps any
// z-index below it. The IDE chrome's numbered rings sit ON this line, and without this
// the hairline drew straight through every one of them. Same shape of bug as the feed's
// spine over the month dots, same fix.
export const RAIL_W = 250
export const RAIL_GAP = 40
export const RAIL_PAD = 14
export const RAIL_BREATHING = 10 // clear space between a rail and the viewport edge

// Viewport width at which BOTH gutters can hold a rail (keeps the column centred).
function breakpoint(colWidth: number): number {
  return colWidth + 2 * (RAIL_W + RAIL_GAP + RAIL_BREATHING)
}

const DIVIDER = (RAIL_GAP - RAIL_PAD) / 2
const GUTTER =
  'position:absolute;inset:auto auto auto auto;top:var(--rail-top);width:var(--rail-w);' +
  // visibility:visible undoes the closed-drawer rule in rail.css.ts: in the gutter the rail is
  // always open, and without this the promoted rail would be invisible above the breakpoint.
  'height:calc(100% - var(--rail-top));padding:0;background:none;border:0;overflow:visible;transform:none;display:block;visibility:visible'
const INNER =
  '.rail-inner{max-height:calc(100dvh - 2.5rem - 1.5rem);overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin}'

// Single left-gutter rail (post ToC + the default). Text ranged RIGHT toward the column;
// the freed right gutter lets a "large" image nose right by one rail width.
export function singleRailCss(colWidth: number): string {
  const at = breakpoint(colWidth)
  return (
    `@media (min-width:${at}px){` +
    `.rail{${GUTTER};right:calc(100% + var(--rail-gap));left:auto;text-align:right}` +
    `.rail::after{content:"";position:absolute;top:0;bottom:0;right:-${DIVIDER}px;width:1px;background:var(--c-rule);z-index:-1}` +
    INNER +
    `.rail h2,.rail .rail-tags{padding-left:0;padding-right:var(--rail-pad)}` +
    `.rail .rail-tags{justify-content:flex-end}` +
    `.rail li a{justify-content:flex-end}` +
    `.rail-row{padding-left:0;padding-right:var(--rail-pad)}` +
    `.rail-row[aria-current]::after{left:auto;right:0}` +
    `.rail-toggle,.rail-scrim{display:none}` +
    // The post info panel takes the right gutter: the date, the length, the way into book
    // mode and the taxonomy, one fact per line. It is NOT sticky and its inner box does not
    // scroll — it stands at the top of the article and leaves with it. A sticky panel would
    // ride down the gutter and sit on top of the wide images below, which nose out into
    // that same gutter by one rail width (the rule right underneath this one).
    `.post-info{${GUTTER};left:calc(100% + var(--rail-gap));right:auto;text-align:left;` +
    `padding-left:var(--rail-pad);height:auto}` +
    `.post-info::after{content:"";position:absolute;top:0;bottom:0;left:-${DIVIDER}px;width:1px;background:var(--c-rule);z-index:-1}` +
    // A node ON that divider, level with the panel's first line. The hairline is --c-rule,
    // which measures 1.16:1 against the page and all but disappears over a run this short;
    // the feed's timeline answers exactly that with a dot, so both gutters now speak the
    // same language. Centred on the 1px line: half the dot back from the line's own centre.
    `.post-info::before{content:"";position:absolute;left:-${DIVIDER + 3}px;top:.5em;` +
    `width:7px;height:7px;border-radius:50%;background:var(--c-meta)}` +
    // A SECOND node on the same divider, level with the action row. The panel is a column of
    // facts and then one row that DOES something, and it is already set apart by space alone;
    // the dot is what says the gap is deliberate rather than a rhythm that slipped.
    //
    // ::after, NOT ::before: the IDE chrome puts its `//` marker on this row's ::before, and
    // two marks fighting over one pseudo-element is a bug this project has already shipped
    // once, on the rail rows. The offset carries `--rail-pad` because this dot is positioned
    // against the ROW, which starts at the panel's content edge, where the panel's own dot is
    // positioned against the panel and starts at its padding edge.
    `.post-info .info-action{position:relative}` +
    `.post-info .info-action::after{content:"";position:absolute;` +
    `left:calc(-${DIVIDER + 3}px - var(--rail-pad));top:.5em;` +
    `width:7px;height:7px;border-radius:50%;background:var(--c-meta)}` +
    // Exactly one copy of these facts has a box at any width. Below this breakpoint there is
    // no gutter, the panel is display:none, and the meta line above the title plus the
    // taxonomy over its rule are what the reader gets, unchanged.
    `.post-meta,.taxo-rule,.post-taxo{display:none}` +
    // ...and with the meta line gone, the title's 8px top margin is spacing it away from
    // nothing. That was the three columns not lining up: both rails start their first line
    // at the same y and the title sat 8px below them. Measured, then re-measured.
    `article > header .mt-2{margin-top:0}` +
    // A "wide" image or video noses right into the freed gutter by one rail width.
    `.prose figure.img-wide,.prose .video-wide{width:calc(100% + var(--rail-w) + var(--rail-gap));max-width:none;margin-left:0;` +
    `margin-right:calc(-1 * (var(--rail-w) + var(--rail-gap)))}` +
    // ...except in the first two blocks, which are level with the info panel. The gutter
    // cannot hold both, and a photograph with "Tags: [x]" printed across it is the worse of
    // the two failures. MEASURED, not guessed: a post opening on a #wide image put the
    // panel's last two rows inside the picture. Two blocks rather than one because the
    // panel is up to six rows and the header is only the h1 when the deck is switched off,
    // which puts the SECOND block level with it too.
    `.prose > :is(figure.img-wide,.video-wide):nth-child(-n+2){width:100%;margin-right:0}}`
  )
}

// Infinite-scroll timeline. NOT a boxed rail: a spine runs the full height of the feed in
// the RIGHT gutter, and each year's marker is absolutely positioned beside the FIRST post
// of that year — so the years line up with the posts on the left and the whole thing scrolls
// with the page, with no JS and no measurement (the marker flows with its card). Desktop
// only: below the breakpoint there is no gutter, so markers + spine are hidden.
export function timelineCss(colWidth: number): string {
  // A short date label needs far less gutter than a full 250px rail, so the timeline
  // appears at a MUCH lower width than the sidebar breakpoint — a right gutter wide enough
  // for the gap + a "September"/"Tháng 12" label (~130px), so it shows on normal laptops.
  const at = colWidth + 2 * (RAIL_GAP + 130)
  return (
    `.tl-mark,.tl-year{display:none}` +
    `@media (min-width:${at}px){` +
    // Spine: a hairline down the right gutter, exactly as tall as the post list — the same
    // faint `--c-rule` as the sidebar dividers. The dots + year give it presence.
    //
    // BEHIND everything, and it has to be said explicitly. The spine is a pseudo-element of
    // the LIST, so it paints after the list's children — and a month marker cannot climb over
    // it with z-index, because `.reveal` runs a card-in animation on each `article`, which
    // makes the article a stacking context and traps the marker's z-index inside it. So the
    // hairline ran straight through every month dot, cutting it in half. Measured 2026-07-29.
    `.post-list{position:relative}` +
    `.post-list::after{content:"";position:absolute;top:0;bottom:0;left:calc(100% + var(--rail-gap) + 4px);width:1px;background:var(--c-rule);z-index:-1}` +
    // Month marker: a child of a month's first card, anchored to the card top out in the gutter.
    `.post-list article{position:relative}` +
    `.post-list article .tl-mark{display:flex;position:absolute;top:0;left:calc(100% + var(--rail-gap));width:max-content;max-width:var(--rail-w)}` +
    // Year header: STICKY. A 0-size positioning anchor in the gutter (reserves no space); the
    // visible `.tl-year-tag` hangs from it, pinned to the top while its year's posts scroll, then
    // the next year's group pushes it out. z-index above the month markers so its bg masks them.
    // top:2.5rem matches the left sidebar's sticky offset (`.rail-inner`), so the pinned year
    // lines up with the left rail's first line.
    `.tl-year{display:block;position:sticky;top:2.5rem;height:0;width:0;margin-left:calc(100% + var(--rail-gap));z-index:2}` +
    `.tl-year-tag{display:flex;position:absolute;top:-0.1em;left:0}` +
    // Grid view is an alternate layout (cards in 2 columns) — the gutter timeline can't align, so drop it.
    `html[data-list=grid] .post-list::after,html[data-list=grid] .tl-mark,html[data-list=grid] .tl-year{display:none}}`
  )
}

// Grid mode for a listing page (header toggle → <html data-list=grid>) needs no extra CSS:
// the base 1/2-column grid (globals.css) applies at every width, in-column, so the grid keeps
// the same reading-column width as the list and caps at 2 columns. No gutter widening, no
// 3-column desktop layout, no rail hiding.

// Two rails for listing pages: LEFT (discovery, ranged right toward the column) + RIGHT
// (nav, mirrored: ranged left toward the column, divider + marker on the left). Also sets
// the narrower `--shell-w` and hides the drawer-only duplicate above the breakpoint.
export function listingRailCss(colWidth: number): string {
  const at = breakpoint(colWidth)
  return (
    `:root{--shell-w:${colWidth}px}` +
    `@media (min-width:${at}px){` +
    // Left rail — discovery.
    `.rail.rail-left{${GUTTER};right:calc(100% + var(--rail-gap));left:auto;text-align:right}` +
    `.rail.rail-left::after{content:"";position:absolute;top:0;bottom:0;right:-${DIVIDER}px;width:1px;background:var(--c-rule);z-index:-1}` +
    `.rail.rail-left h2,.rail.rail-left .rail-tags{padding-left:0;padding-right:var(--rail-pad)}` +
    `.rail.rail-left .rail-tags{justify-content:flex-end}` +
    `.rail.rail-left li a{justify-content:flex-end}` +
    `.rail.rail-left .rail-row{padding-left:0;padding-right:var(--rail-pad)}` +
    `.rail.rail-left .rail-row[aria-current]::after{left:auto;right:0}` +
    // Right rail — nav, mirrored.
    `.rail.rail-right{${GUTTER};left:calc(100% + var(--rail-gap));right:auto;text-align:left}` +
    `.rail.rail-right::after{content:"";position:absolute;top:0;bottom:0;left:-${DIVIDER}px;width:1px;background:var(--c-rule);z-index:-1}` +
    `.rail.rail-right h2,.rail.rail-right .rail-tags{padding-right:0;padding-left:var(--rail-pad)}` +
    `.rail.rail-right .rail-tags{justify-content:flex-start}` +
    `.rail.rail-right li a{justify-content:flex-start}` +
    `.rail.rail-right .rail-row{padding-right:0;padding-left:var(--rail-pad)}` +
    `.rail.rail-right .rail-row[aria-current]::after{right:auto;left:0}` +
    INNER +
    `.drawer-only{display:none}` +
    `.rail-toggle,.rail-scrim{display:none}}`
  )
}
