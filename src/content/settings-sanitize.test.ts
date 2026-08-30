import { describe, it, expect } from '@/test/vitest'
import { sanitizeEnabledPalettes, sanitizeComments, sanitizeThemes, sanitizeFront, sanitizeHome, sanitizeListPath, sanitizeMenu, sanitizeMotion, migrateThemes } from '@/content/settings-sanitize'
import { sanitizeFontUrl } from '@/content/settings-type'
import { ALL_PALETTE_IDS, DEFAULT_PRESET_ID, defaultThemes } from '@/content/themes'
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

/**
 * The upgrade path, which is the only part of the key-feedback change that can hurt anyone.
 *
 * `motion.typewriter` was a boolean until 2026-08-24 and every settings row in the world
 * still holds one. Reading it as "no opinion" would silently switch the sound off for every
 * install that had it on, and back on for every install that had turned it off — which is
 * the worse of the two, because somebody turned it off for a reason.
 */
describe('sanitizeMotion, upgrading from the old boolean', () => {
  const M = { enabled: true, keys: 'woody', keyVolume: 60 } as const

  it('reads the old switch as the choice it stood for', () => {
    expect(sanitizeMotion({ enabled: true, typewriter: true }, M).keys).toBe('woody')
    expect(sanitizeMotion({ enabled: true, typewriter: false }, M).keys).toBe('off')
  })

  it('lets an explicit choice win over a boolean sent beside it', () => {
    expect(sanitizeMotion({ keys: 'deep', typewriter: false }, M).keys).toBe('deep')
  })

  it('keeps the current setting for a value it cannot read', () => {
    expect(sanitizeMotion({ keys: 'clicky' }, M).keys).toBe('woody')
    expect(sanitizeMotion({}, { enabled: true, keys: 'crisp', keyVolume: 60 }).keys).toBe('crisp')
  })

  // The three carried the names of the machines they are modelled on until 2026-08-25, when
  // the owner said they were not close enough to earn them. Every settings row on every
  // install still says the old ones, and dropping them on the floor would silently reset
  // three people's choice to the default.
  it('reads the machine names it used to ship as the sounds they became', () => {
    expect(sanitizeMotion({ keys: 'typewriter' }, M).keys).toBe('woody')
    expect(sanitizeMotion({ keys: 'tactile' }, M).keys).toBe('crisp')
    expect(sanitizeMotion({ keys: 'linear' }, M).keys).toBe('deep')
  })

  it('takes all four, and they are the four the editor knows', () => {
    for (const keys of ['off', 'woody', 'crisp', 'deep'] as const) {
      expect(sanitizeMotion({ keys }, M).keys).toBe(keys)
    }
  })

  // The volume arrived a day after the instrument, so every stored row in the world is a row
  // without one — including the three this product actually runs on.
  it('gives a settings row that predates the volume the default one', () => {
    expect(sanitizeMotion({ keys: 'deep' }, M).keyVolume).toBe(60)
    expect(sanitizeMotion({ enabled: true, typewriter: true }, M).keyVolume).toBe(60)
  })

  it('keeps silence, because 0 is an answer and not a missing value', () => {
    expect(sanitizeMotion({ keys: 'deep', keyVolume: 0 }, M).keyVolume).toBe(0)
  })

  it('clamps and rounds anything else', () => {
    expect(sanitizeMotion({ keyVolume: 240 }, M).keyVolume).toBe(100)
    expect(sanitizeMotion({ keyVolume: -20 }, M).keyVolume).toBe(0)
    expect(sanitizeMotion({ keyVolume: 62.4 }, M).keyVolume).toBe(62)
    expect(sanitizeMotion({ keyVolume: 'loud' }, M).keyVolume).toBe(60)
    expect(sanitizeMotion({ keyVolume: Number.NaN }, M).keyVolume).toBe(60)
  })
})

/**
 * The navigation, which is the one sanitiser whose output is a LINK a reader clicks.
 *
 * It had no test at all. Measured on 2026-08-30 by loosening each of its two filters in turn:
 * both left all 2377 tests green, and both are reachable from an import or an MCP write
 * rather than from the form — the form cannot produce a menu item with a numeric label, and
 * `saveSettings` takes whatever shape it is handed.
 */
describe('sanitizeMenu', () => {
  const KEEP = [{ label: 'Archive', href: '/archive' }]

  it('keeps a well-formed item and trims both halves', () => {
    expect(sanitizeMenu([{ label: '  Archive  ', href: ' /archive ' }], []))
      .toEqual([{ label: 'Archive', href: '/archive' }])
  })

  it('falls back when the input is not an array at all', () => {
    for (const junk of [undefined, null, 'Archive', 42, { label: 'Archive' }]) {
      expect(sanitizeMenu(junk, KEEP)).toEqual(KEEP)
    }
  })

  // Each of these used to reach `.trim()` on something that has no `trim`, which is a 500 on
  // every page of the site rather than a missing menu entry.
  it('drops an entry that is not an object with two strings', () => {
    expect(sanitizeMenu([null, undefined, 'Archive', 7, [], { label: 7, href: '/a' },
      { label: 'A', href: 7 }, { label: 'A' }, { href: '/a' }], [])).toEqual([])
  })

  it('drops an entry whose halves are present but empty once trimmed', () => {
    expect(sanitizeMenu([{ label: '   ', href: '/a' }], [])).toEqual([])
    expect(sanitizeMenu([{ label: 'A', href: '   ' }], [])).toEqual([])
    expect(sanitizeMenu([{ label: '', href: '' }], [])).toEqual([])
  })

  it('drops the bad ones and keeps the good ones, in order', () => {
    expect(sanitizeMenu([{ label: 'A', href: '/a' }, null, { label: 'B', href: '' },
      { label: 'C', href: '/c' }], [])).toEqual([{ label: 'A', href: '/a' }, { label: 'C', href: '/c' }])
  })
})

/**
 * The one-palette-to-many migration, which runs on EVERY read of a settings row written
 * before palettes existed. Loosening its condition also left the suite green.
 */
describe('migrateThemes', () => {
  const LEGACY = { light: { bg: '#123456' }, dark: { bg: '#654321' } }

  const OTHER = ALL_PALETTE_IDS.find((id) => id !== DEFAULT_PRESET_ID)!

  it('seeds the default palette from an old single-theme row', () => {
    expect(migrateThemes({ theme: LEGACY })[DEFAULT_PRESET_ID]!.light.bg).toBe('#123456')
  })

  it('seeds the palette the row had CHOSEN, not always the built-in default', () => {
    const out = migrateThemes({ theme: LEGACY, themePreset: OTHER })
    expect(out[OTHER]!.light.bg).toBe('#123456')
    expect(out[DEFAULT_PRESET_ID]!.light.bg).not.toBe('#123456')
  })

  // The row this guards: a blog migrated once already has `themes`, and may still carry the
  // dead `theme` key. Re-applying it would repaint a palette the owner has since edited.
  it('leaves a row that has ALREADY migrated alone, dead key and all', () => {
    const out = migrateThemes({ themes: defaultThemes(), theme: LEGACY })
    expect(out[DEFAULT_PRESET_ID]!.light.bg).not.toBe('#123456')
    expect(out).toEqual(defaultThemes())
  })

  it('returns the built-in palettes untouched when there is nothing to migrate', () => {
    expect(migrateThemes({})).toEqual(defaultThemes())
  })
})
