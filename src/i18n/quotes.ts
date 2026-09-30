// THE MARKS A LANGUAGE QUOTES WITH — one table for the interface and for the pieces.
//
// Moved here from `scripts/checks/i18n-typography.ts` on 2026-09-30, when the published page
// started curling the straight quotes an author types (`render/curly-quotes.ts`). Two tables
// would have drifted apart the first time somebody corrected one of them, and then the words
// around a post and the words in it would quote two different ways.
//
// ⚠️ THE LANGUAGE DECIDES, NOT THE AUTHOR. German quotes with „low-high“, French and Russian
// with «guillemets», Japanese with 「corner brackets」. A single rule would be wrong in four
// languages.
import type { SiteLang } from '@/types'

/** The pair a language opens and closes a quotation with. */
export const QUOTES: Partial<Record<SiteLang, [string, string]>> = {
  de: ['„', '“'],
  // Guillemets, and it is the languages' own preference rather than a French import: Spanish
  // calls them comillas latinas and puts them first, Italian and European Portuguese the same.
  // Counted before the check existed: es 37 to 0, it 32 to 5, pt 29 to 7 — the minority was drift.
  es: ['«', '»'],
  fr: ['«', '»'],
  it: ['«', '»'],
  pt: ['«', '»'],
  ru: ['«', '»'],
  ja: ['「', '」'],
}

/** English, Vietnamese, Korean and Chinese: the curly pair. */
export const DEFAULT_QUOTES: [string, string] = ['“', '”']

/** A quotation inside a quotation. Only the languages with a settled inner pair differ. */
const INNER: Partial<Record<SiteLang, [string, string]>> = {
  de: ['‚', '‘'],
  ja: ['『', '』'],
}

export const quotesOf = (lang: SiteLang): [string, string] => QUOTES[lang] ?? DEFAULT_QUOTES
export const innerQuotesOf = (lang: SiteLang): [string, string] => INNER[lang] ?? ['‘', '’']
