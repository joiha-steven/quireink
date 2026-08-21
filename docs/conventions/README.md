> Split from CLAUDE.md, and split again on 2026-08-11 when the single file reached 400 of 400
> lines — read when touching typography, header alignment, layout, colour, motion, IDE chrome,
> i18n, scripts or a release. Hard rules used everywhere stay in
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
| [ide-chrome.md](ide-chrome.md) | `settings.ideChrome`: what the switch is allowed to touch, and what it must not |
| [i18n.md](i18n.md) | `src/locales/`, adding a language, adding a string |
| [scripts.md](scripts.md) | What is a script and what is not |
| [releases.md](releases.md) | Which doc a change updates, keeping instance values out, versioning, cutting a release — **and that a GitHub release publishes the Docker image, with no second step** |

Two rules govern the set. **One rule lives in exactly one file** — if a rule appears to belong
in two, it belongs in the one a person would open first, and the other links to it. And **a
file at the cap gets split, not squeezed**: `check:docs` fails a markdown file over 400 lines
and warns from 360, which is what produced this directory.
