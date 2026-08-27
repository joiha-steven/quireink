import type { SiteLang } from '@/types'
import type { AdminStrings } from '@/locales/types'
import en from '@/locales/admin/en'
import vi from '@/locales/admin/vi'
import de from '@/locales/admin/de'
import ja from '@/locales/admin/ja'
import zh from '@/locales/admin/zh'
import ko from '@/locales/admin/ko'
import fr from '@/locales/admin/fr'
import es from '@/locales/admin/es'
import pt from '@/locales/admin/pt'
import it from '@/locales/admin/it'
import ru from '@/locales/admin/ru'

export type { AdminStrings }

const LOCALES: Record<SiteLang, AdminStrings> = { en, vi, de, ja, zh, ko, fr, es, pt, it, ru }

// English is the default fallback.
export function adminT(lang: SiteLang): AdminStrings {
  return LOCALES[lang] ?? en
}
