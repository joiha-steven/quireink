# 0053 — A dependency is a decision, and the default answer is to write it

Date: 2026-09-14
Status: accepted · amends [0005](0005-rewrite-in-bun-hono-sqlite.md), whose "keep" list this replaces
In force: see the [index](README.md). The index is maintained; this file is not.

## Context

[0005](0005-rewrite-in-bun-hono-sqlite.md) is titled *"porting rather than reimplementing"*, and
its Decision says in as many words: *"Keep `marked`, `shiki`, `sharp`, `satori`, `nodemailer` and
the MCP SDK."* Its reason was a measurement about risk:

> The owner does not read code. The dominant risk is therefore not a compiler-catchable bug, it
> is a behaviour quietly not surviving the move.

That reasoning was sound for a port under a three-week deadline, and it is why every session
since has reached for a package without asking. It answered a question about RISK. It never
asked whether building this software out of its own parts was a goal in itself, and the
directory's whole purpose is that a settled argument should be findable — so an intent nobody
recorded is an intent every session overrides by default.

Two things have changed since 2026-07-27.

**The deadline is discharged.** The port shipped at [0012](0012-flatten-repo-after-cutover.md).
Nothing is racing.

**The cost of writing one has been measured, four times.** [0052](0052-one-markdown-engine-of-our-own.md)
retired four Markdown libraries for an engine that scores 648/652 on CommonMark and 24/24 on GFM,
and made saving a long draft twenty times faster. Then, on one day, four more went: a ZIP reader,
a QR encoder, an XML reader and an HTML-to-Markdown converter. Every one of them came out
BETTER than the library it replaced, and not by accident — a library is written for everyone,
and this is written for one blog:

| Replaced | What the library got wrong here |
|:--|:--|
| `fflate` | read a UTF-8 filename as one byte per character: `tiếng-việt.html` arrived as mojibake |
| `qrcode-generator` | scores mask patterns by three rules that are not the specification's |
| `fast-xml-parser` | guessed types, so a post id of `007` became the number 7 |
| `turndown` | had no rule for `<mark>` or `<u>`, so an imported highlight arrived flat |
| `nodemailer` | sent credentials to a relay that offered no encryption |

Measured against the golden corpus, the replacement for `turndown` came back correct on fifteen
fixtures where that library did not, and on none the other way round.

## Decision

**Writing it here is the default answer. A dependency is the exception, and adding one is the
owner's decision, not a session's.**

Three tiers, and which one a package is in is the whole argument:

**A. The floor.** Bun, SQLite through `bun:sqlite`, and the TLS the runtime provides. These are
what the code runs ON. There is no version of this rule that reaches them.

**B. Named exceptions, kept because writing them would make the product WORSE, not merely
slower.** Each one is on the allowlist in `scripts/checks/deps.ts` with its reason:

- `sharp` — image codecs. A hand-written JPEG or AVIF decoder, on a public upload route, on the
  owner's own machine, is a memory-safety surface nobody here would audit. This is the clearest
  case in the list and it is not close.
- `shiki` — the value is hundreds of TextMate grammars, not the code that reads them.
- `temml` — LaTeX is a language, not a syntax.
- `satori` — HTML and CSS to SVG, for the social card.
- `@modelcontextprotocol/sdk` — a protocol under somebody else's revision, not a convenience.
  It carries `zod`, which is therefore also exempt until the SDK is: removing `zod` from this
  repository's own eight files would not remove it from the install.

**C. Everything else goes**, on a schedule the owner sets. Tailwind, React and Tiptap are in this
tier and are the remaining work.

A package NOT on the allowlist fails `check:deps`. That is the part [0005](0005-rewrite-in-bun-hono-sqlite.md)
did not have and the reason this drifted: the rule was never written down, so there was nothing
for a check to hold.

## Consequences

- `marked`, `markdown-it`, `tiptap-markdown`, `prosemirror-markdown`, `fflate`,
  `qrcode-generator`, `fast-xml-parser`, `turndown`, `turndown-plugin-gfm` and `nodemailer` are
  gone. Runtime dependencies went from 13 to 7.
- **Every replacement carries the gate that was used to prove it**, and the gate is always the
  same shape: run both, compare, then delete the old one and keep the comparison as a fixture.
  2331 QR grids, 45 corpus documents, every field of a WordPress export, three archives written
  by Info-ZIP.
- The tree is bigger. `src/md` alone is 5,254 lines, and the four replacements above add about
  1,800 more. That is the price, it is paid once, and it is paid in code this project can read.
- **A security surface moves in-house with the code.** The XML reader has no DTD path at all, so
  the billion-laughs expansion is impossible rather than disabled; the ZIP reader caps what one
  entry may inflate to; the SMTP client refuses to put a password on an unencrypted wire. Each
  of those is better than what it replaced, and each is now this project's to maintain.
- **This does not reach `devDependencies` that never ship.** `typescript` and `@types/bun` are
  tools, not parts of the product, and they are on the allowlist as such.
