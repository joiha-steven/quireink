import { describe, it, expect } from '@/test/vitest'
import { sanitizeEnabledPalettes, sanitizeComments, sanitizeThemes, sanitizeFront, sanitizeHome, sanitizeListPath } from '@/content/settings-sanitize'
import { sanitizeFontUrl } from '@/content/settings-type'
import { ALL_PALETTE_IDS, defaultThemes } from '@/content/themes'
import { DEFAULT_SETTINGS } from '@/content/settings'

const COMMENTS_OFF = { enabled: false, turnstile: false, googleAuth: false }

describe('sanitizeComments', () => {
  it('falls back to defaults for a missing / malformed object', () => {
    expect(sanitizeComments(undefined, COMMENTS_OFF)).toEqual(COMMENTS_OFF)
    expect(sanitizeComments('nope', COMMENTS_OFF)).toEqual(COMMENTS_OFF)
  })

  it('keeps booleans and ignores non-boolean fields', () => {
    expect(sanitizeComments({ enabled: true, turnstile: 'yes' }, COMMENTS_OFF)).toEqual({
      ...COMMENTS_OFF,
      enabled: true,
    })
  })
})

// `enabledPalettes` is the visitor-switcher allow-list. Invariants pinned here:
// the default is ALWAYS included (so the switcher never goes empty), only known
// preset ids survive, preset order is preserved, and a missing field (legacy
// settings) means "all on".
describe('sanitizeEnabledPalettes', () => {
  it('defaults to ALL palettes when the field is missing / not an array', () => {
    expect(sanitizeEnabledPalettes(undefined, 'mono')).toEqual(ALL_PALETTE_IDS)
    expect(sanitizeEnabledPalettes(null, 'mono')).toEqual(ALL_PALETTE_IDS)
    expect(sanitizeEnabledPalettes('mono', 'mono')).toEqual(ALL_PALETTE_IDS)
  })

  it('always includes the default, even if absent from the input', () => {
    expect(sanitizeEnabledPalettes(['ocean'], 'mono')).toContain('mono')
    // empty array collapses to just the default -> switcher hides (one option)
    expect(sanitizeEnabledPalettes([], 'sepia')).toEqual(['sepia'])
  })

  it('keeps only known preset ids, in preset order', () => {
    const out = sanitizeEnabledPalettes(['amber', 'bogus', 'ocean', 42, 'mono'], 'mono')
    expect(out).not.toContain('bogus')
    expect(out).toEqual(ALL_PALETTE_IDS.filter((id) => ['amber', 'ocean', 'mono'].includes(id)))
  })

  it('falls back to the built-in default when the given default is invalid', () => {
    expect(sanitizeEnabledPalettes(['ocean'], 'not-a-preset')).toContain('mono')
  })
})

