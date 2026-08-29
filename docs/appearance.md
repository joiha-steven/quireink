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
| Homepage mode | Appearance → Homepage | A list of posts, a single page you wrote, or a composed front page. This is the single largest visual difference between two Quire Ink blogs ([homepage.md](homepage.md)) |
| Logo | Appearance → Brand | An image mark instead of the site name. In practice this is the first thing a reader tells two blogs apart by; it is resized for you and never served at its original weight |
| Palette | Appearance → Colour | Six built-in palettes, and every one of the seven colours in each is editable in both light and dark |
| Reading font | Appearance → Type | Four built-in faces, or upload your own (`.woff2`, up to four weights). Fonts are served from your own server — nothing is fetched from Google |
| Chrome font | Appearance → Type | The face used by the header, the rail and the small print, separately from the one your words are set in |
| Type scale | Appearance → Type | Nine roles, each with size, line height and letter spacing |
| **Density** | Appearance → Shape | How much air between everything. `normal` is the design as drawn |
| **Corner radius** | Appearance → Shape | Square, soft, or round. Avatars and pills keep their own shape |
| **Headline weight** | Appearance → Shape | Light, normal or bold. Moves the post title and the card title together |
| **Post images** | Layout → Post pictures | Whether a post's own picture appears above the headline, whether it appears on list rows, and what shape the cover is cropped to. **Both positions off by default** — see below |
| Figure frame | Appearance → Images | The frame every in-body picture wears unless it says otherwise |
| Content width | Appearance → Layout | How wide the reading column runs |
| Sidebar | Appearance → Layout | One rail or two, and which blocks are in it |
| **Author** | Settings → Site | Name, bio, portrait and a link. Empty by default; filling in a name adds a byline and puts you in the structured data search engines read |
| IDE chrome | Appearance → Shape | Dresses the furniture around your words as source code. Off by default; it is a strong taste and it is one click either way |
| Footer | Appearance → Brand | Your own line, with `{year}` and `{title}` tokens |
| Feature switches | Appearance → Reading | Table of contents, progress bar, book mode, related posts, reading time, and a dozen more |

### About the picture settings

They arrived switched **off**, on purpose. A blog that upgraded into the version that added
them kept the exact pages it had; nothing grew a picture without being asked. Turn `hero` on and every post that has a featured image gets it **above the headline**, at
the width of the reading column. There is no full-bleed option: the table of contents and
the info panel sit eight pixels from that column, so a wider picture prints over them.

**Cover shape** appears once a hero is on: as shot (the photograph's own proportions), or
cropped to 1:1, 3:2, 4:3 or 16:9. Whatever you choose, a hero is capped at 70% of the
screen height — an ordinary portrait scan is 963px tall inside a 672px column, which is a
whole screen of picture before the first sentence.

Turn `thumb` on and the same picture appears on list rows, beside the words or above the
title. **A thumbnail's shape is not a setting**: it is always cropped, square beside the
words and 3:2 above the title. A gallery gets to choose because a gallery *is* the
photographs; a list thumbnail is there to be recognised, and a column of mixed heights
reads as three different mistakes rather than one list.

Posts without a picture are unaffected either way — there is no placeholder, and there
will not be one.

If you want pictures on your homepage **and** the ordinary list layout, `thumb` is the
setting you want. The newspaper homepage mode is a different answer to the same wish, with
a different shape.

## When the knobs are not enough: your own CSS

**Appearance → Advanced → Custom CSS** is injected into every public page, last, after
everything else — so it wins. It is not filtered: any rule you can write in a stylesheet
works here. It never touches the admin, so you cannot lock yourself out with it.

The design is built on CSS variables, and overriding a variable is almost always better
than overriding a rule: a variable is a value the whole design already reads, so changing
one stays consistent, while a rule you copy out of the stylesheet is a copy that stops
matching when the original changes.

### The variables that are safe to set

These names are part of what the software promises you. They will not be renamed without a
note in the changelog.

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
  --fw-title:    700;    /* the post title's weight */
  --fw-heading:  600;    /* card titles, related, read-next */
  --density:     1;      /* multiplies every gap; Shape sets .82 / 1 / 1.22 */

  /* Measure */
  --shell-w:      672px; /* the reading column (Content width sets this) */
  --sp:           1rem;  /* the spacing unit every gap is a multiple of */

  /* Type — nine roles; each has -fs- (size), -lh- (line height), -ls- (letter spacing) */
  --fs-h1: 2rem;  --lh-h1: 1.15;  --ls-h1: -0.01em;
  --fs-body: 1.13rem;  --lh-body: 1.7;  --ls-body: 0em;
  /* ...and the same trio for h2, h3, h4, small, caption, code, ui */

  /* Motion */
  --dur-fast: 120ms;  --dur-base: 200ms;  --dur-slow: 320ms;
}
```

**Dark mode.** Set a variable on `:root` and it applies in both schemes. To change only one,
scope it:

```css
:root[data-scheme="dark"] { --c-bg: #0b0b0c; }
```

### The class names that are safe to target

Structure that is part of the contract, in the order a page uses it:

| Class | What it is |
|---|---|
| `.wrap` | The page shell |
| `header.site` / `footer.site` | The site header and footer |
| `.rail` | The sidebar, and the drawer it becomes on a phone |
| `.post-list` / `.post-list article` | The list of posts, and one row of it |
| `.card-thumb` | A list row's picture, when thumbnails are on |
| `.post-hero` | The picture at the top of an article |
| `.prose` | The article body — everything you wrote lives inside this |
| `.deck` | The standfirst under a post title |
| `.author-box` | The author box under an article |
| `.related` / `.read-next-title` | The blocks at the end of an article |
| `.subscribe-card` | The newsletter sign-up |
| `#comments` | The comment tree |

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
