// The appearance settings that change SHAPE, and the one that says who wrote the page.
//
// A file of its own rather than three more functions in `settings-sanitize.ts`, which was
// at 364 of its 400 lines when these arrived — and the seam is a real one either way, the
// same one `settings-css.ts` was cut on. Everything here answers "what does the site look
// like", and two of the three turn into CSS variables a few lines down rather than into
// markup.
//
// WHY THESE THREE, TOGETHER. Measured across three live blogs on 2026-08-29: with 84
// colour fields and 27 typography numbers available to them, the entire visible difference
// between the three was two colour values nobody can see. Every knob the product had
// adjusted colour, size, or whether a block was present. None of them changed the SHAPE of
// anything — and shape is what an eye uses to tell two blogs apart. `PostImageSettings`
// is here for the same reason: the pictures were already stored, already resized and
// already served, and the only place they could appear was a share card.
//
// EVERY DEFAULT REPRODUCES TODAY EXACTLY. That is not politeness, it is the contract: a
// blog that upgrades into this version must not move a pixel until its owner moves one.

import type { PostImageSettings, ShapeSettings, AuthorSettings } from '@/types-settings'

// ----- a post's own picture ---------------------------------------------------

const HERO_KINDS = ['none', 'inline'] as const
const THUMB_KINDS = ['none', 'side', 'top'] as const

export const DEFAULT_POST_IMAGE: PostImageSettings = {
  // What an article and a list row did before this setting existed. A hero that arrived
  // switched on would redesign every existing post on somebody's blog during an upgrade,
  // which is the one thing an upgrade may never do.
  hero: 'none',
  thumb: 'none',
}

export function sanitizePostImage(input: unknown, fallback: PostImageSettings): PostImageSettings {
  const o = (input ?? {}) as Partial<PostImageSettings>
  return {
    hero: HERO_KINDS.find((k) => k === o.hero) ?? fallback.hero,
    thumb: THUMB_KINDS.find((k) => k === o.thumb) ?? fallback.thumb,
  }
}

// ----- density, radius, headline weight ---------------------------------------

const DENSITIES = ['compact', 'normal', 'relaxed'] as const
const RADII = ['square', 'soft', 'round'] as const
const WEIGHTS = ['light', 'normal', 'bold'] as const

export const DEFAULT_SHAPE: ShapeSettings = {
  density: 'normal',
  radius: 'soft',
  headingWeight: 'normal',
}

export function sanitizeShape(input: unknown, fallback: ShapeSettings): ShapeSettings {
  const o = (input ?? {}) as Partial<ShapeSettings>
  return {
    density: DENSITIES.find((d) => d === o.density) ?? fallback.density,
    radius: RADII.find((r) => r === o.radius) ?? fallback.radius,
    headingWeight: WEIGHTS.find((w) => w === o.headingWeight) ?? fallback.headingWeight,
  }
}

/** The multiplier on `--sp`, the article's spacing unit. `normal` is 1 and must stay 1. */
const DENSITY_SCALE: Record<ShapeSettings['density'], string> = {
  compact: '0.82',
  normal: '1',
  relaxed: '1.22',
}

/** `soft` is `.5rem`, which is the literal the sheets carried before this was a variable. */
const RADIUS_SIZE: Record<ShapeSettings['radius'], string> = {
  square: '0px',
  soft: '.5rem',
  round: '1rem',
}

/**
 * Two weights, not one, and they were never the same number: the standalone archive heading
 * is 700, and the post title, the card titles and every bold label in the chrome are 600.
 * (An earlier version of this comment called 700 "a post title", which is what the doc then
 * promised — measured 2026-08-31, the post title has always worn `--fw-heading` through
 * `.font-semibold`.) Collapsing them into a single knob would itself be a redesign, so each
 * step moves the PAIR and `normal` is today's pair exactly.
 */
const HEADING_WEIGHT: Record<ShapeSettings['headingWeight'], { title: string; heading: string }> = {
  light: { title: '400', heading: '400' },
  normal: { title: '700', heading: '600' },
  bold: { title: '800', heading: '700' },
}

/**
 * The shape variables, for `:root`.
 *
 * `--density` is emitted here but CONSUMED in `settings-css.ts`, inside the same block that
 * declares `--sp` — because a `var()` in a custom property is substituted where the
 * property is DECLARED, not where it is used (that trap is written out at length in
 * `settings-css.ts`, and it is why book mode spent a release rendering at the article's
 * size). Declaring `--density` on `:root` and multiplying it into `--sp` in the same
 * declaration is the arrangement that actually works.
 */
export function shapeToCss(s: ShapeSettings): string {
  const w = HEADING_WEIGHT[s.headingWeight]
  return `:root{--density:${DENSITY_SCALE[s.density]};--radius:${RADIUS_SIZE[s.radius]}`
    + `;--fw-title:${w.title};--fw-heading:${w.heading}}`
}

// ----- who wrote it -----------------------------------------------------------

export const DEFAULT_AUTHOR: AuthorSettings = {
  // Silence. Every blog that upgrades into this version has no byline today, and gaining
  // one unasked would put a name on ninety archived posts at once.
  name: '',
  bio: '',
  avatarUrl: '',
  url: '',
}

/** Trim, collapse runs of whitespace, cap. Escaping belongs to the renderer, not here. */
const text = (v: unknown, max: number, fallback: string): string =>
  typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : fallback

/**
 * A full http(s) URL, PATH KEPT.
 *
 * Deliberately not `sanitizeUrl` from `settings-sanitize.ts`: that one returns `u.origin`,
 * which is right for a site's own base address and wrong for every author link anybody
 * actually has — `https://example.com/about` and a profile on somebody else's host would
 * both be trimmed back to a bare domain.
 */
function link(v: unknown): string {
  if (typeof v !== 'string' || !v.trim()) return ''
  try {
    const u = new URL(v.trim())
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : ''
  } catch {
    return ''
  }
}

export function sanitizeAuthor(input: unknown, fallback: AuthorSettings): AuthorSettings {
  const o = (input ?? {}) as Partial<AuthorSettings>
  return {
    name: text(o.name, 80, fallback.name),
    // Long enough for the two or three sentences an author box holds, short enough that it
    // cannot become a second article underneath every article.
    bio: text(o.bio, 400, fallback.bio),
    // Left as a plain string here: it is an image ref, so it travels through
    // `collapseBlob`/`expandBlob` in `settings.ts` like the logo and the favicon do
    // (Invariant 3 — stored bytes carry no origin).
    avatarUrl: typeof o.avatarUrl === 'string' ? o.avatarUrl.trim() : fallback.avatarUrl,
    url: typeof o.url === 'string' ? link(o.url) : fallback.url,
  }
}
