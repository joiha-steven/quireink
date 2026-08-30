// Coarse user-agent buckets for the analytics audience view. We store ONLY these
// low-cardinality labels (device class / browser family / OS), never the raw UA,
// so nothing here is a fingerprint — it's the same privacy stance as the salted
// visitor hash. Best-effort substring matching; anything unrecognized is 'Other'.
// Order matters: the more specific token is tested before the generic one it
// contains (Edge/Opera/Samsung before Chrome; Chrome before Safari).

export type UaInfo = { device: string; browser: string; os: string }

/**
 * `touch` is the one thing the string cannot say, and it is here for one device.
 *
 * iPadOS 13 and later identify as Macintosh Safari — same UA a desktop Mac sends, on
 * purpose, so that sites stop serving them a phone layout. There is no token to test: every
 * iPad in the world therefore landed in `desktop` / `macOS`. Measured on a live blog over 30
 * days on 2026-08-30: 117 desktop, 80 mobile, ZERO tablet, on a site whose readers are
 * plainly not all at a desk.
 *
 * The only discriminator is multi-touch, which lives in the browser and not in the header,
 * so the beacon sends it. Apple ships no Mac with a touchscreen, so a Macintosh-claiming
 * browser reporting more than one touch point is an iPad — and the check is gated on macOS
 * precisely so that a Windows touchscreen laptop, which is a desktop and says so, is not
 * caught by it.
 *
 * Nothing new is stored: the same two coarse columns, with the right values in them. When
 * `touch` is absent — an older cached beacon, a reader with JavaScript off — the answer is
 * exactly what it was before.
 */
export function parseUa(ua: string, touch = false): UaInfo {
  const s = (ua || '').toLowerCase()
  const seen = { device: device(s), browser: browser(s), os: os(s) }
  if (touch && seen.os === 'macOS') return { ...seen, device: 'tablet', os: 'iPadOS' }
  return seen
}

function device(s: string): string {
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/.test(s)) return 'tablet'
  if (/mobi|iphone|ipod|android|windows phone|blackberry|iemobile|opera mini/.test(s)) return 'mobile'
  return 'desktop'
}

function browser(s: string): string {
  if (/edg[ea/]/.test(s)) return 'Edge'
  if (/opr\/|opera|opios/.test(s)) return 'Opera'
  if (/samsungbrowser/.test(s)) return 'Samsung Internet'
  if (/firefox|fxios/.test(s)) return 'Firefox'
  if (/chrome|crios|chromium/.test(s)) return 'Chrome'
  if (/safari/.test(s)) return 'Safari'
  return 'Other'
}

function os(s: string): string {
  if (/iphone|ipad|ipod|ios/.test(s)) return 'iOS'
  if (/android/.test(s)) return 'Android'
  if (/windows/.test(s)) return 'Windows'
  if (/mac os x|macintosh/.test(s)) return 'macOS'
  if (/cros/.test(s)) return 'ChromeOS'
  if (/linux/.test(s)) return 'Linux'
  return 'Other'
}
