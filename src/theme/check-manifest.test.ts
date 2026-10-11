// theme.json (A6): every field in its shape, unknown keys refused at every level, and a
// palette held to the contrast floor the six built-in palettes clear.
import { describe, expect, it } from 'bun:test'
import { THEME_PRESETS } from '@/content/themes'
import { checkThemeManifest } from '@/theme/check-manifest'
import type { ThemeManifest } from '@/theme/types'

const OPTS = {
  supportedApi: [1],
  reservedIds: new Set(['plain', 'code', 'paper', 'notes']),
  reservedPaletteIds: new Set(['mono', 'sepia']),
  reservedFontIds: new Set(['literata', 'inter']),
  packageFiles: new Set(['theme.json', 'theme.css', 'screenshot.webp', 'fonts/serif-700.woff2', 'fonts/serif-400i.woff2']),
}

const LIGHT = { bg: '#ffffff', text: '#1a1a1a', heading: '#000000', meta: '#595959', link: '#0645ad', rule: '#dddddd', accent: '#0645ad' }
const DARK = { bg: '#111111', text: '#e6e6e6', heading: '#ffffff', meta: '#a0a0a0', link: '#8ab4f8', rule: '#333333', accent: '#8ab4f8' }

const FULL = {
  api: 1,
  id: 'broadsheet',
  name: 'Broadsheet',
  version: '1.0.0',
  author: 'A. Author',
  homepage: 'https://example.com/broadsheet',
  license: 'MIT',
  description: 'One sentence.',
  layout: { menu: 'header' },
  palettes: [{ id: 'newsprint', name: 'Newsprint', light: LIGHT, dark: DARK }],
  fonts: [{
    id: 'serif', name: 'Serif', role: 'display',
    faces: [{ file: 'fonts/serif-700.woff2', weight: 700, style: 'normal' }, { file: 'fonts/serif-400i.woff2', weight: 400, style: 'italic' }],
  }],
  suggests: { palette: 'mono', readingFont: 'literata', chromeFont: 'inter' },
}
const MINIMAL = { api: 1, id: 'min', name: 'Min', version: '0.1.0', author: 'Me', license: 'MIT' }

/** The A6 subjects for `raw`, or the manifest when it passes. */
function failures(raw: unknown): string[] {
  const r = checkThemeManifest(raw, OPTS)
  if (r.ok) return []
  for (const v of r.violations) expect([v.rule, v.file, v.line, v.col]).toEqual(['A6', 'theme.json', 0, 0])
  return r.violations.map((v) => v.subject)
}
const withField = (key: string, value: unknown) => ({ ...FULL, [key]: value })

