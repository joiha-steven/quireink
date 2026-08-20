# Colour — theme tokens, modes and palettes (HARD RULES)

- Theme default = **the owner's `defaultScheme` setting** (Admin → Appearance → Default appearance: `system` | `light` | `dark`), server-rendered onto `<body data-default-scheme>` and read by `assets/js/theme.ts`, which falls back to `system`. A reader's saved pick always wins; the toggle
  reflects the *applied* theme (`useSyncExternalStore` on `<html>.dark`; server snapshot =
  light → no hydration mismatch).
- Two orthogonal axes: **mode** (`.dark`) × **palette** (`data-palette`). Both controls live in
  `assets/js/theme.ts` and write localStorage plus the attribute. ⚠️ Two things differ from the
  frozen tree: there is **no no-FOUC script** (2.0 has no inline script anywhere — CSS decides the
  first paint, see [performance.md](../performance.md)), and only the **enabled** palettes' vars are
  emitted, not all six.
- **One accent, one token.** `--c-accent` (per palette, editable in Admin → Appearance) paints the
  active rail marker and the title hover underline. It is seeded from each palette's `link`, so
  Mono stays monochrome. Never hardcode a highlight colour.
- **Public UI colours come ONLY from theme tokens — never hardcode `neutral-*`/`white`/`black`
  or a hex.** Vars `--c-bg/text/heading/meta/link/rule` are utilities (`bg-bg`, `text-text`,
  `text-heading`, `text-meta`, `text-link`, `border-rule`). Every line/border + faint surface
  (code blocks, hovers, banners) uses `--c-rule`. Admin tooling may stay neutral.
