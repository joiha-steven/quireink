// The six built-in palettes, as colour values.
//
// Split out of `themes.ts` on 2026-08-11, when that file passed its 400-line ceiling. The seam
// is by reader: somebody adjusting a hex value or adding a seventh palette opens this file and
// needs the contrast rule below; somebody changing how a palette BECOMES a stylesheet opens
// `themes.ts` and needs none of it. Nothing here has any logic.

import type { ThemeSettings } from '@/types'
import type { ThemePreset } from '@/content/themes'

// TRUE neutral grayscale — zero hue, the Quire Ink house style. (Earlier values had a
// faint warm/blue cast: bg/rule read as cream, meta/text leaned blue. All pure gray
// now; `rule` is a touch lighter so the menu hover reads as a soft, colourless gray.)
//
// Every LIGHT `meta` (and the scifi/amber `link`) is set to the lightest value that
// still clears WCAG AA 4.5:1 against its own `bg` — meta is rendered at 14px on post
// meta lines, card excerpts and the footer, so AA applies. Audited 2026-07-26: the
// previous values sat at 2.91–3.60:1. Hue and saturation are unchanged; only value
// moved. Keep new palettes above 4.5:1 (`meta` vs `bg`) or they fail the same way.
const MONO: ThemeSettings = {
  light: { bg: '#fcfcfc', text: '#262626', heading: '#121212', meta: '#6d6d6d', link: '#121212', accent: '#121212', rule: '#ebebeb' },
  dark: { bg: '#0e0e0e', text: '#d6d6d6', heading: '#f2f2f2', meta: '#888888', link: '#f2f2f2', accent: '#f2f2f2', rule: '#262626' },
}

// Warm paper + brown ink — classic long-read comfort, terracotta accent.
const SEPIA: ThemeSettings = {
  light: { bg: '#f6f1e7', text: '#44372a', heading: '#2c2218', meta: '#706657', link: '#955832', accent: '#955832', rule: '#e3d8c4' },
  dark: { bg: '#211b14', text: '#ddd0bd', heading: '#f2e9d8', meta: '#9c8e79', link: '#d79b6c', accent: '#d79b6c', rule: '#3a3025' },
}

// Earthy greens — calm, natural, forest-green accent.
const FOREST: ThemeSettings = {
  light: { bg: '#f5f7f2', text: '#2c352c', heading: '#1c241c', meta: '#646c60', link: '#3b764a', accent: '#3b764a', rule: '#dde5d8' },
  dark: { bg: '#0f140f', text: '#cdd6c8', heading: '#e9efe5', meta: '#7e8a78', link: '#79b389', accent: '#79b389', rule: '#252e23' },
}

// Cool blues — crisp and editorial, ocean-blue accent.
const OCEAN: ThemeSettings = {
  light: { bg: '#f4f7fa', text: '#28323d', heading: '#16202b', meta: '#616b74', link: '#2b6cae', accent: '#2b6cae', rule: '#dbe4ec' },
  dark: { bg: '#0c121a', text: '#c7d2dd', heading: '#e8eef5', meta: '#7c8a98', link: '#6aa9e0', accent: '#6aa9e0', rule: '#202a36' },
}

// Sci-fi — cool graphite surface with an electric cyan accent. Crisp + techy;
// the dark mode (deep blue-black + bright cyan) is where it really reads as sci-fi.
const SCIFI: ThemeSettings = {
  light: { bg: '#f2f5f7', text: '#1e2a33', heading: '#0d161e', meta: '#5f6a75', link: '#0b7284', accent: '#0b7284', rule: '#dce4ea' },
  dark: { bg: '#0a0f15', text: '#c3d2dc', heading: '#e7f1f7', meta: '#778591', link: '#36cfe0', accent: '#36cfe0', rule: '#1b2630' },
}

// Warm-neutral surface with a vivid amber accent — confident and bright.
const AMBER: ThemeSettings = {
  light: { bg: '#fcfbf8', text: '#2e2a26', heading: '#1a1714', meta: '#716c66', link: '#9f5c09', accent: '#9f5c09', rule: '#ece7df' },
  dark: { bg: '#100f0d', text: '#d6d2ca', heading: '#f3f0ea', meta: '#8a857c', link: '#e8a13c', accent: '#e8a13c', rule: '#272420' },
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
