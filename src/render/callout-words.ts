// A callout's label in the language of the piece it sits in (2026-09-30, FIXLIST 8.1).
//
// `post-content.ts` prints `Note`, `Tip`, `Warning`, `Important` and `Caution`, and it has to:
// the body it renders is language-blind, cached without a locale, and compared byte for byte
// with 1.x in the golden corpus. So the words are swapped when the page is put together, the
// same place the rest of the piece's chrome gets its language — and a Japanese post stops
// opening its warning box with an English word.
import type { Dict } from '@/locales/types'
import type { SiteLang } from '@/types'
import { escapeHtml } from '@/utils'
import { curlyQuotes } from '@/render/curly-quotes'

const KEY: Record<string, keyof Dict> = {
  note: 'calloutNote', tip: 'calloutTip', warning: 'calloutWarning',
  important: 'calloutImportant', caution: 'calloutCaution',
}

const LABEL = /(<div class="callout callout-(note|tip|warning|important|caution)"><p class="callout-label">)[^<]*(<\/p>)/g

export function calloutWords(html: string, s: Dict): string {
  return html.replace(LABEL, (_, open: string, type: string, close: string) =>
    `${open}${escapeHtml(String(s[KEY[type]!]))}${close}`)
}

/**
 * Everything a finished body gets from its language when the page is put together: the callout
 * labels above, and the quotes curled the way `lang` writes them (`curly-quotes.ts`). A null
 * `lang` is the owner's switch turned off (`features.curlyQuotes`): the quotes stay as typed.
 */
export function pieceWords(html: string, s: Dict, lang: SiteLang | null): string {
  const labelled = calloutWords(html, s)
  return lang ? curlyQuotes(labelled, lang) : labelled
}
