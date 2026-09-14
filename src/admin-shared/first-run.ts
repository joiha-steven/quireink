// The five steps a new blog is set up in, and the order they are done in.
//
// ONE COPY, because it is rendered in two places: the dashboard's first-run card and the Help
// screen. They were written out twice for about an hour, and that is exactly how two versions
// of "how to set this up" end up disagreeing.
//
// Here rather than in `admin/components/FirstRun.tsx` since ADR 0054, because Help is
// server-rendered HTML now and the dashboard is still React.
import type { AdminStrings } from '@/i18n/admin-i18n'

const HREFS = [
  '/admin/settings',
  '/admin/editor',
  '/admin/settings?tab=appearance',
  '/admin/settings?tab=people',
  '/admin/newsletter',
] as const

/**
 * The five, read out of the dictionary so every language gets the same path.
 *
 * `{tab}` is filled from the same entry the tab strip reads. The first step used to SPELL the
 * tab out — "Settings → Site" in eleven languages — and ADR 0041 renamed every tab underneath
 * it, so the first instruction a new owner is given sent them looking for a word that is no
 * longer on the screen.
 */
export function firstRunSteps(t: AdminStrings): { href: string; label: string; body: string }[] {
  return HREFS.map((href, i) => ({
    href,
    label: t[`firstRun${i + 1}Label` as keyof AdminStrings] as string,
    body: (t[`firstRun${i + 1}Body` as keyof AdminStrings] as string).replace('{tab}', t.tabBlog),
  }))
}
