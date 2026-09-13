# 0052 — One Markdown engine of our own

Date: 2026-09-13
Status: proposed

## Context

Four engines read Markdown in this repository and none of them knows the others exist.

| Engine | Reads for | Writes |
|---|---|---|
| `marked` | the reader's page | Markdown → HTML |
| `markdown-it` (via `tiptap-markdown`) | opening a post to edit | Markdown → editor document |
| `prosemirror-markdown` (via `tiptap-markdown`) | saving a post | editor document → Markdown |
| `toPlainText` — regular expressions | the excerpt, the meta description, the OG card, the RSS summary | Markdown → plain text |

This blog has notation of its own — the pen's `==ink==#green`, `++underline++` and
`@@ring@@`, maths, footnote references, callouts — and every one of those four had to be
taught all of it separately. **2,075 lines exist to do the teaching**, spread over fourteen
files.

Four answers to one question drift, and these have:

- `InkMark.ts` says it plainly: three readers of `==text==` exist, and *"they drifted once
  already, when `toPlainText` did not know the syntax and put the word 'green' into every
  excerpt."*
- `editor-corpus.test.ts` records the worse one: **19 of 45 golden fixtures published
  differently after a single pass through the editor** — footnote references escaped into
  LaTeX display maths, callout tags spelled out as MathML letters. Both features simply gone
  from the reader's page, silently, on save.
- 2026-09-13: the editor's stall on a long post turned out to be inside
  `prosemirror-markdown`, and the only repair available was to reach into the library's own
  output buffer — `state.out` is touched at eight sites across two files, because, as
  `ReaderSyntax.ts` puts it, *"the escaping happens inside the library's writer and the only
  seam is the buffer it wrote to."*

That last one is the shape of the whole problem. These libraries are good; they are not
extensible in the directions this product needs, so the product reaches around them.

**And they are not as standard as they look.** Measured against CommonMark 0.31.2's own 652
examples on 2026-09-13, allowing for differences that are only whitespace between tags:
`marked` gets **129 of them wrong — 19.8%**. Most in images, links, character references,
thematic breaks and setext headings. GFM's extension sections: 4 of 24 wrong.

This supersedes the part of [0005](0005-rewrite-in-bun-hono-sqlite.md) that reads *"no second
markdown engine"*. That was the right call for a port whose whole risk was behaviour not
surviving the move; it is the wrong one now that the product's own notation is the thing the
engines keep losing.

## Decision

**One syntax tree, parsed once, rendered five ways.** `src/md/` holds a parser and the
renderers; nothing else in the repository parses Markdown.

```
Markdown ──parse──► tree ──┬──► HTML          the reader's page
                           ├──► plain text    excerpt · meta · OG · RSS
                           ├──► editor doc    opening a post
                           └──► Markdown      saving a post
editor doc ──────────────► tree
```

`turndown` stays. It converts imported HTML from WordPress, runs once per import, is nowhere
near the hot path, and touches none of this blog's notation.

**CommonMark 0.31.2 in full, plus GFM's extensions, plus ours.** The measure is the specs'
own examples — 676 of them, copied into `spec/` because a test that needs the network fails
on a train. Not "enough for us": a post pasted in from anywhere else has to read the way its
author wrote it.

**THE PAGES THAT EXIST DO NOT CHANGE.** `manhhung.me` — 78 published posts, running
2.2.10-beta.3 — is the benchmark, and the condition is binary: every one of those posts must
render byte-identical through the new engine. Not "close", not "reviewed and accepted": the
same bytes, checked by one command that answers with a number.

The standard governs everything those posts do not reach. Where CommonMark and `marked`
differ in a corner no real post writes into, the new engine follows the standard, because
that is what makes a post pasted in from elsewhere read the way its author wrote it.

Where the two collide — a real post that does reach one of the 129 places `marked` gets the
standard wrong — the owner sees the difference and **the current page wins by default**. The
engine keeps `marked`'s answer there, deliberately and with the reason written down, rather
than quietly improving a page somebody already published and looked at.

The order matters: the comparison runs BEFORE the switch, not after. A list of differences
nobody has read is not a review.

## Consequences

- **~7,000–9,000 lines, plus tests, across 25–30 files** (the 400-line ceiling). For scale,
  all of `src/render` — everything that builds the reader's page — is 3,751 lines today. This
  is the largest single piece of work since the 2.0 rewrite and it spans many sittings.
- **Progress is a number, every sitting.** `src/md/spec.test.ts` reports how many of the 676
  examples pass. There is no sitting where the answer is a paragraph of prose.
- **Four layers of safety, in this order:** the 676 examples on every run; the 45 golden
  fixtures byte-identical; the parallel comparison over real production content; a switch
  back to the old engine, kept for several weeks after the change.
- **The comparison tool is built early — right after the parser — not at the end.** The
  owner's decision above depends on seeing the list, so the list has to exist before anything
  is switched, and the sooner it exists the sooner the 19.8% is a known quantity rather than
  an estimate.
- **The benchmark corpus never enters this repository.** `manhhung.me`'s posts are the
  owner's writing on a public source-available repo whose first rule is zero personal data.
  They are fetched into `.tmp/` over the blog's own MCP server — read-only, no server touched
  — and the tree keeps only the comparison script and the count it produced.
- **2,075 lines of teaching come out**, along with `marked`, `markdown-it`,
  `prosemirror-markdown` and `tiptap-markdown`. The editor keeps Tiptap itself; what it loses
  is the Markdown bridge.
- **The pen's grammar stops being three regular expressions kept in step by hand**
  (`src/pen/grammar.ts`) and becomes one parser rule. That file's warning — that the only way
  three parsers stay in step is one regex — stops being load-bearing.
- **A serialize on a long post stops being quadratic in the number of marks.** The 60ms left
  after the 2026-09-13 repairs is inside `tiptap-markdown`, which reads the whole buffer back
  for every mark that expels enclosing whitespace. Our own writer does not have to.
- **Residual risk, accepted and named:** this engine runs on customers' real posts across
  live blogs, and a writer bug does not raise an error — it quietly drops words. Mitigated by
  the four layers above, and by the order: the reader's page (which only reads) changes
  before the writer (which writes).

## Milestones

| # | Done means |
|---|---|
| 1 | The measure and the skeleton: `spec/` in the tree, `spec.test.ts` reporting a number |
| 2 | CommonMark blocks and inlines: ≥ 95% of the 652 |
| 3 | The comparison tool, run over all 78 posts of `manhhung.me`, difference count in hand |
| 4 | GFM and our own notation: ≥ 99% of the 676 |
| 5 | The reader's page: 45 golden byte-identical, the list from 3 resolved, switch moves |
| 6 | Plain text, opening a post, saving a post — the other three libraries come out |
| 7 | The 2,075 lines of teaching deleted; dependencies dropped |
