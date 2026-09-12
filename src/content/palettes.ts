// The six built-in palettes, as colour values.
//
// Split out of `themes.ts` on 2026-08-11, when that file passed its 400-line ceiling. The seam
// is by reader: somebody adjusting a hex value or adding a seventh palette opens this file and
// needs the contrast rule below; somebody changing how a palette BECOMES a stylesheet opens
// `themes.ts` and needs none of it. Nothing here has any logic.

import type { ThemeSettings } from '@/types'
import type { ThemePreset } from '@/content/themes'

// ═══ ONE ARCHITECTURE, SIX HUES ═══ rebalanced 2026-09-13.
//
// Every token is solved for a CONTRAST against its own paper, so the six differ in hue and
// in nothing else. They had drifted into six separate designs: body text ran 10.22:1 on
// Sepia against 14.75:1 on Mono, headings 13.83 against 18.26, and the same words came out
// a third heavier or lighter depending on a choice that should only have changed a colour.
//
//   light   text 13.0 · heading 17.0 · meta 5.1 · link 5.6 · rule 1.26
//   dark    text 13.0 · heading 17.0 · meta 5.3 · link 8.0 · rule 1.34
//
// Measured after: text 12.88–13.08, heading 16.92–17.10, meta 4.96–5.12, link 5.54–5.61,
// rule 1.26 flat. Hue and chroma are read off the old colour and put back untouched; only
// the lightness moved, and it moved in OKLCH so the steps are perceptual. That is the same
// move the 2026-07-26 meta audit made, applied to the whole set.
//
// WHY `rule` MATTERS MORE THAN IT DID. It used to draw hairlines between cards. The
// notebook look now draws it at full strength under every line of every paragraph, so it is
// a SURFACE: at 1.16 (the old Mono) the page is unruled, at 1.25 (the old Sepia) it reads as
// ruled paper. 1.26 for all six, which also gives every other look a hairline with some
// presence.
//
// `meta` keeps its own floor: it is rendered at 14px on post meta lines, card excerpts and
// the footer, so WCAG AA 4.5:1 applies and the target sits above it on purpose. Audited
// 2026-07-26 at 2.91–3.60:1; keep any new palette above 4.5:1 or it fails the same way.
//
// AND NOBODY'S BLOG MOVES. `settings.themes` holds a per-blog COPY of all six, seeded at
// install, and `sanitizeThemes` reads that copy before it reads these constants. So an
// existing blog keeps what it has whether or not its owner ever edited a colour; a fresh
// install gets these; and the admin's Reset restores from here, which is what makes it a
// way back to the CURRENT built-ins rather than to the ones that shipped that year.
//
// TRUE neutral grayscale — zero hue, the Quire Ink house style.
const MONO: ThemeSettings = {
  light: { bg: '#fcfcfc', text: '#30302f', heading: '#1a1919', meta: '#6d6c6c', link: '#1a1919', accent: '#1a1919', rule: '#e3e2e2' },
  dark: { bg: '#0e0e0e', text: '#d4d4d3', heading: '#f1f0f0', meta: '#868685', link: '#f1f0f0', accent: '#f1f0f0', rule: '#2a2a29' },
}

// Warm paper + brown ink — classic long-read comfort, terracotta accent.
const SEPIA: ThemeSettings = {
  light: { bg: '#fcf7ed', text: '#372a1e', heading: '#1d140a', meta: '#736959', link: '#91552e', accent: '#91552e', rule: '#e8ddc8' },
  dark: { bg: '#1a140e', text: '#e5d8c4', heading: '#fff6e4', meta: '#968974', link: '#db9f6f', accent: '#db9f6f', rule: '#362d22' },
}

// Earthy greens — calm, natural, forest-green accent.
const FOREST: ThemeSettings = {
  light: { bg: '#f5f7f2', text: '#262e26', heading: '#0f170f', meta: '#646b60', link: '#336f43', accent: '#336f43', rule: '#d8dfd3' },
  dark: { bg: '#0f140f', text: '#d1dacc', heading: '#f0f7ec', meta: '#808d7a', link: '#7db78c', accent: '#7db78c', rule: '#262f23' },
}

// Cool blues — crisp and editorial, ocean-blue accent. A BLUE PAGE: the paper carries real
// blue and the ink is blue-grey through and through. It and Sci-Fi below had become the same
// palette — papers at L97 with chroma 5 and 4, inks at L31 and L28 with chroma 24 and 23 —
// so the only thing telling them apart was a link, and a page can go a screen without one.
const OCEAN: ThemeSettings = {
  light: { bg: '#f0f8ff', text: '#212d3b', heading: '#091623', meta: '#616b73', link: '#2466a7', accent: '#2466a7', rule: '#d1dfed' },
  dark: { bg: '#031127', text: '#cad8e6', heading: '#edf4fd', meta: '#7c8a97', link: '#6fafe6', accent: '#6fafe6', rule: '#1b2d42' },
}

// Sci-fi — a GRAPHITE page with an electric mark on it, which is the other half of the split
// with Ocean above: the paper and the ink give up almost all their colour, and the accent
// goes further into cyan and gets brighter. The dark mode (near-black graphite + bright
// cyan) is where it reads as sci-fi.
const SCIFI: ThemeSettings = {
  light: { bg: '#f6f8f7', text: '#292d31', heading: '#141619', meta: '#666a70', link: '#006f75', accent: '#006f75', rule: '#dcdfe1' },
  dark: { bg: '#0d0f11', text: '#d1d5d8', heading: '#eef2f3', meta: '#81888d', link: '#00b9c4', accent: '#00b9c4', rule: '#262a2f' },
}

// Warm-neutral surface with a vivid amber accent — confident and bright.
const AMBER: ThemeSettings = {
  light: { bg: '#fcfbf8', text: '#322e2a', heading: '#1c1915', meta: '#6f6b65', link: '#975500', accent: '#975500', rule: '#e5e1d9' },
  dark: { bg: '#100f0d', text: '#d9d5cc', heading: '#f5f1eb', meta: '#8b867d', link: '#e09932', accent: '#e09932', rule: '#2d2a25' },
}

// Order = display order in the picker. First entry is the default.
export const THEME_PRESETS: ThemePreset[] = [
  { id: 'mono', name: 'Mono', theme: MONO },
  { id: 'sepia', name: 'Sepia', theme: SEPIA },
  { id: 'forest', name: 'Forest', theme: FOREST },
  { id: 'ocean', name: 'Ocean', theme: OCEAN },
  { id: 'scifi', name: 'Sci-Fi', theme: SCIFI },
  { id: 'amber', name: 'Amber', theme: AMBER },
]
