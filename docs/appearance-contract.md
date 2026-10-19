# The appearance contract

The names a stylesheet may rely on: your own CSS in **Appearance → Custom CSS**
([Making it look like yours](appearance.md#when-the-knobs-are-not-enough-your-own-css)) and the
sheet of a theme installed from a zip, which the install-time checker holds to exactly these
names ([Installing a theme](theme-install-api.md)). The list itself lives in
[`src/content/appearance-contract.ts`](../src/content/appearance-contract.ts); `check:contract`
fails the build when this page and that file disagree, or when a name is no longer drawn.

### The variables that are safe to set

These names are part of what the software promises you. They will not be renamed without a
note in the changelog. Since 2026-08-31 `check:contract` fails the build if this list and
`src/content/appearance-contract.ts` disagree in either direction.

**You do not have to come here for them.** The Custom CSS box lists every variable and class name below (not the
attributes), with one line of explanation each; clicking one writes it where your cursor is.

```css
:root {
  /* Colour — every one of these already changes with the palette, so set them only
     when you want something the six palettes do not offer. */
  --c-bg:      #fcfcfc;  /* page background */
  --c-text:    #2e2e2e;  /* body text */
  --c-heading: #121212;  /* headings */
  --c-meta:    #6d6d6d;  /* dates, counts, small print */
  --c-link:    #121212;  /* links */
  --c-accent:  #121212;  /* the one accent: active states, markers */
  --c-rule:    #ebebeb;  /* hairlines and dividers */

  /* Shape */
  --radius:      .5rem;  /* corner radius (Shape sets this; override for a value between) */
  --fw-title:    700;    /* the archive heading's weight */
  --fw-heading:  600;    /* the post title, card titles and every bold label */
  --density:     1;      /* multiplies every gap; Shape sets .82 / 1 / 1.22 */

  /* Measure */
  --shell-w:      672px; /* the reading column (Content width sets this) */
  --sp:           1rem;  /* the spacing unit every gap is a multiple of */
  --rail-gap:     40px;  /* the gap between the sidebar and the reading column, where a sidebar stands beside it */

  /* Fonts — the faces behind every role below */
  --font-reading: var(--font-sans);  /* titles, standfirsts, the article body */
  --font-sans:    'Inter', system-ui, sans-serif;  /* header, footer, rail, dates, forms */
  --font-mono:    'JetBrains Mono', ui-monospace, monospace;  /* code, and only code */
  --font-display: var(--font-reading);  /* the theme's headline face; Newspaper's is Source Serif 4 */

  /* Labels — words a theme prints through content:, written per page in your blog's
     language. Newspaper puts them in front of its figure and table numbers. */
  --l-figure: "Fig.";  --l-table: "Table";

  /* Type — nine roles (h1 h2 h3 h4 h5 body small caption code); each has a size, a line
     height and a letter spacing. These are the defaults; the Text sizes card sets them. */
  --fs-h1: 2rem;       --lh-h1: 1.2;     --ls-h1: -0.02em;
  --fs-h2: 1.5rem;     --lh-h2: 1.27;    --ls-h2: -0.015em;
  --fs-h3: 1.25rem;    --lh-h3: 1.35;    --ls-h3: -0.01em;
  --fs-h4: 1.15rem;    --lh-h4: 1.45;    --ls-h4: -0.006em;
  --fs-h5: 1rem;       --lh-h5: 1.5;     --ls-h5: 0em;
  --fs-body: 1.125rem; --lh-body: 1.7;   --ls-body: 0em;
  --fs-small: .9375rem; --lh-small: 1.6; --ls-small: 0em;
  --fs-caption: .875rem; --lh-caption: 1.5; --ls-caption: .003em;
  --fs-code: .875rem;  --lh-code: 1.6;   --ls-code: 0em;

  /* Motion */
  --dur-fast: .15s;  --dur-base: .2s;  --dur-slow: .5s;  --ease-out: cubic-bezier(.2,.7,.3,1);
}
```

**Dark mode.** Set a variable on `:root` and it applies in both schemes. To change only one,
scope it:

```css
:root[data-scheme="dark"] { --c-bg: #0b0b0c; }
```

### The class names that are safe to target

Structure that is part of the contract, in the order a page uses it. The last column says
where a name is drawn: **blog** is the post, the listings, the archive and the other reading
pages, **front** is the composed front page, **both** is furniture the two share.

| Class | What it is | Where |
|---|---|---|
| `.wrap` | The page shell | both |
| `header.site` / `footer.site` | The site header and footer | both |
| `.site-bar` `.site-actions` | The header row, and its row of buttons | both |
| `.site-menu` `.site-h1` `.title` `.tagline` | The menu, the title as the page heading, the title link, the line under it | both |
| `.icon-btn` `.btn-token` | A round header button, and the key-cap label inside one | both |
| `.overlay` | The search and sign-up panels that open over the page | both |
| `.empty` | The message in place of an empty list | both |
| `.rail` | The sidebar, and the drawer it becomes on a phone | both |
| `.rail-inner` `.rail-row` `.rail-search` | The column inside the rail, one link, the search box | both |
| `.rail-menu-copy` `.rail-menu-only` | The rail's copy of the menu when the header holds it (a theme whose manifest asks for the menu in the header, as Newspaper does, or a page with no rail of its own), and a rail holding nothing but that copy, with the button that opens it. From 60rem up the header shows the menu and none of them is drawn; below that the copy is the drawer's | both |
| `.rail-toggle` `.rail-scrim` | The phone button that opens the drawer, and the dimmed page behind it | both |
| `.rail-lead` `.rail-sub` `.rail-count` `.rail-tags` | Rows of the article contents, the number beside a link, the tag cloud | blog |
| `.toc` `.toc-end` | The article contents, and its last row | blog |
| `.listing-head` | The heading block of a list page (a category, tag, series or search page, the archive, the notes, a 404), whose `h1` is the page's title. The home page has none: its title is the site's name, or the lead row's | blog |
| `.post-list` / `.post-list article` | The list of posts, and one row of it | blog |
| `.card-thumb` `.card-kick` | A list row's picture, and its category line | blog |
| `.card-exc` `.card-meta` | A list row's excerpt, and its date and reading time | blog |
| `.post-hero` | The picture at the top of an article | blog |
| `.prose` | The article body — everything you wrote lives inside this | blog |
| `.deck` | The standfirst under a post title | blog |
| `.post-meta` `.post-cat` `.post-facts` | The line above a title: category, date, reading time | blog |
| `.post-info` `.info-action` `.info-updated` `.book-mode-toggle` | The article's side column, its button row and "updated" line, the book-mode button | blog |
| `.post-taxo` `.taxo-rule` `.term-list` `.term-count` | The categories and tags after an article, the rule above them, a run of term links, the count beside one | blog |
| `.series` `.series-bar` `.series-head` `.series-name` `.series-part` | The series box and its parts | blog |
| `.author-box` | The author box under an article | blog |
| `.related` / `.read-next-title` `.read-next-label` | The blocks at the end of an article | blog |
| `.arc-jump` / `.arc-yr` | The archive's row of years, and one year's block of rows | blog |
| `.tl-year-tag` `.tl-mark` `.pager-count` | The timeline's year and month marks, and the "page N / M" label | blog |
| `.tl-yr` | One year's group of rows on the timeline | blog |
| `.note-source` | A note's source line: where the quoted words come from | blog |
| `.chips` `.chip` | The chip row of categories and series, and one link in it | blog |
| `.file-card` `.link-card` | The cards for a linked file or page | blog |
| `.footnotes` `.fn-rule` `.table-scroll` | The footnotes list and its rule, the frame around a wide table | blog |
| `.shiki` `.line` | A highlighted code block (`pre.shiki`) and one line in it. This is Shiki's own markup; an upgrade keeps both names | blog |
| `.subscribe-card` | The newsletter sign-up, which the header's mail button also opens | both |
| `#comments` `.comment-meta` `.comment-name` | The comment tree, a comment's name-and-date line, a name | blog |
| `.reading-font` `.t-small` `.text-meta` `.num` | Text in the reading face, the small role, the meta colour, and a count's number | both |
| `.mt-2` | The gap under a meta line, above a title | blog |
| `html.dark` | The root while the dark scheme is on | both |

The composed front page ([ADR 0014](decisions/0014-homepage-modes.md)) is one `.front` holding
bands, and each band holds items:

| Class | What it is | Where |
|---|---|---|
| `.front` | The composed front page | front |
| `.front-image` / `.front-text` | The same, when it shows pictures, or is text only | front |
| `.front-row` | One band | front |
| `.front-lead-row` / `.has-kicker` | The band with the lead and the headlines beside it, and the same when the lead prints a category | front |
| `.front-head` `.front-label` `.front-more` `.front-topics` | A band's heading line, its title, its "more" link, and a row of topic links | front |
| `.front-grid` with `.cols-1` `.cols-2` `.cols-3` | A band's grid of cards, and how many columns it has | front |
| `.front-secondary` `.front-lines` | A stack of headlines beside the lead, and a band of headline-only rows | front |
| `.fc` | One item, whatever its shape | front |
| `.fc-lead` `.fc-line` | The lead item, and a headline-only item | front |
| `.has-media` | An item that carries a picture | front |
| `.fc-media` `.fc-text` | An item's picture and its text column | front |
| `.fc-cat` `.fc-title` `.fc-deck` `.fc-intro` `.fc-meta` | An item's category line, headline, standfirst, the lead's longer introduction, and its date and reading time | front |

### The attributes that are safe to select on

Written on `<html>`, so a rule can change with the palette, the scheme or the theme:

| Attribute | Values |
|---|---|
| `data-palette` | The palette id: `mono`, `sepia`, `forest`, `ocean`, `scifi`, `amber`, or the id of an installed theme's palette; only present when the blog offers two or more palettes |
| `data-scheme` | `light` or `dark`, once the page script has resolved it (`:root[data-scheme="dark"]`) |
| `data-theme` | The theme: `plain`, `code`, `paper`, `notes`, or the id of a theme installed from a zip; on every page, plain included |
| `data-look` | `code`, `paper` or `notes`; absent on the plain look |
| `data-list` | `list` or `grid`, the layout the reader picked on a listing |
| `data-motion` | `on` or `off`, whether animation is enabled |

Written on a list row (`.post-list article`), so a rule can follow the row's shape:

| Attribute | Values |
|---|---|
| `data-lead` | No value. The home page's promoted newest post (the lead-post switch, first page only); its title, when it has one, is the page's `h1` |
| `data-thumb` | `top` or `side`, where the row's picture sits; absent when the row has no picture |
| `data-short` | No value. The post has no title (a short post), so the row leads with its words and its date is the link |

Anything not on this list is internal. It may still work, and it may change in a release
without a note — if you find yourself needing one of those, that is worth telling us,
because it usually means a knob is missing.
