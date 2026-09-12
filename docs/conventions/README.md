> Read when touching typography, header alignment, layout, colour, motion, the looks, i18n,
> scripts or a release. Hard rules used everywhere stay in
> [`CLAUDE.md`](../../CLAUDE.md); these files are the per-area detail.

# Conventions (detail)

One surface per file, the same seam [ADR 0010](../decisions/0010-four-homes-doc-layout.md)
used for [`docs/features/`](../features/). The cut is by what you are touching, because that
is what you know when you come looking: a rule about a colour is in `colour.md` whether it
governs the reader, the rail or the admin.

| File | Holds |
|---|---|
| [type.md](type.md) | The 9 roles and their three numbers, `--type-scale` and book mode, the two font handles and the four presets |
| [layout.md](layout.md) | Header alignment, the section break, chrome reuse, the divider, the rail, the article's right gutter, tag display |
| [colour.md](colour.md) | Theme tokens, mode × palette, the one accent |
| [motion.md](motion.md) | The three duration tokens, the one switch that gates all motion |
| [looks.md](looks.md) | `settings.look`: the four dialects the public site can wear, what each is allowed to touch, and what none of them may |
| [i18n.md](i18n.md) | `locales/`, adding a language, adding a string |
| [scripts.md](scripts.md) | What is a script and what is not |
| [releases.md](releases.md) | Which doc a change updates, keeping instance values out, versioning, cutting a release — **and that a GitHub release publishes the Docker image, with no second step** |

The rule that governs the set, one rule in exactly one file, is stated once in
[`../README.md`](../README.md). Its corollary is what produced this directory: **a file at the
cap gets split, not squeezed** (`check:docs` fails a markdown file over 400 lines and warns
from 360).
