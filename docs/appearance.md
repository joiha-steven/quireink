# Making it look like yours

> For the person who owns a blog, not the person who builds one. Everything here is done
> from Settings or from one CSS box; nothing needs a checkout.

Quire Ink ships **one design**. There are no themes to install, which is a deliberate
trade — a theme gallery is a promise to keep every theme working forever, and the ones
that stop being maintained are the ones people are running. What replaces it is a set of
knobs, and this page is the map of them, ending with the escape hatch for anything they do
not cover.

## The knobs, roughly in the order they change a first impression

| Setting | Where | What moves |
|---|---|---|
| Homepage mode | Home & menu → Front page | A list of posts, a single page you wrote, or a composed front page. This is the single largest visual difference between two Quire Ink blogs ([homepage.md](homepage.md)) |
| Logo | Blog → Logo and icons | An image mark instead of the site name. In practice this is the first thing a reader tells two blogs apart by; it is resized for you and never served at its original weight |
| Palette | Appearance → Appearance | Six built-in palettes, and every one of the seven colours in each is editable in both light and dark |
| Reading font | Appearance → Font | The face your articles are set in: four built-in faces, or upload your own (`.woff2`, up to four weights). Picking a built-in face also loads its recommended text sizes into the type table, and the screen says so. Fonts are served from your own server — nothing is fetched from Google |
| Chrome font (labelled "Site font") | Appearance → Font | The face of everything on the public site except the article text (header, menu, footer, dates, comments, search, forms), separately from the one your words are set in. It never changes the admin |
| Type scale | Appearance → Text sizes | Nine roles, each with size, line height and letter spacing |
| **Density** | Appearance → Shape | How much air between everything. `normal` is the design as drawn |
| **Corner radius** | Appearance → Shape | Square, soft, or round. Avatars and pills keep their own shape |
| **Headline weight** | Appearance → Shape | Light, normal or bold. Moves the post title and the card title together |
| **Tables** | Posts → Tables | Seven knobs for how a table is drawn: header row, which lines, line weight, banded rows, first column, cell padding, and what happens on a phone. **The header row is tinted by default** — see below |
| **Post hero** | Posts → Pictures | Whether a post's own picture appears above the headline. **Off by default** — see below |
| **List thumbnail** | Home & menu → Post list | Whether that picture appears on list rows, as a small square or a large 3:2. **Off by default** — see below |
| Figure frame | Posts → Pictures | The frame every in-body picture wears unless it says otherwise |
| Content width | Home & menu → Layout & menu | How wide the reading column runs |
| Sidebar | Home & menu → Layout & menu | One rail or two, and whether there is a rail at all. With one rail (the default), a wide screen puts the menu and the subjects on the left and, in a sticky column on the right, an index of years with their post counts (the year in view lit, and an *All posts* link), then Most viewed and Featured; the infinite-scroll timeline gives way to that index there. Two rails keeps discovery on the left and everything else on the right. Switching it off leaves the rail carrying the owner's MENU alone: that switch owns the discovery blocks, never the site's navigation. On a phone the rail is a drawer that opens from the left in the page's own palette, with a search box on top when Search is on |
| Archive in the sidebar | Home & menu → Post list | The years, as a block in the rail (with one rail, the year index on the right; each year links to its first post on the page when it is there, else to `/archive`). Separate from the `/archive` PAGE switch — the block can leave while the page stays reachable |
| Series in the sidebar | Home & menu → Post list | The series list, each linking to its own page |
| Tags in the sidebar | Home & menu → Post list | The tag cloud. The one block in the rail with no ceiling on its length, which is why it sits last |
| Categories in the sidebar | Home & menu → Post list | The categories, each with how many posts it holds |
| **Read without a signal** | Posts → What is on a post | A post your reader has already opened still opens with no network. **Off by default.** Nothing is downloaded ahead of time and your admin is never stored. Turning it off again removes it from readers who already have it |
| **Archive** | Home & menu → Post list | `/archive`: every post you have published, grouped by year, and the list of years in the rail. **On by default.** If you already publish a page or a post at `/archive`, yours keeps the URL and this stays off until you move it |
| **Author** | Blog → Author | Name, bio, portrait and a link. Empty by default; filling in a name adds a byline and puts you in the structured data search engines read |
| Motion | Account → This admin | Every transition, entrance and smooth scroll, on the site, the sign-in page and the admin alike. A reader's own reduced-motion preference wins either way ([conventions/motion.md](conventions/motion.md)) |
| Looks like | Appearance → Looks like | Which of four dialects the published site wears: **Plain paper** (nothing added), **Source code**, **Newspaper** or **Notebook**. Asked once, as the last step of setup, and one click either way here afterwards. Only the published site: this admin never changes. Newspaper is the one that touches your words — it numbers headings, figures and tables, and those numbers live on the page and not in the feed, the newsletter or what a reader copies. Source code sets your headlines in its monospace and numbers the lines of a highlighted code block, which a copy does not pick up |
| Footer | Home & menu → Footer | Your own line, with `{year}` and `{title}` tokens |
| **The reader's pen** | Posts → What is on a post | Readers select words on a post and highlight, underline, ring or note them; marks live in their browser only and are drawn with the site's own pen. **On by default.** Off removes the bar and leaves the quote-copy gesture ([ADR 0043](decisions/0043-the-reader-gets-a-pen.md)) |
| **Hand-drawn lists** | Posts → What is on a post | Bullets become ink dots and level dashes, and a numbered list counts in a handwritten numeral (Kalam, ten digits, 1.4 KB). **On by default.** Off restores the browser's disc and decimal; a list that starts past 1 and a task list keep the browser's marker either way |
| Feature switches | Posts → What is on a post | Table of contents, progress bar, book mode, related posts, reading time, the scroll fade, and a dozen more |

