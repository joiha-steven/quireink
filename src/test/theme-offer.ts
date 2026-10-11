// An installed theme as the Appearance screen is handed it (ADR 0072, T2c part 2): the list's entry
// and what it adds to the pickers, for the tests that draw the screen without a database. Two
// palettes (one with a forty-character name), a reading and a chrome font, a display font the
// pickers leave out, a suggestion of each kind, and the table header it draws itself.
import type { InstalledTheme, ThemeOffer } from '@/content/installed-themes'
import type { ThemeFont, ThemePalette } from '@/theme'

export const INK_HASH = 'e'.repeat(64)

const colours = (bg: string) => ({ bg, text: '#222222', heading: '#111111', meta: '#555555', link: '#1a4d8f', rule: '#e0d8c0', accent: '#b4472a' })

export const INK_PAPER: ThemePalette = { id: 'ink-paper', name: 'Ink paper', light: colours('#fbf6ea'), dark: { ...colours('#14110d'), text: '#eeeeee', heading: '#ffffff', meta: '#aaaaaa' } }
/** Forty characters, the most the checker lets a palette's name be. */
export const LONG_PALETTE_NAME = 'A palette whose name runs to forty chars'
export const INK_NIGHT: ThemePalette = { ...INK_PAPER, id: 'ink-night', name: LONG_PALETTE_NAME, light: colours('#e9f0f7') }

const face = (file: string) => [{ file, weight: 400, style: 'normal' as const }]
export const INK_SERIF: ThemeFont = { id: 'ink-serif', name: 'Ink Serif', role: 'reading', faces: face('fonts/serif.woff2') }
export const INK_SANS: ThemeFont = { id: 'ink-sans', name: 'Ink Sans', role: 'chrome', faces: face('fonts/sans.woff2') }

export const INKWELL_OFFER: ThemeOffer = {
  id: 'inkwell', name: 'Inkwell', hash: INK_HASH,
  palettes: [INK_PAPER, INK_NIGHT],
  fonts: [INK_SERIF, INK_SANS],
  suggests: { palette: 'ink-paper', readingFont: 'ink-serif', chromeFont: 'ink-sans' },
}

export const INKWELL: InstalledTheme = {
  id: 'inkwell',
  current: {
    version: '1.0.0', hash: INK_HASH, installedAt: 1, name: 'Inkwell', author: 'A. Writer', description: null,
    license: 'MIT', homepage: null, api: 1, screenshot: `/themes/${INK_HASH}/screenshot.webp`,
  },
  previous: [],
  active: false,
  reviewed: false,
  readable: true,
  ownsSettings: ['table.head'],
}
