// Is this string an IP address, and which kind? The answer `node:net`'s `isIP` gives — 4, 6, or 0
// for anything else — written out so it needs nothing from a runtime (ADR 0066): a Worker is not
// guaranteed the `net` module, and an SSRF guard is the last place to discover that.
//
// IPv4: four decimal parts, 0–255, no leading zeros (as `node:net` refuses `01.2.3.4`). IPv6: the
// WHATWG URL parser already knows every legal spelling — `::`, embedded IPv4, compressed runs — so
// it is asked rather than re-implemented. Pinned against `node:net` by `ip.test.ts`.
const PART = '(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)'
const V4 = new RegExp(`^${PART}(\\.${PART}){3}$`)

export function isIP(input: string): 0 | 4 | 6 {
  if (V4.test(input)) return 4
  if (!input.includes(':') || /[[\]/?#@\s]/.test(input)) return 0
  try {
    new URL(`http://[${input}]/`)
    return 6
  } catch {
    return 0
  }
}
