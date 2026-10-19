# The admin's icons and the rail's lines

Split from [`admin-design.md`](./admin-design.md), which is at its line cap. Everything there still
applies; this holds the measured rules for glyphs and for the rail they stand in.

## Icons

- **One stroke language.** Every glyph is drawn from `src/icons.ts` at its own weights and a
  wrapper never types one: `iconSvg()` for markup, `ICON_STROKE` for a DOM builder, `GLYPH_STROKE`
  for the 48-unit empty-state drawings (1.1 of 48 is the 2.2px a 96px picture needs where 1.8 of 24
  would be 7.2px). The same glyph size therefore always carries the same ink: 1.5px at 20, 1.35 at
  the rail's 18, 1.2 at 16. A glyph the set lacks is added to the set, in its style, before it is
  drawn (the sign-in eye and key were at 1.7 on a copy of their own until then).
  `src/web/admin/stroke-language.test.ts` fails on any other literal weight under the admin or the
  sign-in page; check ticks and chart lines are listed there as not-glyphs, each with the file that
  holds it.
- **A glyph's ink is centred on (12, 12) of its own box**, measured on the rendered bounding box,
  so the rail can stack them in one column with no per-row nudge. `searchCentred` sits
  between box and mass, where a thin tail makes the two disagree. `log` is centred on its stroke
  MASS instead, 1.5 units right of its box, because the tour's `even: the shut rail draws its
  icons on one column` measures mass to 0.6px; a box-and-mass compromise failed it at 0.63px.

## The rail

**The rail's lines** (measured at 1440, glyphs 18px, open rail 208px): three vertical lines and no
others. The rail's 12px padding is the first: row boxes, the active highlighter, the wordmark's box,
the first footer key and the search row all start there, and the highlighter's right edge is the
mirror at 196. The glyph column is the second: every destination's glyph ink is centred at 33
(a sub-row's at 49, one 16px step in, the guide line standing on the glyph boxes' left edge at
24), and the collapsed rail centres the same glyphs on its 72px midline at 36. The label column is
the third, 54 (70 in the group). Destinations are 40px, the footer's keys 32px, the search key 36px;
rows keep their height on a short window and the column scrolls. Labels are 14px/500, on the type
scale: the weight, not a 15px step, is what lifts them above a table cell.