describe('A6: theme.json', () => {
  it('accepts the full example and returns it typed, as a fresh object', () => {
    const r = checkThemeManifest(FULL, OPTS)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const m: ThemeManifest = r.manifest
    expect(m).toEqual(FULL as ThemeManifest)
    expect(m).not.toBe(FULL as unknown)
  })

  it('accepts the minimal manifest, with no optional key invented', () => {
    const r = checkThemeManifest(MINIMAL, OPTS)
    expect(r.ok && Object.keys(r.manifest).sort()).toEqual(Object.keys(MINIMAL).sort())
  })

  it('refuses anything that is not an object', () => {
    for (const raw of [null, [], 'x', 1]) expect(failures(raw)).toEqual([''])
  })

  it('refuses an unsupported api and a reserved, malformed or long id', () => {
    expect(failures(withField('api', 2))).toEqual(['api'])
    expect(failures(withField('api', '1'))).toEqual(['api'])
    expect(failures(withField('id', 'paper'))).toEqual(['id'])
    expect(failures(withField('id', 'Broad_Sheet'))).toEqual(['id'])
    expect(failures(withField('id', '-a'))).toEqual(['id'])
    expect(failures(withField('id', 'a'.repeat(41)))).toEqual(['id'])
    expect(failures(withField('id', 'a'.repeat(40)))).toEqual([])
  })

  it('bounds the text fields and refuses control characters', () => {
    expect(failures(withField('name', ''))).toEqual(['name'])
    expect(failures(withField('name', 'n'.repeat(61)))).toEqual(['name'])
    expect(failures(withField('author', 'a'.repeat(81)))).toEqual(['author'])
    expect(failures(withField('license', 'l'.repeat(41)))).toEqual(['license'])
    expect(failures(withField('description', 'd'.repeat(201)))).toEqual(['description'])
    expect(failures(withField('name', 'Bad\u0007name'))).toEqual(['name'])
  })

  it('refuses a version that is not x.y.z', () => {
    for (const v of ['1.0', '1.0.0-beta', 'v1.0.0', '01.0.0', 1]) expect(failures(withField('version', v))).toEqual(['version'])
  })

  it('refuses a homepage that is not https', () => {
    for (const h of ['http://example.com', 'javascript:alert(1)', 'https://user:pw@example.com/', '//example.com']) {
      expect(failures(withField('homepage', h))).toEqual(['homepage'])
    }
  })

  it('refuses an unknown layout switch or value', () => {
    expect(failures(withField('layout', { menu: 'sidebar' }))).toEqual(['layout.menu'])
    expect(failures(withField('layout', { menu: 'rail', footer: 'x' }))).toEqual(['layout.footer'])
  })

  it('refuses unknown keys at every level, __proto__ included', () => {
    expect(failures({ ...FULL, extra: 1 })).toEqual(['extra'])
    expect(failures(JSON.parse('{"api":1,"id":"a","name":"A","version":"1.0.0","author":"a","license":"MIT","__proto__":{"x":1}}')))
      .toEqual(['__proto__'])
    expect(failures(withField('suggests', { palette: 'mono', theme: 'y' }))).toEqual(['suggests.theme'])
    expect(failures(withField('palettes', [{ ...FULL.palettes[0], extra: true }]))).toEqual(['palettes[0].extra'])
    expect(failures(withField('palettes', [{ ...FULL.palettes[0], light: { ...LIGHT, shadow: '#000000' } }])))
      .toEqual(['palettes[0].light.shadow'])
  })
})

describe('A6: palettes', () => {
  it('refuses more than 8, a duplicate id, a missing colour or one not #rrggbb', () => {
    const p = FULL.palettes[0]!
    expect(failures(withField('palettes', Array.from({ length: 9 }, (_, i) => ({ ...p, id: `p${i}` }))))).toEqual(['palettes'])
    expect(failures(withField('palettes', [p, p]))).toEqual(['palettes[1].id'])
    const { accent: _accent, ...noAccent } = LIGHT
    expect(failures(withField('palettes', [{ ...p, light: noAccent }]))).toEqual(['palettes[0].light.accent'])
    expect(failures(withField('palettes', [{ ...p, dark: { ...DARK, bg: '#111' } }]))).toEqual(['palettes[0].dark.bg'])
    expect(failures(withField('palettes', [{ ...p, dark: { ...DARK, bg: 'black' } }]))).toEqual(['palettes[0].dark.bg'])
  })

  it('refuses a palette id a built-in palette already uses', () => {
    expect(failures(withField('palettes', [{ ...FULL.palettes[0]!, id: 'sepia' }]))).toEqual(['palettes[0].id'])
  })

  it('refuses a text role under 5.0:1 against its page, naming the role', () => {
    const p = FULL.palettes[0]!
    // #767676 on white is 4.54:1: WCAG AA, and under the floor every built-in palette clears.
    expect(failures(withField('palettes', [{ ...p, light: { ...LIGHT, meta: '#767676' } }]))).toEqual(['palettes[0].light.meta'])
    expect(failures(withField('palettes', [{ ...p, dark: { ...DARK, link: '#3366cc' } }]))).toEqual(['palettes[0].dark.link'])
  })

  it('does not hold rule and accent to the text floor, as the built-in check does not', () => {
    const p = FULL.palettes[0]!
    expect(failures(withField('palettes', [{ ...p, light: { ...LIGHT, rule: '#f4f4f4', accent: '#f0f0f0' } }]))).toEqual([])
  })

  it('accepts every built-in palette, so the floor is the one they already clear', () => {
    const palettes = THEME_PRESETS.map((preset) => ({ id: `t-${preset.id}`, name: preset.id, light: preset.theme.light, dark: preset.theme.dark }))
    expect(failures(withField('palettes', palettes))).toEqual([])
  })
})

