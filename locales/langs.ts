import type { SiteLang } from '@/types'

// Single source of truth for supported UI languages.
//
// This folder lives at the repository ROOT so a translator never has to learn the tree:
// to add a language, extend SiteLang (src/types.ts), add a row here, create
// locales/<code>.ts + locales/admin/<code>.ts (the compiler enforces every key), and add
// a BCP-47 entry to DATE_LOCALE in src/i18n/i18n.ts. English is the default.
export const SITE_LANGS: { value: SiteLang; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'de', label: 'Deutsch' },
  { value: 'ja', label: '日本語' },
  { value: 'zh', label: '简体中文' },
  { value: 'ko', label: '한국어' },
  { value: 'fr', label: 'Français' },
  { value: 'es', label: 'Español' },
  { value: 'pt', label: 'Português (Brasil)' },
  { value: 'it', label: 'Italiano' },
  { value: 'ru', label: 'Русский' },
]

export const LANG_CODES: SiteLang[] = SITE_LANGS.map((l) => l.value)

export function isSiteLang(v: unknown): v is SiteLang {
  return typeof v === 'string' && (LANG_CODES as string[]).includes(v)
}
