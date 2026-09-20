// WHAT ONE VALUE MAY BE: the scrubbers that know nothing about which setting they are for.
//
// Split out of `settings-sanitize.ts` on 2026-09-19, when adding the Content API switch put that
// file over its 400-line ceiling. The seam is not the line count. Everything left there answers
// "what is a GROUP" — `sanitizeSeo`, `sanitizeHome`, `sanitizeFeatures` each know the shape of
// one settings object and its defaults. Everything here answers "what is a VALUE": a number, a
// URL, a stylesheet, a snippet of the owner's own markup. The four below are called from five
// files and none of them would be reached for by name while reading a settings group.
//
// Re-exported from `settings-sanitize.ts`, so no import site had to change — the same bargain
// `types-settings.ts` and `admin-shared/scale.ts` made: a split nobody has to learn.

// Owner CSS injected raw into <style>. Owner-only, so the only hazard is an
// accidental `</style>` closing the tag early — strip it; pass the rest through.
export function sanitizeCss(value: unknown): string {
  return typeof value === 'string' ? value.replace(/<\/style/gi, '') : ''
}

/**
 * The owner's own markup, kept as typed.
 *
 * Deliberately NOT the treatment `sanitizeCss` gives its input, and the difference is the
 * whole point: that one strips `</style` so a stylesheet field can never become a script,
 * because CSS is all it was ever for. These fields ARE for script — a tracking snippet is
 * the thing they exist to hold — so stripping tags would leave a box that silently ruins
 * every snippet pasted into it, which is worse than not having the box.
 *
 * What it does do is refuse anything that is not a string and trim the edges, so a field
 * holding only whitespace reads as empty everywhere rather than as "set to a space".
 */
export function sanitizeSnippet(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

// Accept only a valid http(s) URL with no trailing slash; '' otherwise.
export function sanitizeUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return ''
  try {
    const u = new URL(value.trim())
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return ''
    return u.origin
  } catch {
    return ''
  }
}

export function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

/**
 * A backup recipient, as it is written down: the prefix and 32 base64url bytes (ADR 0060).
 *
 * A VALUE rule and not a group one, which is why it is here: it knows nothing about backups,
 * only about the shape of a key. Checked rather than parsed, so `content/` does not reach into
 * `server/` for something it can describe in one line — `server/backup-crypt.ts` is what
 * actually decodes it, and refuses anything this would have let through.
 */
export const isRecipient = (v: unknown): v is string =>
  typeof v === 'string' && /^quire-backup-pub-1[A-Za-z0-9_-]{43}$/.test(v)

/** A boolean, or the fallback. Moved here from `settings-sanitize.ts` when the doors split
 * out of it: both files need it, and a door importing it back from the group file would be a
 * cycle for the sake of one line. */
export const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback)
