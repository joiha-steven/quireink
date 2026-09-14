# 0009. Pin the `opsz` axis in the bundled variable fonts

Date: 2026-07-27
Status: accepted · reverses an earlier undocumented decision to keep the axis
In force: see the [index](README.md). The index is maintained; this file is not.

## Context

`scripts/subset-font-weights.py` clamped `wght` to 400-700 and said, in its own docstring,
that `opsz` is KEPT because `globals.css` sets `font-optical-sizing: auto` on purpose.

Measuring the font directory showed what that cost:

```
literata-latin.woff2   300 glyphs, opsz + wght    80,660 B
inter-latin.woff2      518 glyphs, wght only      36,116 B
```

Literata carries 42% fewer glyphs than Inter and was 2.2x the size, entirely because `gvar`
stores deltas for every glyph across the optical range. Production runs Literata with
`language: vi`, so the LCP preload was `literata-latin` **plus** `literata-vietnamese`:
97,588 B on the critical path.

## Decision

Pin `opsz` to 18. Keep `wght` as a range. The script is renamed
`scripts/subset-font-axes.py` since it now handles both axes.

18 was chosen by rendering 14 / 18 / 24 side by side and looking at them: body copy is
18px, so pinning at 18 leaves the body identical to what `font-optical-sizing: auto`
produced. Narrowing the range instead was measured and is not competitive (`12-24` still
costs 58 KB against 37.5 KB pinned).

## Consequences

- Preload set 97,588 to 46,212 B, down 53%. 180 KB off the font directory overall.
- A 36px title now renders in the 18pt design, slightly heavier than before. This is the
  price, and it was accepted with the comparison in front of us.
- `font-optical-sizing: auto` stays in `globals.css`, because an uploaded custom font can
  still carry the axis.
- **Method note:** an intermediate conclusion that "the site uses Inter, so this does not
  matter" came from a local build. `.env.local` points at a dev database whose `settings`
  row differs from production. Anything settings-dependent is read off the box.
