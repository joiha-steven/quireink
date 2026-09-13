# The specs this blog's Markdown engine is measured against

Test data, not documentation. `src/md/spec.test.ts` reads both files on every run and reports
how many of their examples the engine renders exactly.

| File | What | Examples | Source |
|---|---|---|---|
| `commonmark-0.31.2.json` | CommonMark 0.31.2, whole | 652 | [spec.commonmark.org/0.31.2/spec.json](https://spec.commonmark.org/0.31.2/spec.json) |
| `gfm-extensions.json` | GitHub Flavored Markdown, the five sections CommonMark does not cover | 24 | extracted from [github/cmark-gfm `test/spec.txt`](https://github.com/github/cmark-gfm/blob/master/test/spec.txt) |

The GFM file holds only the extension sections — tables, task list items, strikethrough,
extended autolinks and disallowed raw HTML. The rest of that document restates CommonMark at
an older version (0.29), and running two versions of the same suite would mean two answers to
every question and an argument about which one counts.

Both specs are © John MacFarlane and contributors, released under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). They are copied in rather
than fetched because a test that needs the network is a test that fails on a train, and
because a spec that can change under the suite is not a contract.

**Do not edit either file.** A failing example is the engine's answer being wrong, or a
deliberate divergence — and a deliberate divergence is named in `src/md/spec.test.ts`, where
it has to carry a reason, not silently deleted from the data.
