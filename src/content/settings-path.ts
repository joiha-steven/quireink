// One setting, named by a path — so something other than a hand-written form can change it.
//
// There are 245 leaf settings and, until this file, exactly one way to write any of them: a
// screen with a field on it. The admin's own search already knows 107 of them by NAME
// (`settings-index.ts`), which is what makes a setting findable; what it never knew was WHICH
// setting a row is, so nothing could act on the answer. This is that missing half.
//
// ⚠️ IT IS SAFE BECAUSE `saveSettings` DEEP-MERGES, and that was already true. Every nested
// group goes through its own sanitiser with the CURRENT value as the fallback —
// `sanitizeTypography(input.typography, current.typography)` walks every role and every style
// field — so a partial that mentions one leaf leaves the other 244 exactly where they were.
// That is not an assumption made here: `content/settings.test.ts` has pinned "a partial save
// leaves everything it did not mention alone" since 2026-08-02, when a patch carrying only a
// title reset `home.mode` and turned off somebody's composed front page.
//
// So a caller does NOT write to the database. It builds a partial and hands it to
// `saveSettings`, which sanitises it exactly as the admin's own Save button does. Nothing
// reachable this way is anything the owner's own screens could not already do.
import type { SiteSettings } from '@/types'
import { DEFAULT_SETTINGS } from '@/content/settings'

/**
 * Paths that are the SERVER's business and not a person's.
 *
 * Every one is derived from something else and would be silently rebuilt or overwritten:
 * the logo's rendered twins are made from `logoUrl` and `logoWidth` on save, and
 * `firstRunDone` is a dismissal, not a preference. Offering them would be offering a lever
 * attached to nothing.
 */
const DERIVED = new Set([
  'logoRenderUrl', 'logoRenderHeight', 'logoEmailUrl',
  'logoDarkRenderUrl', 'logoDarkRenderHeight',
  'firstRunDone',
])

function leaves(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return prefix ? [prefix] : []
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    leaves(v, prefix ? `${prefix}.${k}` : k),
  )
}

/**
 * Every settable leaf, dotted, read off the DEFAULTS rather than typed out.
 *
 * Derived from the shape means it cannot go stale: a setting added to `DEFAULT_SETTINGS`
 * appears here on the next boot, which is the opposite of the hand-written index next door
 * and the reason that one needs a tour flow to keep it honest.
 *
 * `themes.*` is excluded. It is a `Record<string, ThemeSettings>` keyed by palette id, so its
 * paths depend on which palettes exist; a caller that wants to change a palette has
 * `themePreset` and the appearance screen, and a per-swatch colour is not a thing to set by
 * name from a chat.
 */
export const SETTING_PATHS: readonly string[] = leaves(DEFAULT_SETTINGS)
  .filter((p) => !p.startsWith('themes.'))
  .filter((p) => !DERIVED.has(p))
  .sort()

const PATH_SET = new Set(SETTING_PATHS)

export const isSettingPath = (path: string): boolean => PATH_SET.has(path)

/** Read one leaf out of a settings object. `undefined` for a path that is not one. */
export function getAt(settings: SiteSettings, path: string): unknown {
  let node: unknown = settings
  for (const step of path.split('.')) {
    if (node === null || typeof node !== 'object') return undefined
    node = (node as Record<string, unknown>)[step]
  }
  return node
}

/**
 * Turn one leaf into the nested partial `saveSettings` expects.
 *
 * `patchAt('typography.roles.body.size', 18)` is `{typography:{roles:{body:{size:18}}}}` —
 * and the sanitiser fills the other eight roles and the other two fields of `body` back in
 * from the current value. Building the partial is the whole job; the merging, the clamping
 * and the refusing are all somebody else's, already written and already tested.
 */
export function patchAt(path: string, value: unknown): Record<string, unknown> {
  const steps = path.split('.')
  const root: Record<string, unknown> = {}
  let node = root
  for (let i = 0; i < steps.length - 1; i++) {
    const next: Record<string, unknown> = {}
    node[steps[i]!] = next
    node = next
  }
  node[steps[steps.length - 1]!] = value
  return root
}

/**
 * What KIND of answer a path takes, read off the default sitting at it.
 *
 * For a tool that has to describe itself — a chat, an MCP schema, a command palette all want
 * to know whether a setting is a switch or a number before offering to change it, and the
 * defaults already say so.
 */
export function typeOfPath(path: string): 'boolean' | 'number' | 'string' | 'array' | 'unknown' {
  const value = getAt(DEFAULT_SETTINGS, path)
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'string') return 'string'
  if (Array.isArray(value)) return 'array'
  return 'unknown'
}
