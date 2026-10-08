// The two upload refusals that say where the limit lives. Their locale strings name the place
// with `{settings}`, `{tab}` and `{section}`, filled from the keys that already hold those
// names, so a renamed tab cannot leave the sentence pointing at the old one.
import type { AdminStrings } from '@/i18n/admin-i18n'

export const placed = (t: AdminStrings, s: string): string =>
  s.replace('{settings}', t.navSettings).replace('{tab}', t.tabServer).replace('{section}', t.storageTitle)

export const limitWords = (t: AdminStrings): { tooLarge: string; noRoom: string } =>
  ({ tooLarge: placed(t, t.uploadTooLarge), noRoom: placed(t, t.uploadNoRoom) })
