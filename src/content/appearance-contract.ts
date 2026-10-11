// What custom CSS is allowed to rely on, in ONE place.
//
// This product ships no themes. A reader of `docs/appearance.md` gets 155 knobs and, when
// the knobs run out, their own CSS — so the escape hatch is not a convenience here, it is
// the whole of the answer to "make it look like mine". The doc says so out loud: *"These
// names are part of what the software promises you. They will not be renamed without a note
// in the changelog."*
//
// ⚠️ THAT PROMISE WAS HELD BY NOBODY UNTIL 2026-08-31. Rename a variable or a class and every
// custom stylesheet in the wild breaks on the next update, silently, on somebody else's blog
// — and `check:all` stayed green, because no test and no guard had ever read the list. It is
// the same shape as every other escape found this week: a rule kept by discipline.
//
// So the list lives here rather than in the prose, and three things read it: `check:contract`
// proves every name still exists in the code AND that the doc lists exactly these names, and
// the Custom CSS box offers them to the owner. One list, three readers, no copy to drift.
//
// This module is DATA ONLY — no imports, so the admin bundle can hold it without dragging
// anything server-side across the boundary (`check:bundle`).

/** One promised name, and the one line the owner needs to know what it does. */
export type Promised = { name: string; note: string }

/**
 * Where a promised selector appears: `blog` is the post, the listings, the archive and the
 * other reading pages; `front` is the composed front page (ADR 0014); `shared` is page
 * furniture and small parts that both draw. A stylesheet written for one surface needs to
 * know which names are never emitted on the other.
 */
export type Surface = 'blog' | 'front' | 'shared'
export type PromisedSelector = Promised & { surface: Surface }

/**
 * CSS custom properties any stylesheet may set.
 *
 * Grouped the way the doc groups them, because the Custom CSS box renders them in this
 * order and a reader scanning for "the one that changes the link colour" is scanning a
 * list, not searching it.
 */
export const TYPE_ROLES: [string, string][] = [
  ['h1', 'title'],
  ['h2', 'section heading'],
  ['h3', 'subsection heading'],
  ['h4', 'minor heading'],
  ['h5', 'label heading'],
  
  ['body', 'body'],
  ['small', 'small print'],
  ['caption', 'caption'],
  ['code', 'code'],
]

export const PROMISED_VARS: { group: string; vars: Promised[] }[] = [
  {
    group: 'colour',
    vars: [
      { name: '--c-bg', note: 'page background' },
      { name: '--c-text', note: 'body text' },
      { name: '--c-heading', note: 'headings' },
      { name: '--c-meta', note: 'dates, counts, small print' },
      { name: '--c-link', note: 'links' },
      { name: '--c-accent', note: 'the one accent: active states, markers' },
      { name: '--c-rule', note: 'hairlines and dividers' },
    ],
  },
  {
    group: 'shape',
    vars: [
      { name: '--radius', note: 'corner radius' },
      { name: '--fw-title', note: "the archive heading's weight" },
      { name: '--fw-heading', note: 'the post title, card titles and every bold label' },
      { name: '--density', note: 'multiplies every gap' },
    ],
  },
  {
    group: 'measure',
    vars: [
      { name: '--shell-w', note: 'the reading column' },
      { name: '--sp', note: 'the spacing unit every gap is a multiple of' },
    ],
  },
  {
    group: 'font',
    vars: [
      { name: '--font-reading', note: 'the face of titles, standfirsts and the article body' },
      { name: '--font-sans', note: 'the face of the header, footer, rail, dates and forms' },
      { name: '--font-mono', note: 'the face of code, and only code' },
    ],
  },
  {
    group: 'type',
    // Nine roles, each with the same trio: size, line height, letter spacing. Built from the
    // hand-kept TYPE_ROLES above; `check:contract` compares that list with the engine's
    // (`content/fonts.ts`) and fails when they differ, so a tenth role cannot be forgotten.
    vars: TYPE_ROLES.flatMap(([role, label]) => [
      { name: `--fs-${role}`, note: `${label} size` },
      { name: `--lh-${role}`, note: `${label} line height` },
      { name: `--ls-${role}`, note: `${label} letter spacing` },
    ]),
  },
  {
    group: 'motion',
    vars: [
      // The values are the engine's (web/motion.css.ts); the notes here were 120/200/320 for
      // a month while the sheet said .15s/.2s/.5s, and only the doc read them.
      { name: '--dur-fast', note: '.15s' },
      { name: '--dur-base', note: '.2s' },
      { name: '--dur-slow', note: '.5s' },
      { name: '--ease-out', note: 'the one curve every entrance settles on' },
    ],
  },
]

/**
 * Structure a stylesheet may target, in the order a page uses it, each with the surface that
 * draws it.
 *
 * Everything not on it is internal and may move in any release; the doc says as much, and
 * says that needing one of them usually means a knob is missing. Every name here is emitted
 * by the public markup today, and the check proves it still appears in the code.
 */