**Two of those read differently on a phone, and neither is a setting.** The reading-progress
bar is desktop-only: the scrollbar already answers how far in you are, and a scroll-driven
hairline stutters on a phone because it shares the compositor with the address bar
collapsing. And book mode below 640px is one scrolled column rather than a turned spread —
a modal dialog takes the scroll off the document, which is what keeps iOS from retracting
its own bars, so the phone reader scrolls the page and its chrome hides on the way down.

### About the table settings

⚠️ **This is the one settings group whose default does not reproduce what your blog looked
like before it existed.** Every other group in this product shipped defaults that moved
nothing on upgrade. A `<th>` had no ground of its own — a header row was bold text in the
same paper as the data, and read as one more row — so a default that preserved it would have
preserved the complaint. **To get exactly the old rendering back: Header row → Plain, and
Lines → Around every cell.** Nothing else in the group changes anything by default.

One set for the whole blog, and that is deliberate rather than a limitation. Markdown has no
syntax for a tinted header, a row rule or a bold first column, so the only way to make a
table differ from the table below it would be an attribute carried inside the source — and
then a table you paste in is no longer a table you can paste out. These tables are written by
pasting Markdown in, so they stay plain GFM.

| Knob | Choices |
|---|---|
| **Header row** | **Tinted** (default) · Plain · Ruled — no ground, a heavier line beneath · Inverted — the ink and the paper swapped |
| **Lines** | **Around every cell** (default) · Between rows only · None. A table of numbers reads well boxed; a table of sentences drowns in it |
| **Line weight** | **Hairline** (default) · Thick |
| **Banded rows** | **Off** (default) · On — a faint tint on every other row. It earns its place on a long table, not on four |
| **First column** | **Same as the rest** (default) · Emphasised — for a table whose left column names the row and the rest answers it |
| **Cell padding** | Compact · **Normal** (default) · Relaxed |
| **On a narrow screen** | **Squeeze to fit** (default) · Scroll sideways |

**What "Scroll sideways" is for.** A table of sentences keeps compressing its columns until
they are a word wide, and the sideways scroll the reading column has always had for wide
tables never engages, because a table that can shrink never overflows. Measured on a phone at
375px: a two-column reference table put its first column at 105px, made one row 551px tall,
and ran to 2,334px with no scrollbar anywhere. Giving each cell a floor makes it scroll
instead. It is a choice and not a fix, because the same floor would send a timeline of three
short columns sideways when it fits a phone comfortably today.

