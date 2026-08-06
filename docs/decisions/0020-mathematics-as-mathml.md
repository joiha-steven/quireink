# 0020 — Mathematics: LaTeX in the source, MathML on the page, and the dollar sign stays money

Date: 2026-08-06
Status: accepted

## Context

Writing `$$M \times V = P \times Q$$` in a post published the characters `$$M \times V = P
\times Q$$`. Nothing was broken: the dollar sign has no meaning in Markdown, so `marked`
passed it through as prose, which is exactly what it should do with a character it has never
been told about. The gap was a missing feature, not a bug, and it surfaced the way these
usually do — the writer pasted output from an AI assistant, which emits LaTeX by default, and
read the result on the published page.

Two answers are conventional and both of them are unaffordable here. **KaTeX** ships around
23 KB of stylesheet plus a family of WOFF2 faces before it draws a glyph. **MathJax** is an
order of magnitude larger and runs in the reader's browser. The resource-loading law
(`docs/performance.md`) budgets a reader's JavaScript in single kilobytes — the whole site
ships 4.4 KB — so either one would spend several times the entire budget on a feature most
pages never use.

## Decision

**Formulas are rendered to MathML on the server. A reader downloads nothing extra.** No
script, no stylesheet, no font file. The browser's own layout engine draws the formula in its
own maths face, which is why the cost on the page is the markup and nothing else. MathML Core
is supported by every browser now in use.

**Temml, not KaTeX in `output: 'mathml'` mode.** That mode exists and looked like the same
trade under a better-known name. It is not: KaTeX's MathML was built as an accessibility
track running *alongside* the HTML it actually draws, and standalone it renders visibly
worse. Temml was written by a KaTeX contributor for precisely this job — MathML as the only
output — and that is the job here.

**Four delimiters: `$$…$$` and `\[…\]` for display, `$…$` and `\(…\)` inline.** The
backslash forms are the ones to prefer in new writing, because they need no rules at all.

**`$…$` carries Pandoc's three guards, and on this blog that is not a detail.** A dollar sign
is money far more often than it is mathematics, and the first post that needed this feature
was about the quantity theory of money — a page where `$5` and `$10` sit in the same
paragraph as `$M \times V$`. A naive `\$(.+?)\$` reads *"5 và "* as a formula and eats the
prose between two prices. So: the opening `$` must be followed by a non-space; the closing
`$` must be preceded by a non-space; and the closing `$` must not be followed by a digit. The
first two reject `$5 và $10`, the third rejects `$5-$8`. Every one of those sentences is a
test in `render/math.test.ts`.

**The TeX is never parsed as Markdown.** An underscore is the commonest character in a
subscript and the commonest emphasis delimiter at the same time, so `a_1 + b_2` parsed as
Markdown comes back as `a<em>1 + b</em>2` — not a rendering glitch, a different formula.

**A formula Temml cannot parse falls back to the writer's own source, escaped, and carries no
colour.** Temml's own error rendering paints the offending command in `#b22222` as an inline
style. Bodies are cached under a hash of their Markdown, so a hex baked into one could never
be restyled by the palette the reader chose — and CLAUDE.md forbids it besides.

## The editor half is not optional

This is the part worth writing down, because the feature looked finished before it was
started. The server renderer was correct and complete while the editor still did this, on
the real extension set:

```
$$M \times V = P \times Q$$   ->   $$M \\times V = P \\times Q$$
\(a_1 + b_2\)                 ->   (a_1 + b_2)
```

The first doubles every backslash, so `\times` stops parsing. The second is worse:
markdown-it's `escape` rule claims `\(` as an escaped parenthesis before any later rule can
look at it, so the delimiters are gone and nothing in the saved file records that the text
was ever a formula. Neither throws. Both corrupt the author's source on a save they did not
know was a rewrite — open a post, close it, and the mathematics is quietly destroyed.

So the grammar lives in `render/math.ts` and every reader of it calls the same two functions
(`matchMathAt`, `matchDisplayBlockAt`). No caller anywhere sees a capture group. That is the
lesson of ADR 0018's pen, which drifted between two hand-written copies of its regex within
an hour and put the word "green" into every excerpt on the site.

The delimiter the author typed is stored on the node, so `\[…\]` comes back as `\[…\]`.
Normalising it to `$$…$$` would have been one attribute cheaper and would mean that opening a
post silently edits it.

## Consequences

- Readers pay nothing. The admin bundle grows by Temml, which never reaches a reader.
- `toPlainText` drops a **display** formula whole and keeps an **inline** one's operands, so
  no `\times` reaches an excerpt, a meta description, an OG card or the RSS summary. The split
  was read off the rendered page: keeping display maths produced the deck *"M V = P Q Giải mã
  phương trình…"* above the title, while dropping an inline formula would summarise
  `**$M$ (Money Supply):**` as *" (Money Supply):"*. Control words are **not** mapped to
  symbols — a second mapping table would be a second grammar to keep in step with Temml's,
  which is the thing this ADR argues hardest against.
- Very old browsers without MathML Core show the formula as unstyled characters in order.
  Nothing is hidden and nothing is broken; it is simply plainer.
- The golden corpus contains no `$`, `\(` or `\[`, checked before the grammar was written.
  All 46 fixtures stayed byte-identical.
