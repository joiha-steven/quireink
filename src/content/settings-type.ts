// Type and font validation, split out of `settings-sanitize.ts` when that file reached the
// 400-line cap. Same contract: pure, unknown -> typed, no DB and no React.
//
// These belong together because they are the two halves of ONE question — what the reading
// text is set in — and because they are the only sanitizers here that carry a MIGRATION
// (an older single-URL font, an older flat type scale) rather than just a clamp.

import type { FontFace, FontSettings, TypeStyle, TypographySettings } from '@/types'
import { DEFAULT_FONT, TYPE_ROLES, FONT_WEIGHTS } from '@/content/themes'

const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback)

// Clamp a float into [min,max], keeping up to 2 decimals; fall back when invalid.
function clampFloat(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value * 100) / 100))
}

// One role's style, clamped. size rem [0.5,6]; line [0.8,3]; spacing em [-0.2,0.5].
function sanitizeStyle(input: unknown, fallback: TypeStyle): TypeStyle {
  const o = (input ?? {}) as Partial<TypeStyle>
  return {
    size: clampFloat(o.size, 0.5, 6, fallback.size),
    line: clampFloat(o.line, 0.8, 3, fallback.line),
    spacing: clampFloat(o.spacing, -0.2, 0.5, fallback.spacing),
  }
}

// Back-compat: the first typography shape was flat ({ base, h1..h5, lineHeight,
// letterSpacing }); lift those into the role map so an early save survives.
function migrateTypography(o: Record<string, unknown>, base: TypographySettings): TypographySettings {
  if (o.roles || typeof o.base !== 'number') return base
  const num = (v: unknown, f: number) => (typeof v === 'number' && Number.isFinite(v) ? v : f)
  const line = num(o.lineHeight, base.roles.body.line)
  const sp = num(o.letterSpacing, base.roles.body.spacing)
  const r = base.roles
  return {
    roles: {
      ...r,
      body: { size: num(o.base, r.body.size), line, spacing: sp },
      h1: { ...r.h1, size: num(o.h1, r.h1.size) },
      h2: { ...r.h2, size: num(o.h2, r.h2.size) },
      h3: { ...r.h3, size: num(o.h3, r.h3.size) },
      h4: { ...r.h4, size: num(o.h4, r.h4.size) },
      h5: { ...r.h5, size: num(o.h5, r.h5.size) },
    },
    smoothing: bool(o.smoothing, base.smoothing),
  }
}

export function sanitizeTypography(input: unknown, fallback: TypographySettings): TypographySettings {
  const o = (input ?? {}) as Record<string, unknown>
  const base = migrateTypography(o, fallback)
  const inRoles = (o.roles ?? {}) as Record<string, unknown>
  const roles = {} as TypographySettings['roles']
  for (const role of TYPE_ROLES) roles[role] = sanitizeStyle(inRoles[role], base.roles[role])
  return { roles, smoothing: bool(o.smoothing, base.smoothing) }
}

// Family name -> safe CSS identifier (never trust raw into <style>): allow
// letters/digits/space/hyphen, collapse the rest.
function sanitizeFamily(value: unknown): string {
  return typeof value === 'string' ? value.replace(/[^A-Za-z0-9 _-]/g, '').trim().slice(0, 64) : ''
}

// A font src url lands raw in `@font-face { src: url(<here>) }`, so it must be safe to
// interpolate: only a store-relative path (`/uploads/...`) or an http(s) URL, and no
// character that could break out of `url()` or smuggle a scheme (`javascript:`, `data:`,
// quotes, parens, angle brackets, whitespace). Returns '' when it doesn't qualify.
export function sanitizeFontUrl(value: unknown): string {
  if (typeof value !== 'string') return ''
  const v = value.trim()
  if (!v || /["'()<>\s]/.test(v) || /^\s*(javascript|data|vbscript):/i.test(v)) return ''
  if (v.startsWith('/')) return v // store-relative (the normal uploaded-font case)
  try {
    const u = new URL(v)
    return u.protocol === 'http:' || u.protocol === 'https:' ? v : ''
  } catch {
    return ''
  }
}

// One uploaded weight: a known weight + a safe url. Maps the legacy single `url`
// (no weight) to the 400 slot.
function sanitizeFaces(input: unknown, legacyUrl: unknown): FontFace[] {
  const raw = Array.isArray(input)
    ? input
    : typeof legacyUrl === 'string' && legacyUrl.trim()
      ? [{ weight: 400, url: legacyUrl }]
      : []
  const byWeight = new Map<number, string>()
  for (const f of raw) {
    const o = (f ?? {}) as Partial<FontFace>
    const w = typeof o.weight === 'number' ? o.weight : NaN
    const url = sanitizeFontUrl(o.url)
    if (FONT_WEIGHTS.includes(w as (typeof FONT_WEIGHTS)[number]) && url) {
      byWeight.set(w, url)
    }
  }
  return FONT_WEIGHTS.filter((w) => byWeight.has(w)).map((w) => ({ weight: w, url: byWeight.get(w)! }))
}

export function sanitizeFont(input: unknown, fallback: FontSettings): FontSettings {
  const o = (input ?? {}) as Record<string, unknown>
  const family = o.family !== undefined ? sanitizeFamily(o.family) : fallback.family
  const faces = sanitizeFaces(o.faces, o.url)
  // Need a family AND at least one face; otherwise "no custom font".
  return family && faces.length ? { family, faces } : DEFAULT_FONT
}

// font URL -> @font-face `format(...)` hint, by extension. Unknown -> omit it.
export function fontFormat(url: string): string {
  const ext = url.split(/[?#]/)[0].split('.').pop()?.toLowerCase()
  return ext === 'woff2' ? 'woff2' : ext === 'woff' ? 'woff' : ext === 'ttf' ? 'truetype' : ext === 'otf' ? 'opentype' : ''
}

// Clamp a possibly-invalid number into a range, falling back to a default.