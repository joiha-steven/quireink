# Golden-file parity harness

Replaces the Go plan's golden spec, and the change is large enough to state up front.

**The Go plan's single highest risk was that `goldmark` and `marked` render the existing
corpus differently. That risk no longer exists: `marked` is kept.** So is `shiki`, and so
is `satori`.

The harness therefore stops being a negotiation over acceptable differences and becomes
a **hard equality gate**. If an article body differs by one byte, a template was ported
wrong. There is nothing to review and nothing to accept.

This is strictly stronger than what the Go plan could have achieved, and it is cheaper.

## What is compared, and how strictly

| Layer | Comparison | Strictness |
|---|---|---|
| Rendered article body | byte-for-byte after normalisation | **Must be identical.** No exceptions file |
| Code blocks | byte-for-byte | Identical: same Shiki, same theme |
| `<head>` metadata (title, description, OG, canonical, JSON-LD) | field by field | Strict on values, not on attribute order |
| Feeds, sitemap, robots, llms.txt | entry set and per-entry fields | Strict on values |
| Page chrome (header, footer, rail, nav) | structural only | Loose. The markup is being rewritten on purpose |
| OG images | perceptual hash | Same renderer, so near-identical. A large distance means a font or size regression |
| `/search` | hand-written expectations | Excluded from equality. Behaviour changes on purpose (parity exception #2) |

## Layout

`golden/` sits at the repository root. What was built is the corpus half:

```
golden/
  capture-corpus.ts   renders each fixture with the FROZEN renderer, writes v1/corpus/
  corpus/             hand-written markdown edge cases
  v1/corpus/          captured reference HTML (git-tracked, it is the contract)
```

The gate itself is [`src/render/golden.test.ts`](../../src/render/golden.test.ts): every
fixture, byte-identical, in `bun test`. The crawl-and-diff half described below —
`capture.ts` against a running 1.x instance, `compare.ts`, `accepted.yaml`, `report.html`
— was **planned and not built**; the corpus proved sufficient and the URL crawl was never
needed.

`golden/v1/corpus/` is committed. Regenerating it is a reviewed change, because it
silently moves the goalposts.

## Capture

Runs against a local Quire v1 (`docker compose -f docker-compose.dev.yml up -d` plus
`npm run dev`) loaded with a **copy of production data**. Not seed data: the point is to
exercise the real corpus, including the posts with unusual markdown.

URLs crawled:

1. Every post and page slug, live and draft (draft via `/preview/{slug}`)
2. Every category, tag and series page, and every pagination page of each
3. `/`, `/page/{n}` for all n
4. `/feed.xml`, `/sitemap.xml`, `/sitemaps.xml`, `/robots.txt`, `/llms.txt`,
   `/manifest.webmanifest`
5. `/api/md/{slug}` for every slug
6. `/og?...` for a representative 20 posts
7. Each of the 6 locales and each of the 6 theme palettes for a representative subset

### Normalisation before storing

Applied to captured HTML so the comparison is about content, not about Next:

- Remove `<script>` tags matching Next's streaming payload (`self.__next_f`)
- Remove `<link rel="preload">` and chunk `<script src>` entries
- Remove React hydration attributes and comment markers
- Collapse insignificant whitespace **between block elements only**, never inside
  `<pre>`, `<code>`, or text nodes

Note what is **not** on this list any more: the Go plan had to sort `class` attribute
tokens because Tailwind emits them in build order. Public Tailwind is gone
(04-frontend.md), so classes are hand-written and stable, and sorting them would hide a
real difference.

Do not "tidy" the HTML with a formatter. A formatter masks exactly what is being hunted.

### Article body extraction

The strict comparison targets `#post-body` for posts and the equivalent page container.
The surrounding chrome is being rewritten deliberately and comparing it would produce
thousands of meaningless differences that hide the real ones.

## The corpus

Real posts do not exercise the edge cases where implementations disagree, and although
the parser is unchanged, the corpus is still worth building: it becomes the **regression
suite for `marked` itself**, which is a live dependency that will be upgraded over the
next ten years.

`golden/corpus/` holds hand-written fixtures, each a small markdown file with an
expected-HTML sibling, covering at minimum:

- Nested lists at 3+ levels, mixed ordered and unordered
- A list item containing a fenced code block, and one containing a table
- Lazy continuation lines
- Setext vs ATX headings, headings with trailing `#`
- Emphasis adjacent to Vietnamese diacritics and to punctuation
  (`**lập**trình`, `*"quoted"*`, `a*b*c`)
- Intraword underscores (`snake_case_name`) which must NOT emphasise
- Raw HTML blocks and inline raw HTML (must be escaped, Invariant 5)
- `javascript:`, `data:`, `vbscript:` hrefs (must be dropped, Invariant 5)
- Autolinks, bare URLs, email addresses
- Reference-style links and images, including undefined references
- Footnote definitions before and after their reference, footnotes inside tables,
  duplicate footnote ids, unreferenced definitions
- GFM tables with alignment, escaped pipes, and inline code containing a pipe
- Task lists, including nested ones
- Fenced code with no language, an unknown language, and a language alias
- Hard breaks (two trailing spaces vs backslash)
- HTML entities and numeric character references
- A YouTube / Vimeo / TikTok URL alone in a paragraph (must become a video node)
- An image with a title, and consecutive images that must group into a grid
- Very long lines, CRLF line endings, a BOM, a file with no trailing newline

Around 60 fixtures. Every one of them should pass on day one. Any that does not is a
porting bug in the surrounding pipeline, not a parser difference.

## Highlighting moved off the read path

`shiki` now runs at save time into the content-addressed `render_cache`
(01-schema.md section 4). Two consequences for this harness:

- The theme and the Shiki version are unchanged, so highlighted markup is expected to be
  byte-identical to v1, not merely equivalent.
- The **importer** warms that cache for the whole corpus (05-importer.md step 15) and the
  golden comparison is what proves it did. The read path self-heals on a miss, so a
  failure here shows up as a slow first render rather than wrong output, which is exactly
  the kind of silent gap a byte comparison is good at catching.

## `accepted.yaml`

Present, and expected to stay empty.

Under the Go plan this file was where genuine parser disagreements were recorded. Here,
any entry means either a porting mistake or an intentional design change that belongs in
the parity-exceptions list in 00-rationale.md instead. Treat a non-empty file as a signal to
stop and look, not as a normal working state.

## Compare and report

`compare.ts` boots Quire 2.0 against the imported SQLite database, requests the same URL
set, applies the same normalisation, and diffs against `v1/`.

Output is `report.html`: one page grouping differences by cause, side by side, sorted by
number of affected URLs so systematic problems surface before one-offs.

Exit code is non-zero on any difference. Runs in CI on every commit touching `src/render`
or `src/web`.

## Running order

```
1. capture   (once, against v1 + a production copy)     -> golden/v1/
2. import    (bun run import-v1)                        -> quire.db
3. compare   (repeatedly, during M2)                    -> report.html
```

Step 1 is re-run only when the production corpus changes materially, and that re-run is
reviewed.

## What this harness does not cover

Stated plainly, because it is where feature loss actually happens:

- **The admin.** 8,578 lines, 66 components, roughly 20 feature areas, zero coverage
  here. Its defence is the M0.5 feature inventory plus the 30-flow headless tour in the
  M3 gate.
- **The 61 API routes** beyond what public pages exercise.
- **Newsletter, backup, MCP** round trips. Each has its own gate in M3.

Do not let a clean golden report be read as "nothing was lost".
