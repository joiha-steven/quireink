import type { SiteLang } from '@/types'
import type { Dict } from '@/locales/types'
import en from '@/locales/en'
import vi from '@/locales/vi'
import de from '@/locales/de'
import ja from '@/locales/ja'
import zh from '@/locales/zh'
import ko from '@/locales/ko'
import fr from '@/locales/fr'
import es from '@/locales/es'
import pt from '@/locales/pt'
import it from '@/locales/it'
import ru from '@/locales/ru'

export type { Dict }

const LOCALES: Record<SiteLang, Dict> = { en, vi, de, ja, zh, ko, fr, es, pt, it, ru }

// English is the default fallback.
export function t(lang: SiteLang): Dict {
  return LOCALES[lang] ?? en
}

export { formatCount, formatDate, formatMonth, zonedDay } from '@/i18n/format'