**Every ground is mixed from your palette, never named.** The header wash is 6% of your text
colour stirred into your page colour, so it darkens the paper in a light theme and lightens
it in a dark one, in all six palettes, from one declaration. Measured on the default
palette: page and header are 13 steps of grey apart in light mode and 12 in dark, which is a
band you can see without being told it is there.

### About the picture settings

They arrived switched **off**, on purpose. A blog that upgraded into the version that added
them kept the exact pages it had; nothing grew a picture without being asked. The list offers **three** answers and the article **two**, and neither asks about shape:

| Where | Choices |
|---|---|
| **Cover on the post** | Not shown · **Show it** — a 3:2 cover above the headline, the width of the reading column |
| **Thumbnail in lists** | Not shown · **Small square** beside the headline (64px on a phone; from 40rem 96px beside the headline and standfirst, with the date and reading time underneath at full width) · **Large 3:2** above the title |

The shapes are fixed on purpose. One blog's pictures should look like one blog's pictures,
and picking that is the design's job rather than a question put to you three times. It also
removes the case that makes covers look accidental: an ordinary portrait scan is 963px tall
inside a 672px column, a whole screen of picture between the headline and the first
sentence.

There is no full-bleed cover either — the table of contents and the info panel sit eight
pixels from the reading column, so a wider picture prints over them.

Posts without a picture are unaffected either way — there is no placeholder, and there
will not be one.

On a list row the category is a small label above the headline (when category labels are on), and the date and reading time come last, under the standfirst.

If you want pictures on your homepage **and** the ordinary list layout, `thumb` is the
setting you want. The newspaper homepage mode is a different answer to the same wish, with
a different shape.

### What the pages do without a knob

These follow your other settings and the active look, and have no switch of their own:

- **A row of subjects on tablets.** On list pages between 40rem and the width where the rail
  appears, the categories and then the series sit as one row of chips under the header,
  scrolling sideways when they overflow. They obey the sidebar's switches: no chips when the
  sidebar is off, and each of *Categories* and *Series* removes its own. The page you are on
  is filled in.
- **The line under a post title on a phone.** Under 640px it is two short lines, the date and
  reading time and then the author, and the word count is left out. Wider screens keep one line.
- **The series box.** The series name and *Part N/M* share a row, with a thin bar of one
  segment per post (capped at 40) above the list of parts.
- **The Source code look's headline on a phone.** Under 640px the article headline is 0.8 of
  your Heading 1 size, because a monospace is wide; it still follows your Heading 1 setting.
- **The search page.** With nothing typed, `/search` shows the box with its button inside,
  your eight busiest tags and your five newest posts.
- **Book mode's first page** is a title page: the category and series part, the headline,
  the standfirst and the byline. The body starts on the next page.

## When the knobs are not enough: your own CSS

**Appearance → Custom CSS** is injected into every public page, last, after
everything else — so it wins. It is not filtered: any rule you can write in a stylesheet
works here. It never touches the admin, so you cannot lock yourself out with it.

The box counts its lines, indents on Tab, and shows the byte count — this text travels inside
every public page on every request, so it is worth seeing. It also tells you when a brace is
unclosed, which is the usual reason a stylesheet does nothing at all: braces inside comments
and strings are not counted, so it does not cry wolf.

The design is built on CSS variables, and overriding a variable is almost always better
than overriding a rule: a variable is a value the whole design already reads, so changing
one stays consistent, while a rule you copy out of the stylesheet is a copy that stops
matching when the original changes.

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

  /* Fonts — the faces behind every role below */
  --font-reading: var(--font-sans);  /* titles, standfirsts, the article body */
  --font-sans:    'Inter', system-ui, sans-serif;  /* header, footer, rail, dates, forms */
  --font-mono:    'JetBrains Mono', ui-monospace, monospace;  /* code, and only code */

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
| `.rail-toggle` `.rail-scrim` | The phone button that opens the drawer, and the dimmed page behind it | both |
| `.rail-lead` `.rail-sub` `.rail-count` `.rail-tags` | Rows of the article contents, the number beside a link, the tag cloud | blog |
| `.toc` `.toc-end` | The article contents, and its last row | blog |
| `.post-list` / `.post-list article` | The list of posts, and one row of it | blog |
| `.card-thumb` `.card-kick` | A list row's picture, and its category line | blog |
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

