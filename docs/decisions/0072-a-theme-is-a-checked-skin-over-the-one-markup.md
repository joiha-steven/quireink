# 0072 — A theme is a checked skin over the one markup, and anyone may write one

Date: 2026-10-11
Status: accepted; reverses the "no theme gallery" stance in [appearance.md](../appearance.md) and the four-look ceiling in [looks.md](../conventions/looks.md), which were documentation and never an ADR
In force: see the [index](README.md). The index is maintained; this file is not.

## Context

The reading pages wear one of four looks (`plain`, `code`, `paper`, `notes`). Each is one
stylesheet over markup every look shares, linked only while it is worn. The docs refused more:
a theme gallery is a promise to keep every theme working forever, and four was the ceiling.

That promise is the real cost, and the code already carries most of what keeping it takes:

- The markup is one set of TS render functions for every look. A look changes no HTML and no JS.
- Colour, type and shape reach the page as custom properties generated from settings, and
  `looks.test.ts` already refuses a hex in any look's sheet.
- `appearance-contract.ts` lists the names the product promises to keep (23 variables, 16
  selectors) and `check:contract` holds them.

What is missing is measured: the three sheets target about 75 classes outside the contract,
11 of them on the composed front page, which the contract does not name at all. Nine places in
TS branch on the look's name (the menu moved to the header, a display face, localised figure
labels, a rail prefix). And a look can override the owner's settings: the chrome-font control
draws nothing in three of the four looks, because each sets `body{font-family}`.

## Decision

A **theme** replaces the look. It is a zip holding `theme.json`, one `theme.css`, a screenshot,
and optional woff2 fonts and images. **No HTML and no JavaScript**: the markup stays the
engine's.

1. **A theme sits over `plain`, never in place of it.** What a theme does not style renders as
   the base does, so a feature added later appears in every installed theme.
2. **The theme API is the appearance contract, versioned.** A theme declares `"api": N`. The
   contract grows to cover every public surface in groups, including the front page. Removing
   or renaming a name raises the API, and the previous API is still read for at least one
   minor release.
3. **The owner's settings always reach the page.** Colours come only from palettes; a theme
   adds palettes to the palette menu rather than writing colours. Font families and sizes come
   only from the engine's variables; a theme adds fonts as choices. `!important` is refused.
   The owner's custom CSS wins over the theme regardless of specificity.
4. **The rules are checked by the engine at install, not promised by the author.** One checker,
   built on a CSS tokenizer that reads as a browser does, runs on upload and from the command
   line. It enforces the rules above, refuses selectors outside the contract, refuses
   `@import`, `@font-face`, remote or `data:` URLs and text in `content:`, refuses a theme that
   styles only one of the blog surfaces and the front page, and bounds the zip (paths, count,
   size, expansion, active SVG content).
5. **Layout differences are switches the manifest declares**, from a list the engine owns. The
   nine name branches become switches. Whatever a built-in theme can do, an installed theme can
   do: a built-in that needs something the standard lacks fixes the standard, not an exception.
6. **The four looks become four built-in themes that pass the same checker**, and
   `settings.look` is read as `settings.theme` with the same values.
7. Sign-in, setup, restore and the admin are not themed.

## Consequences

- The contract becomes an API with outside users. Changing public markup now means checking
  the contract, and that is the point: today a custom stylesheet breaks silently on update.
- The CSS tokenizer is a security boundary for stylesheets written by strangers. It gets its
  own hostile-input tests and a security review before upload ships.
- The conversion of the three sheets must be pixel-identical under default settings across
  every theme, page type, width and scheme. The one intended difference: a blog that chose a
  chrome font now sees it.
- `docs/appearance.md`, `docs/conventions/looks.md` and the README lines that say "four looks"
  change in the commits that ship the behaviour, not before.
- No gallery or review service is part of this decision. A theme installed from a zip is
  labelled unreviewed in the admin.