describe('A6: fonts and suggests', () => {
  const font = FULL.fonts[0]!
  const face = font.faces[0]!
  const withFaces = (faces: unknown[]) => withField('fonts', [{ ...font, faces }])

  it('refuses more than 6 fonts, an unknown role, no faces or more than 4', () => {
    expect(failures(withField('fonts', Array.from({ length: 7 }, (_, i) => ({ ...font, id: `f${i}` }))))).toEqual(['fonts'])
    expect(failures(withField('fonts', [{ ...font, role: 'body' }]))).toEqual(['fonts[0].role'])
    expect(failures(withFaces([]))).toEqual(['fonts[0].faces'])
    expect(failures(withFaces([100, 200, 300, 400, 500].map((weight) => ({ ...face, weight }))))).toEqual(['fonts[0].faces'])
  })

  it('refuses a font id a built-in font already uses', () => {
    expect(failures(withField('fonts', [{ ...font, id: 'inter' }]))).toEqual(['fonts[0].id'])
  })

  it('refuses a face file outside fonts/, not woff2, or not in the package', () => {
    for (const file of ['fonts/missing.woff2', 'theme.css', 'images/serif-700.woff2', 'fonts/../theme.css', 'fonts/serif-700.ttf']) {
      expect(failures(withFaces([{ ...face, file }]))).toEqual(['fonts[0].faces[0].file'])
    }
  })

  it('refuses a weight off the hundreds or out of range, and an unknown style', () => {
    for (const weight of [50, 450, 1000, '700']) expect(failures(withFaces([{ ...face, weight }]))).toEqual(['fonts[0].faces[0].weight'])
    expect(failures(withFaces([{ ...face, style: 'oblique' }]))).toEqual(['fonts[0].faces[0].style'])
    expect(failures(withFaces([face, face]))).toEqual(['fonts[0].faces[1]'])
  })

  it('refuses a suggestion that is not a short string', () => {
    expect(failures(withField('suggests', { palette: 3 }))).toEqual(['suggests.palette'])
    expect(failures(withField('suggests', { readingFont: 'x'.repeat(41) }))).toEqual(['suggests.readingFont'])
  })
})

describe('A6: text the admin shows, and suggestions that exist', () => {
  const font = FULL.fonts[0]!

  it('refuses bidi overrides, zero-width characters and strings with nothing visible', () => {
    expect(failures(withField('author', 'Admin\u202Egnp.exe'))).toEqual(['author'])
    expect(failures(withField('name', '\u200B'))).toEqual(['name'])
    expect(failures(withField('description', ' \u3000 '))).toEqual(['description'])
    expect(failures(withField('license', 'MIT\u2060'))).toEqual(['license'])
    expect(failures(withField('palettes', [{ ...FULL.palettes[0]!, name: '\uFEFFInk' }]))).toEqual(['palettes[0].name'])
  })

  it('holds a font name to letters, digits, space, dot, underscore and hyphen', () => {
    expect(failures(withField('fonts', [{ ...font, name: 'Source Serif 4.1_b-c' }]))).toEqual([])
    expect(failures(withField('fonts', [{ ...font, name: 'Phông chữ' }]))).toEqual([])
    for (const name of ["x';}body{background:url(https://e.example/)}", 'a"b', 'a;b', 'a\\b']) {
      expect(failures(withField('fonts', [{ ...font, name }]))).toEqual(['fonts[0].name'])
    }
  })

  it('accepts a suggestion of the theme\'s own palette and font of the right role, or a built-in', () => {
    const reading = { ...font, id: 'body', role: 'reading' }
    const chrome = { ...font, id: 'ui', role: 'chrome' }
    expect(failures({ ...FULL, fonts: [font, reading, chrome], suggests: { palette: 'newsprint', readingFont: 'body', chromeFont: 'ui' } }))
      .toEqual([])
    expect(failures(withField('suggests', { palette: 'sepia', readingFont: 'inter', chromeFont: 'literata' }))).toEqual([])
  })

  it('refuses a suggestion that names nothing, or a font of another role', () => {
    expect(failures(withField('suggests', { palette: 'does-not-exist' }))).toEqual(['suggests.palette'])
    expect(failures(withField('suggests', { readingFont: 'serif' }))).toEqual(['suggests.readingFont'])
    expect(failures(withField('suggests', { chromeFont: 3 }))).toEqual(['suggests.chromeFont'])
  })
})
