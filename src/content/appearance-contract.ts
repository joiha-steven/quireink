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
 * CSS custom properties any stylesheet may set.
 *
 * Grouped the way the doc groups them, because the Custom CSS box renders them in this
 * order and a reader scanning for "the one that changes the link colour" is scanning a
 * list, not searching it.
 */
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
      { name: '--fw-title', note: "the post title's weight" },
      { name: '--fw-heading', note: 'card titles, related, read-next' },
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
    group: 'type',
    vars: [
      // Nine roles, each with the same trio. Only the two a reader is most likely to reach
      // for are listed by name — h1 and body — because offering twenty-seven rows here would
      // bury the four above them. The doc says the pattern; this says where to start.
      { name: '--fs-h1', note: 'title size' },
      { name: '--lh-h1', note: 'title line height' },
      { name: '--ls-h1', note: 'title letter spacing' },
      { name: '--fs-body', note: 'body size' },
      { name: '--lh-body', note: 'body line height' },
      { name: '--ls-body', note: 'body letter spacing' },
    ],
  },
  {
    group: 'motion',
    vars: [
      { name: '--dur-fast', note: '120ms' },
      { name: '--dur-base', note: '200ms' },
      { name: '--dur-slow', note: '320ms' },
    ],
  },
]

/**
 * Structure a stylesheet may target, in the order a page uses it.
 *
 * Deliberately short. Everything not on it is internal and may move in any release; the doc
 * says as much, and says that needing one of them usually means a knob is missing.
 */
export const PROMISED_SELECTORS: Promised[] = [
  { name: '.wrap', note: 'the page shell' },
  { name: 'header.site', note: 'the site header' },
  { name: 'footer.site', note: 'the site footer' },
  { name: '.rail', note: 'the sidebar, and the drawer it becomes on a phone' },
  { name: '.post-list', note: 'the list of posts' },
  { name: '.card-thumb', note: "a list row's picture" },
  { name: '.post-hero', note: 'the picture at the top of an article' },
  { name: '.prose', note: 'the article body — everything you wrote' },
  { name: '.deck', note: 'the standfirst under a post title' },
  { name: '.author-box', note: 'the author box under an article' },
  { name: '.related', note: 'the related-posts block' },
  { name: '.read-next-title', note: 'the read-next block' },
  { name: '.arc-jump', note: "the archive's row of years" },
  { name: '.arc-yr', note: "one year's block of archive rows" },
  { name: '.subscribe-card', note: 'the newsletter sign-up' },
  { name: '#comments', note: 'the comment tree' },
]

/** Every promised name, flat — what the guard walks. */
export const PROMISED_NAMES: string[] = [
  ...PROMISED_VARS.flatMap((g) => g.vars.map((v) => v.name)),
  ...PROMISED_SELECTORS.map((s) => s.name),
]
