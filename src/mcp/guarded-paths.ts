// The settings a token may not reach unless the owner said so when they minted it.
//
// WHY THESE FOUR AND NOTHING ELSE. `update_settings` takes a dotted path and a value, and
// the whole argument for letting it reach every path is that the value goes through
// `saveSettings` — the same sanitiser, clamp and refusal the owner's own Save button uses,
// so nothing reachable over MCP is anything the owner's screens could not already do
// (`tools-library.ts` carries that reasoning).
//
// It holds for every setting path but the four below. It does not hold for these, because for them the
// sanitiser's job is to keep the text INTACT: they exist to put the owner's own markup on
// their own pages, and `customHead` and `customBodyEnd` are written verbatim into the
// `<head>` and before `</body>` of every public page (`web/layout.ts`). Same origin as the
// admin, so a `<script>` there runs with the owner's session cookie in scope the moment the
// owner opens their own site. `customCss` can take the site off the air, and `siteUrl`
// decides what every canonical, feed and newsletter link points at.
//
// So the difference is not "write" versus "read". It is: a token that publishes for you,
// against a token that can put code on your readers' screens. Those are different grants and
// were the same one.
//
// EXISTING TOKENS NARROW. A `full` token minted before this stays `full` and loses these
// four, which is the direction a security change has to fail in. The owner mints an `admin`
// token when they actually want a connector editing custom code, which is rare enough that
// nobody should be holding the grant by default.

/**
 * Settings paths an `admin`-scoped token may write and no other may.
 *
 * A PREFIX match, so `typography.customCss` would not be caught by accident and a future
 * `customHead.something` would. Flat today; the shape is what keeps it honest.
 */
export const ADMIN_ONLY_SETTINGS = ['customHead', 'customBodyEnd', 'customCss', 'siteUrl']

/** True when a dotted settings path is one of the guarded ones, or sits under it. */
export function isAdminOnlyPath(path: string): boolean {
  const clean = path.trim()
  return ADMIN_ONLY_SETTINGS.some((p) => clean === p || clean.startsWith(`${p}.`))
}

/**
 * Why this call is refused on this door, or null to let it through.
 *
 * Reads the ARGUMENTS rather than the tool, because the line runs through one tool rather
 * than between two: `update_settings` is ordinary for every other path. `update_appearance`
 * needs nothing here — every one of its inputs is an enum of the owner's own menu options.
 *
 * The message names the fix, because the thing on the other end is a model that will
 * otherwise retry the same call: it says what to tell the owner, not just that it failed.
 */
export function refusalFor(tool: string, args: Record<string, unknown>): string | null {
  if (tool !== 'update_settings') return null
  const path = typeof args.path === 'string' ? args.path : ''
  if (!path || !isAdminOnlyPath(path)) return null
  return `This token may not change \`${path}\`. It is one of ${ADMIN_ONLY_SETTINGS.join(', ')}, `
    + 'which are written straight into every public page or decide where the site lives, so '
    + 'they need a token minted with custom-code access. Do not retry: tell the owner, who can '
    + 'either make the change in Settings themselves or mint a token that carries it.'
}
