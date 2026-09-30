// The admin's language, as the page itself states it on `<html lang>`.
//
// For an island that prints a date after the server drew the screen: the server knows the
// language from settings, the island has only the page. `spa.ts` writes `settings.language`
// there, the same value every server-drawn date on the screen was printed with, so a row the
// island adds reads in the same order as the rows around it.
import type { SiteLang } from '@/types'

export const pageLang = (): SiteLang => (document.documentElement.lang || 'en') as SiteLang