Written on `<html>`, so a rule can change with the palette, the scheme or the look:

| Attribute | Values |
|---|---|
| `data-palette` | The palette id: `mono`, `sepia`, `forest`, `ocean`, `scifi`, `amber`; only present when the blog offers two or more palettes |
| `data-scheme` | `light` or `dark`, once the page script has resolved it (`:root[data-scheme="dark"]`) |
| `data-look` | `code`, `paper` or `notes`; absent on the plain look |
| `data-list` | `list` or `grid`, the layout the reader picked on a listing |
| `data-motion` | `on` or `off`, whether animation is enabled |

Anything not on this list is internal. It may still work, and it may change in a release
without a note — if you find yourself needing one of those, that is worth telling us,
because it usually means a knob is missing.

### Two things to know before you write any

- **The page cache holds rendered HTML.** A CSS change appears immediately (the stylesheet is
  assembled per request from your settings), but a change to *markup* — which custom CSS
  cannot make — would not. This is why the design is driven by variables and attributes
  rather than by classes baked into stored pages.
- **`!important` is almost never needed.** Your CSS is already last. If a rule is not taking,
  the usual cause is specificity inside your own selector, not the design fighting you.

## When it is not CSS you need: your own code

**Server & connections → Site settings** holds your own HTML. One box goes in the page `<head>`, where
most snippets ask to be; the other goes just before `</body>`, where Cloudflare's beacon and
a few others ask to be. Both ship on every public page, in the order you typed them, and
neither is checked or rewritten — a box whose purpose is to carry a script cannot strip
script tags.

This is the seam between two different promises. Quire Ink itself makes **no third-party
request of any kind**, and that stays true: a fresh install has both boxes empty and fetches
nothing from anybody. What you put in them is your site's business, not the software's —
Umami, Plausible, a verification tag, a widget, a beacon.

Three things worth knowing before you paste:

- **It never reaches the admin, the sign-in page, or a draft preview.** A tracker on the
  preview of an unpublished post reports a reader who does not exist, and quietly spoils the
  numbers you read in Analytics.
- **Your content policy decides whether it runs.** The app itself sends no
  `Content-Security-Policy`, because a useful policy depends on what you have chosen to
  load. The proxy in front of it usually does: the nginx vhost in
  [self-host.md](self-host.md) and the `Caddyfile` (which `deploy/caddy/setup.sh` installs)
  both send `script-src 'self'`, which blocks both an inline `<script>` and a `<script src>` from
  another host, and the browser says so only in its console. Before a snippet can run
  under that policy, widen `script-src` (and `connect-src`, for a beacon that posts back)
  to name the host it loads from, the way the Turnstile block in the `Caddyfile` does.
  A `docker compose up` with no proxy of your own sends no policy at all, and the snippet
  runs as pasted.
- **The box shows the byte count**, for the same reason the CSS box does: that text travels
  inside every public page on every request. It also says when a `<script>` or `<style>` is
  never closed, which is this field's version of the unclosed brace — worse, because an
  unclosed `<script>` swallows the rest of the page and the site goes blank with nothing
  saying why.

The built-in statistics are not replaced by any of this. They stay where they are, they keep
their whole history, and they cost a reader nothing ([performance.md](performance.md)).

## What you cannot change from here

Honest list, so you do not spend an evening trying:

- **The order of blocks on the composed front page.** It is a designed layout with options,
  not a block builder ([ADR 0014](decisions/0014-homepage-modes.md)).
- **The article's three-column geometry.** The rail is positioned so the reading column stays
  centred; moving the article off-centre is a layout rewrite, not a setting.
- **Fonts fetched from a third party.** Uploading a face is supported; loading one from
  Google's servers is not, and the site's own content policy blocks it
  ([conventions/type.md](conventions/type.md)).
- **A seventh palette.** You can repaint all six; you cannot add one.
- **Per-post appearance.** Settings are site-wide by design. A single post can override its
  figure frame and gallery shape from the image fragment, and nothing else.