export const PROMISED_SELECTORS: PromisedSelector[] = [
  { name: '.wrap', surface: 'shared', note: 'the page shell' },
  { name: 'header.site', surface: 'shared', note: 'the site header' },
  { name: 'footer.site', surface: 'shared', note: 'the site footer' },
  { name: '.rail', surface: 'shared', note: 'the sidebar, and the drawer it becomes on a phone' },
  { name: '.post-list', surface: 'blog', note: 'the list of posts' },
  { name: '.card-thumb', surface: 'blog', note: "a list row's picture" },
  { name: '.post-hero', surface: 'blog', note: 'the picture at the top of an article' },
  { name: '.prose', surface: 'blog', note: 'the article body — everything you wrote' },
  { name: '.deck', surface: 'blog', note: 'the standfirst under a post title' },
  { name: '.author-box', surface: 'blog', note: 'the author box under an article' },
  { name: '.related', surface: 'blog', note: 'the related-posts block' },
  { name: '.read-next-title', surface: 'blog', note: 'the read-next block' },
  { name: '.arc-jump', surface: 'blog', note: "the archive's row of years" },
  { name: '.arc-yr', surface: 'blog', note: "one year's block of archive rows" },
  { name: '.subscribe-card', surface: 'shared', note: 'the newsletter sign-up' },
  { name: '#comments', surface: 'blog', note: 'the comment tree' },
  { name: '.site-bar', surface: 'shared', note: 'the header row: title, menu and buttons' },
  { name: '.site-actions', surface: 'shared', note: "the header's row of buttons" },
  { name: '.site-menu', surface: 'shared', note: 'the menu, in the header or the drawer' },
  { name: '.site-h1', surface: 'shared', note: 'the site title when it is the page heading' },
  { name: '.title', surface: 'shared', note: 'the site title link' },
  { name: '.tagline', surface: 'shared', note: 'the line of text under the site title' },
  { name: '.icon-btn', surface: 'shared', note: 'a round header button: search, theme, palette, sidebar' },
  { name: '.btn-token', surface: 'shared', note: 'the small key-cap label inside a button' },
  { name: '.overlay', surface: 'shared', note: 'the search and sign-up panels that open over the page' },
  { name: '.empty', surface: 'shared', note: 'the message shown in place of an empty list' },
  { name: '.rail-inner', surface: 'shared', note: 'the sidebar column inside the rail' },
  { name: '.rail-row', surface: 'shared', note: 'one link in the rail' },
  { name: '.rail-toggle', surface: 'shared', note: 'the button that opens the sidebar on a phone' },
  { name: '.rail-scrim', surface: 'shared', note: 'the dimmed page behind the open drawer' },
  { name: '.rail-search', surface: 'shared', note: 'the search box at the top of the rail' },
  { name: '.rail-lead', surface: 'blog', note: 'a top-level row in the article contents' },
  { name: '.rail-sub', surface: 'blog', note: 'a nested row in the article contents' },
  { name: '.rail-count', surface: 'blog', note: 'the number beside a rail link' },
  { name: '.rail-tags', surface: 'blog', note: 'the tag cloud in the rail' },
  { name: '.toc', surface: 'blog', note: 'the article contents list' },
  { name: '.toc-end', surface: 'blog', note: 'the last row of the contents, which leads to the end' },
  { name: '.post-info', surface: 'blog', note: "the article's side column of facts" },
  { name: '.info-action', surface: 'blog', note: 'the button row in the side column' },
  { name: '.info-updated', surface: 'blog', note: 'the "updated" line in the side column' },
  { name: '.book-mode-toggle', surface: 'blog', note: 'the button that opens book mode' },
  { name: '.post-meta', surface: 'blog', note: 'the line of date and reading time above a title' },
  { name: '.post-cat', surface: 'blog', note: 'the category link in that line' },
  { name: '.post-facts', surface: 'blog', note: 'the date and reading time in that line' },
  { name: '.post-taxo', surface: 'blog', note: 'the categories and tags after the article' },
  { name: '.taxo-rule', surface: 'blog', note: 'the rule above them' },
  { name: '.term-list', surface: 'blog', note: 'a run of category or tag links' },
  { name: '.card-kick', surface: 'blog', note: 'the category line above a list card title' },
  { name: '.series', surface: 'blog', note: 'the series box above the body' },
  { name: '.series-bar', surface: 'blog', note: 'the progress bar of a series' },
  { name: '.series-head', surface: 'blog', note: 'the heading row of a series box' },
  { name: '.series-name', surface: 'blog', note: 'the series name' },
  { name: '.series-part', surface: 'blog', note: 'the "part N of M" label' },
  { name: '.read-next-label', surface: 'blog', note: 'the small label above read-next' },
  { name: '.reading-font', surface: 'shared', note: 'any title or text set in the reading face' },
  { name: '.t-small', surface: 'shared', note: 'text set in the small role' },
  { name: '.text-meta', surface: 'shared', note: 'text in the meta colour' },
  { name: '.num', surface: 'shared', note: 'a number in a count, such as reading minutes' },
  { name: '.mt-2', surface: 'blog', note: 'the gap between a meta line and the title under it' },
  { name: '.term-count', surface: 'blog', note: 'the count beside a category or tag' },
  { name: '.tl-year-tag', surface: 'blog', note: "a year's tag on the listing timeline" },
  { name: '.tl-mark', surface: 'blog', note: 'a month mark on the listing timeline' },
  { name: '.pager-count', surface: 'blog', note: 'the "page N / M" label' },
  { name: '.chip', surface: 'blog', note: 'one category or series link in the chip row' },
  { name: '.chips', surface: 'blog', note: 'the chip row under the header' },
  { name: '.comment-meta', surface: 'blog', note: 'the name-and-date line of a comment' },
  { name: '.comment-name', surface: 'blog', note: "a commenter's name" },
  { name: '.file-card', surface: 'blog', note: 'a card for a linked file' },
  { name: '.link-card', surface: 'blog', note: 'a card for a linked page' },
  { name: '.shiki', surface: 'blog', note: "a highlighted code block; this is Shiki's markup, so a Shiki upgrade must keep the name" },
  { name: '.line', surface: 'blog', note: "one line inside a highlighted code block (Shiki's markup, kept across upgrades)" },
  { name: '.footnotes', surface: 'blog', note: 'the footnotes list' },
  { name: '.fn-rule', surface: 'blog', note: 'the rule above the footnotes' },
  { name: '.table-scroll', surface: 'blog', note: 'the scrolling frame around a wide table' },
  { name: 'html.dark', surface: 'shared', note: 'the root while the dark scheme is on' },
  { name: '.front', surface: 'front', note: 'the composed front page' },
  { name: '.front-image', surface: 'front', note: 'the front page when it shows pictures' },
  { name: '.front-text', surface: 'front', note: 'the front page when it is text only' },
  { name: '.front-row', surface: 'front', note: 'one band of the front page' },
  { name: '.front-lead-row', surface: 'front', note: 'the band with the lead and the stacked headlines' },
  { name: '.has-kicker', surface: 'front', note: 'on the lead band when the lead prints a category' },
  { name: '.front-head', surface: 'front', note: 'the heading line of a band' },
  { name: '.front-label', surface: 'front', note: 'the heading of a band' },
  { name: '.front-more', surface: 'front', note: 'the "more" link in a band heading' },
  { name: '.front-topics', surface: 'front', note: 'the row of topic links under a band heading' },
  { name: '.front-grid', surface: 'front', note: 'the grid of cards in a band' },
  { name: '.cols-1', surface: 'front', note: 'a grid of one column' },
  { name: '.cols-2', surface: 'front', note: 'a grid of two columns' },
  { name: '.cols-3', surface: 'front', note: 'a grid of three columns' },
  { name: '.front-secondary', surface: 'front', note: 'the headlines stacked beside the lead' },
  { name: '.front-lines', surface: 'front', note: 'a band of headline-only rows' },
  { name: '.fc', surface: 'front', note: 'one front-page item, whatever its shape' },
  { name: '.fc-lead', surface: 'front', note: 'the lead item' },
  { name: '.fc-line', surface: 'front', note: 'a headline-only item' },
  { name: '.has-media', surface: 'front', note: 'on an item that carries a picture' },
  { name: '.fc-media', surface: 'front', note: "an item's picture" },
  { name: '.fc-text', surface: 'front', note: "an item's text column" },
  { name: '.fc-cat', surface: 'front', note: "an item's category line" },
  { name: '.fc-title', surface: 'front', note: "an item's headline" },
  { name: '.fc-deck', surface: 'front', note: "an item's standfirst" },
  { name: '.fc-intro', surface: 'front', note: "the lead's longer introduction" },
  { name: '.fc-meta', surface: 'front', note: "an item's date and reading time" },
]

/**
 * The `data-*` attributes custom CSS may select on, written on `<html>`. Values are the ones
 * the code writes; an absent attribute is a state too.
 */
export const PROMISED_ATTRIBUTES: Promised[] = [
  { name: 'data-palette', note: 'the active palette id: mono, sepia, forest, ocean, scifi or amber' },
  { name: 'data-scheme', note: 'the resolved scheme, light or dark; absent until the page script runs' },
  { name: 'data-look', note: 'the look: code, paper or notes; absent on the plain look' },
  { name: 'data-list', note: 'the listing layout the reader chose, list or grid' },
  { name: 'data-motion', note: 'on or off: whether animation is enabled' },
]

/** Every promised name, flat — what the guard walks. */
export const PROMISED_NAMES: string[] = [
  ...PROMISED_VARS.flatMap((g) => g.vars.map((v) => v.name)),
  ...PROMISED_SELECTORS.map((s) => s.name),
  ...PROMISED_ATTRIBUTES.map((a) => a.name),
]
