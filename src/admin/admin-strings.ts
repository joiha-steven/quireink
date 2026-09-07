// The admin's dictionaries, one at a time.
//
// `@/i18n/admin-i18n` imports all eleven so the SERVER can answer a login page in any of them
// from one process. The browser only ever speaks one, and importing that module put the other
// ten into the chunk the entry waits for: 780 KB of admin dictionaries fetched on every admin
// page load, of which about 71 KB is ever read. Russian and Vietnamese shipped to each other.
//
// English stays a static import, and that is a decision rather than an oversight. It is the
// default language and the fallback for an unknown one, so it is what the first frame is
// drawn in when a load has not landed yet — a promise cannot be awaited during a render. The
// other ten are `import()`, which the bundler turns into ten chunks nobody fetches unless the
// admin is set to that language.
import type { SiteLang } from '@/types'
import type { AdminStrings } from '@/locales/types'
import en from '@/locales/admin/en'

export type { AdminStrings }

const LOAD: Record<Exclude<SiteLang, 'en'>, () => Promise<{ default: AdminStrings }>> = {
  vi: () => import('@/locales/admin/vi'),
  de: () => import('@/locales/admin/de'),
  ja: () => import('@/locales/admin/ja'),
  zh: () => import('@/locales/admin/zh'),
  ko: () => import('@/locales/admin/ko'),
  fr: () => import('@/locales/admin/fr'),
  es: () => import('@/locales/admin/es'),
  pt: () => import('@/locales/admin/pt'),
  it: () => import('@/locales/admin/it'),
  ru: () => import('@/locales/admin/ru'),
}

const held = new Map<SiteLang, AdminStrings>([['en', en]])

/** What is on hand RIGHT NOW, for a render, which cannot wait. English until it is not. */
export function adminStrings(lang: SiteLang): AdminStrings {
  return held.get(lang) ?? en
}

/** Whether `adminStrings` would answer in the language asked for. */
export function adminStringsReady(lang: SiteLang): boolean {
  return held.has(lang)
}

/** Fetch a language's dictionary once. Resolves immediately for one already held. */
export async function loadAdminStrings(lang: SiteLang): Promise<void> {
  if (held.has(lang)) return
  const load = LOAD[lang as Exclude<SiteLang, 'en'>]
  if (!load) return
  held.set(lang, (await load()).default)
}
