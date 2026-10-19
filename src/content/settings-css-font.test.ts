import { describe, expect, it } from 'bun:test'
import { fontToCss } from '@/content/settings-css'
import { getFontPreset, DEFAULT_FONT_PRESET } from '@/content/fonts'
import type { FontSettings } from '@/types'
import type { ThemeFont } from '@/theme/types'

const custom: FontSettings = {
  family: 'My Face',
  faces: [{ weight: 400, url: '/uploads/my-face.woff2' }],
}
const themeReading: ThemeFont = {
  id: 'body-serif',
  name: 'Body Serif',
  role: 'reading',
  faces: [{ file: 'fonts/body-serif.woff2', weight: 400, style: 'normal' }],
}

describe('fontToCss fallback', () => {
  it('never references a variable the engine does not define', () => {
    expect(fontToCss(custom, { readingPreset: DEFAULT_FONT_PRESET, reading: null })).not.toContain('--font-inter')
  })

  it('falls back to the preset stack drawn without the custom font', () => {
    expect(fontToCss(custom, { readingPreset: 'inter', reading: null }))
      .toContain(`--font-reading:'My Face', ${getFontPreset('inter').stack}}`)
  })

  it('falls to the theme reading family first, then the preset stack', () => {
    expect(fontToCss(custom, { readingPreset: DEFAULT_FONT_PRESET, reading: themeReading }))
      .toContain(`--font-reading:'My Face', 'theme-body-serif', ${getFontPreset(DEFAULT_FONT_PRESET).stack}}`)
  })
})
