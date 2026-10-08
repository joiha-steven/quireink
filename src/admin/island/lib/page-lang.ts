// The admin's language, as the page itself states it on `<html lang>`.
//
// For an island that prints a date after the server drew the screen: the server knows the
// language from settings, the island has only the page. `spa.ts` writes `settings.language`
// there, the same value every server-drawn date on the screen was printed with, so a row the
// island adds reads in the same order as the rows around it.
import type { SiteLang } from '@/types'
import { siteDateTimeShort } from '@/admin-shared/sheet-state'

export const pageLang = (): SiteLang => (document.documentElement.lang || 'en') as SiteLang

/**
 * The SITE's timezone, as `spa.ts` writes it on `<html data-tz>`. Empty is UTC, as everywhere the
 * setting is read. NOT the browser's zone: the owner may be travelling, and every date the server
 * drew on this screen was printed in the site's, so a row an island adds must be too.
 */
export const pageZone = (): string => document.documentElement.dataset.tz ?? ''

/** An instant as the admin's one stamp, in the site's zone and the page's language. */
export const pageStamp = (at: string | number): string => siteDateTimeShort(at, pageZone(), pageLang())
