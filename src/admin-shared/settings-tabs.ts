// WHICH TABS THE SETTINGS SCREEN HAS, and which old names still find them.
//
// Seven tabs, grouped by the question the owner is holding when they open the screen (ADR 0041,
// which supersedes 0011's grouping and keeps its one-question-per-tab rule). The eight tabs it
// replaced were grouped by which part of the CODE a key belonged to, and the count measured on
// 2026-09-07 says what that cost: Appearance carried 137 controls over 2,825px while five other
// tabs sat within 31px of 1,236, and the answer to "how do readers sign in to comment" lived
// three tabs from "should there be comments".
//
// Here rather than in the screen, because two other things read this list: the island, and
// `settings-tab-links.test.ts`, which checks that every `?tab=` the admin links to is a tab that
// exists. That test used to read the list out of `SettingsView.tsx` with a regular expression.

export type Tab = 'blog' | 'home' | 'post' | 'appearance' | 'people' | 'server' | 'account'

/**
 * Every member of `Tab`, and the list `?tab=` is validated against — so a tab missing here is a
 * tab no link can reach. That happened once: `ai` was left out when its tab was added on
 * 2026-08-23, which made the assistant's own settings link land silently on Site, the address
 * its error message hands the owner and the one the guide on quireink.com prints.
 */
export const TAB_IDS: Tab[] = ['blog', 'home', 'post', 'appearance', 'people', 'server', 'account']

/**
 * The eight old ids, pointed at the tab that now holds their keys.
 *
 * Help, the home screen's setup band, the newsletter's SMTP link, the assistant's error message
 * and the command palette all address settings by these URLs, and a decision about GROUPING is
 * not a licence to break five screens that had no part in it.
 *
 * `connections` lands on Comments & mail rather than on Server, and that is a judgement about
 * what people were looking for when they followed the link: SMTP is the reason that tab was
 * opened. `seo`, `ai` and `system` all land on Server, which absorbed all three.
 */
export const OLD_TABS: Record<string, Tab> = {
  site: 'blog', layout: 'home', reading: 'post', appearance: 'appearance',
  seo: 'server', connections: 'people', ai: 'server', system: 'server',
}

/** The tab an address names, or Blog. A silent fallback, because the value comes off a URL. */
export const resolveTab = (asked: string | null): Tab =>
  (TAB_IDS as string[]).includes(asked ?? '') ? (asked as Tab) : (OLD_TABS[asked ?? ''] ?? 'blog')
