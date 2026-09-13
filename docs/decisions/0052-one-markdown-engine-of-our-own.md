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

## What milestone 5 actually cost (2026-09-13)

The switch moved. The reader's page is drawn by `src/md/` and `marked` no longer runs on a
published post. Four things were learned in the moving that the plan above did not foresee,
and each is written down because each was a decision rather than a discovery.

**The five rules that were never Markdown.** `render/post-content.ts` carried five opinions as
`marked` options and renderer overrides, and none of them is in any Markdown specification: a
`javascript:` destination rewritten to `#`, a body `#` demoted to `<h2>` with a slug id, a
`<th scope="col">`, raw HTML shown as text, and — the one nobody had written down — `breaks:
true`, which makes a lone newline a line break. They now live in `md/html-rules.ts` as `PAGE`,
asked for by name, with the spec as the default. That separation is what keeps the engine
publishable on its own later: `PAGE` has exactly one import that is not portable.

`breaks: true` is the one that would have been shipped silently. CommonMark reflows a lone
newline into the paragraph, so every post written with Enter instead of a blank line would have
had its lines joined. One fixture — `golden/corpus/lazy-continuation.md` — spells the
difference, and nothing else in 676 spec examples or 45 fixtures would have said a word.

**A byte gate cannot grade a replaced engine.** `golden.test.ts` compares bytes, which is the
right instrument for a port and the wrong one for an engine written to a different
specification: `<br>` against `<br />` and a newline between two block tags are real bytes that
no reader can see, and thirteen red lines saying so teach everyone to skip the gate. A third
tier was added — `SAME_PAGE`, which asserts a fixture differs ONLY through a named rung of
`render/html-equivalence.ts`'s ladder of provably invisible rewrites. Behaviour still belongs
in `DIVERGED` with a reason; the ladder cannot dissolve a changed word.

**Three instruments, and the middle one was wrong.** The ladder said every difference in the
corpus was invisible. A DOM walk comparing the two trees node by node said six of them left a
stray space. Chrome, laying both bodies out and comparing `innerText` and every bounding box,
said 45/45 and 89/92 — and the DOM walk was the one that had modelled CSS whitespace collapsing
and modelled it short. It was deleted rather than fixed. `scripts/md-paint-diff.ts` is the one
that survived, and the answer it gives is the only one that is not a model.

**The three posts that did move, and all three are repairs.** Two of this blog's YouTube embeds
have been broken since the day they were published: the old editor escaped the underscore in
`…/shorts/8rMO\_J1UbPM`, `marked` kept the backslash in the destination, `buildVideos` did not
recognise a video URL, and the post published a bare link that 404s. Four such URLs exist across
two posts and all four now play. The third is an invisible `<br>` that `marked` invented from a
space, which is gone; the paragraph and the formula are at identical coordinates either way.

**Two node types existed with no producer.** `mathBlock` was handled by four renderers and built
by nothing, so every display formula rendered inside a `<p>` and lost the wrapper that lets a
wide derivation scroll; `math.test.ts` said so the moment the engine was wired. Building it
introduced, and then fixed, the two greedy failures now written on `md/block-math.ts`: a formula
must be known to CLOSE before it opens, and nothing may follow its closer on the line. `callout`
is the other one and is still unbuilt — the callout is `buildCallouts`'s job after rendering,
exactly as in 1.x, and the dead handlers come out with milestone 7.

## What milestones 6 and 7 cost (2026-09-14)

The bridge is out. `tiptap-markdown`, `markdown-it` and `prosemirror-markdown` came out with
`marked`, and nothing in `src/` parses or writes Markdown except `src/md/`.

**A save on a long draft went from 144ms to 7ms.** Measured on the shape that started this: an
18,001-word draft carrying 3,900 pen marks saves in 7.2ms (median of twelve). The original
measurement was 144ms on a draft with 2,159 marks, of which 118ms was `ReaderSyntax.ts` reading
the whole buffer once per text node; after that repair, ~60ms was left inside `tiptap-markdown`
doing the same thing for `expelEnclosingWhitespace`. Ours reads the two ends of one string.

**134 KB less JavaScript** in the admin bundle: 2,552 KB to 2,418 KB.

**Four files stopped being needed at all.** `TableMarkdown.ts` and `ReaderSyntax.ts` were
serializer overrides and nothing else, so their nodes are the library's again; `MixedList.ts`
repaired mixed bullet-and-checkbox lists in the HTML between markdown-it and the schema, and
there is no HTML in the middle any more, so the split moved into `md/to-editor.ts`;
`markdown-nested.ts` was one line of markdown-it plumbing. `InkMark.ts`, `PenMarks.ts` and
`MathNode.tsx` each lost their parser half and their serializer half and kept what they are
for — how a stroke or a formula LOOKS while it is being written.

**The excuse list in `editor-corpus.test.ts` went from eight fixtures to one**, and that is the
measurement that matters, because each entry was a post whose page changed after somebody opened
it and pressed nothing:

| fixture | what the old bridge did |
|---|---|
| `dangerous-hrefs`, `dangerous-href-obfuscated`, `reference-links` | a link saved with BOTH brackets escaped, which this blog's renderer reads as DISPLAY MATHS — the link published as a formula |
| `task-lists` | a tight checklist saved loose, a blank line per item |
| `callout-unknown`, `lazy-continuation` | the line break between two lines of a quote, dropped |
| `entities` | `&copy;` decoded on the way in and written back as the character |

The one that is left is raw HTML, and it moves in the SOURCE rather than on the page: raw HTML
is text here, a paragraph cannot carry the indentation of a continuation line, and the two spaces
before a shown-not-run `<script>` come off. HTML collapses that whitespace either way.

**What the wiring found, and each was live.** A display formula written mid-paragraph was built
as a BLOCK node, which ProseMirror refuses inside a paragraph — the equation was dropped from the
document before the writer saw it. A link whose whole label is a formula lost its URL, because
`to-editor.ts` built the inline node without the marks. An empty fenced block built an empty text
node, which ProseMirror forbids outright, so the block vanished. A pen stroke drawn across a link
came back as three strokes, because marks were nested by a fixed table rather than by how far
each one RUNS. And the serializer escaped more than it needed three times over: every `==` (so
`x == y` became `x \== y`), every `&` (so `M&A` became `M\&A`, in 44 of 92 posts), and every bare
URL expanded into the explicit bracket-and-parenthesis form with its own address as the label.

**How the promise was measured.** All 92 of this blog's real posts, opened in the REAL editor and
saved, both bodies laid out in Chrome: 92 of 92 paint identical text, 91 of 92 have every element
at identical coordinates. The one exception merges three adjacent links that share a destination
— a WordPress-import artifact ProseMirror cannot represent as three — into one link over the same
pixels. The SOURCE is normalised (a trailing newline, `-   x` to `- x`, `* * *` to `---`, one
nesting order for a bold link) the way every Markdown editor normalises, and the old bridge did
more of it and worse.

Milestone 3's 19.8% is answered: the engine and `marked` disagreed on 78 posts by whitespace and
entity spelling, and on three by something a reader could see — two broken YouTube embeds and an
invented `<br>`, all three repairs.