// `accent` shipped after the palettes did. A settings row saved before it has no
// accent key, so the sanitizer must invent one — otherwise the CSS var lands empty
// and every accent mark paints transparent.
describe('sanitizeColors: accent back-compat', () => {
  it('seeds a missing accent from the RESOLVED link colour', () => {
    const out = sanitizeThemes({ mono: { light: { link: '#ff0000' }, dark: {} } }, defaultThemes())
    expect(out.mono.light.accent).toBe('#ff0000')
  })

  it('keeps an explicit accent over the link colour', () => {
    const out = sanitizeThemes({ mono: { light: { link: '#ff0000', accent: '#00ff00' } } }, defaultThemes())
    expect(out.mono.light.accent).toBe('#00ff00')
  })

  it('never leaves accent empty, for any palette or mode', () => {
    for (const theme of Object.values(sanitizeThemes({}, defaultThemes()))) {
      expect(theme.light.accent).toMatch(/^#[0-9a-f]{6}$/i)
      expect(theme.dark.accent).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})

// A font src url lands raw in `@font-face { src: url(<here>) }`, so a hostile value
// must not smuggle a scheme or break out of `url()`.
describe('sanitizeFontUrl', () => {
  it('accepts a store-relative path and an http(s) url', () => {
    expect(sanitizeFontUrl('/uploads/files/font.woff2')).toBe('/uploads/files/font.woff2')
    expect(sanitizeFontUrl('https://cdn.example.com/f.woff2')).toBe('https://cdn.example.com/f.woff2')
  })

  it('rejects javascript:/data: schemes and url()-breaking characters', () => {
    expect(sanitizeFontUrl('javascript:alert(1)')).toBe('')
    expect(sanitizeFontUrl('data:font/woff2;base64,AAAA')).toBe('')
    expect(sanitizeFontUrl('/x.woff2") ; } body{display:none}')).toBe('')
    expect(sanitizeFontUrl('/a b.woff2')).toBe('')
    expect(sanitizeFontUrl(42)).toBe('')
    expect(sanitizeFontUrl('')).toBe('')
  })
})

// ADR 0014. The mode decides what `/` serves, so an unreadable value has to land on the
// one option that changes nothing rather than on whatever the string happened to say.
describe('sanitizeHome', () => {
  const FALLBACK = DEFAULT_SETTINGS.home

  it('falls back to the list for anything it does not recognise', () => {
    expect(sanitizeHome(undefined, FALLBACK).mode).toBe('list')
    expect(sanitizeHome({ mode: 'nonsense' }, FALLBACK).mode).toBe('list')
    expect(sanitizeHome({ mode: 42 }, FALLBACK).mode).toBe('list')
  })

  it('keeps the two modes it does recognise', () => {
    expect(sanitizeHome({ mode: 'page' }, FALLBACK).mode).toBe('page')
    expect(sanitizeHome({ mode: 'front' }, FALLBACK).mode).toBe('front')
  })

  it('strips the chosen slug of leading slashes', () => {
    expect(sanitizeHome({ mode: 'page', page: '/welcome' }, FALLBACK).page).toBe('welcome')
  })
})

describe('sanitizeListPath', () => {
  it('normalises to exactly one leading slash and one lowercase segment', () => {
    expect(sanitizeListPath('blog', '/post')).toBe('/blog')
    expect(sanitizeListPath('//Writing//', '/post')).toBe('/writing')
  })

  // A path the router could not mount, or one that would need a second reservation rule.
  it('rejects a nested, empty or malformed path', () => {
    expect(sanitizeListPath('/a/b', '/post')).toBe('/post')
    expect(sanitizeListPath('/', '/post')).toBe('/post')
    expect(sanitizeListPath('-lead', '/post')).toBe('/post')
    expect(sanitizeListPath(7, '/post')).toBe('/post')
  })
})

// The front page's numbers all bound a layout, so an out-of-range one is a broken grid
// rather than an odd-looking page. ADR 0014.
describe('sanitizeFront', () => {
  const F = DEFAULT_SETTINGS.home.front

  it('clamps counts and refuses a column count that is not 1, 2 or 3', () => {
    const out = sanitizeFront({
      latest: { on: true, count: 999, columns: 7 },
      lead: { secondary: 9 },
    }, F)
    expect(out.latest.count).toBe(24)
    expect(out.latest.columns).toBe(F.latest.columns)
    expect(out.lead.secondary).toBe(3)
  })

  it('takes only the three windows it can explain', () => {
    expect(sanitizeFront({ popular: { days: 7 } }, F).popular.days).toBe(7)
    expect(sanitizeFront({ popular: { days: 0 } }, F).popular.days).toBe(0)
    expect(sanitizeFront({ popular: { days: 3 } }, F).popular.days).toBe(F.popular.days)
  })

  it('drops nameless strips and caps how many rows a front page can be', () => {
    const strips = Array.from({ length: 12 }, (_, i) => ({ category: `C${i}`, count: 3, columns: 3 }))
    expect(sanitizeFront({ strips: [...strips, { category: '  ' }] }, F).strips.length).toBe(8)
  })

  it('defaults the kind to the one with images', () => {
    expect(sanitizeFront({}, F).kind).toBe('image')
    expect(sanitizeFront({ kind: 'text' }, F).kind).toBe('text')
  })
})
