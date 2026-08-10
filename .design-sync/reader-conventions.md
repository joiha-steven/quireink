# Quire Ink — the reading site

This is the look of **quireink.com's public pages**: the article, the front page, the listing.
It is a **tokens-and-stylesheet design system, not a component library** — and that is a fact
about the product, not a gap in the export. Quire Ink renders its reader as HTML strings on
the server (`src/web/*.ts`); there is not a single React component behind these pages, so
there is nothing to import. `window.QuireInkReader` is empty by design.

**So build with plain HTML and these tokens.** Everything below is real: the palette, the type
scale and the prose rules are the product's own, taken from its shipped defaults.

## The one rule

**Never hardcode a colour or a font size.** Every colour comes from a `--c-*` token and every
size from a `--fs-*` role. That rule is enforced in the codebase itself (`check:css`), and it
is what keeps the palette switcher and the typography settings wired to anything. A hex
literal in your markup silently opts out of both.

## Tokens

| Group | Tokens |
|---|---|
| &nbsp;Colour | `--c-bg`, `--c-text`, `--c-heading`, `--c-meta`, `--c-link`, `--c-accent`, `--c-rule` |
| &nbsp;Type size | `--fs-h1` … `--fs-h5`, `--fs-body`, `--fs-small`, `--fs-caption`, `--fs-code` |
| &nbsp;Line height | `--lh-*`, matching each `--fs-*` role |
| &nbsp;Tracking | `--ls-*`, matching each role |
| &nbsp;Families | `--font-sans` (chrome), `--font-reading` (article body), `--font-mono` (code only) |
| &nbsp;Measure | `--shell-w` — the reading column width, 672px by default |
| &nbsp;Spacing | `--sp`, which scales with `--type-scale` |

Six palettes ship — `mono` (default), `sepia`, `forest`, `ocean`, `scifi`, `amber` — and the
reader picks one, so **never assume a specific hue**. Write `var(--c-accent)` and let the
palette decide. Dark mode swaps the same token values; it is not a separate set of names.

## Typography

The reading face is **Inter** by default — measured, not assumed: `DEFAULT_FONT_PRESET` is
`'inter'`, so an untouched install reads in Inter, and these cards do too. The owner can
repoint it to **Source Sans 3**, **Literata** or **Source Serif 4**, all four of which ship
here. Code sets in **JetBrains Mono**, with IBM Plex Mono the other mono option.

So **do not hardcode a family** any more than a colour: write `var(--font-reading)` and let
the preset decide. Every family carries a Vietnamese subset, so Vietnamese copy sets
correctly — use it rather than transliterating.

`--font-reading` is the article's voice and `--font-sans` is the chrome's. They are different
handles on purpose: an owner can put the site in a mono chrome while the prose stays a serif.

## Structure

- **`.prose`** is the article body. Put rendered Markdown inside it and the headings, lists,
  blockquotes, figures, footnotes and code blocks are all styled for you.
- **The reading column is `--shell-w`**, centred. A listing with a second rail narrows it by
  overriding that variable rather than by baking in a new width.
- **A front-page item is one of three shapes** — lead, card, or line — and the difference is a
  hierarchy, not three designs: size first, then standfirst, then image, then rules. Most
  items carry no image at all.

## An idiomatic block

```html
<article class="prose" style="max-width: var(--shell-w); margin: 0 auto">
  <h1 style="font-size: var(--fs-h1); line-height: var(--lh-h1); color: var(--c-heading)">
    Bàn phím cơ và chuyện gõ tiếng Việt
  </h1>
  <p style="font-size: var(--fs-small); color: var(--c-meta)">28 July 2026 · 8 min read</p>
  <p>Bộ gõ nào cũng phải chọn giữa tốc độ và độ chính xác.</p>
  <hr style="border: 0; border-top: 1px solid var(--c-rule)">
</article>
```

## Where the truth lives

`styles.css` and its imports: `fonts/reader-fonts.css` (the six families) and `_ds_bundle.css`,
which is the site's real stylesheet — `public.css.ts` with `prose`, `front`, `utility`,
`islands`, `ide` and `mobile` folded in, followed by the runtime token block. Read it before
inventing a rule; roughly 90 KB, hand-written, and deliberately small enough to inline.

The admin's component library is a **separate** design system with a deliberately different
look (monochrome, Tailwind). Do not mix the two vocabularies.
