// A count in a sentence, in the form the language wants for that number.
//
// "1 words" was printed by the editor in six languages and Russian was wrong for four of the
// first five counts, because every string had ONE form. A string that needs more now lists them
// separated by `|`, in the order `Intl.PluralRules` names the categories for that language:
//
//   en  '{n} word|{n} words'                          one | other
//   ru  '{n} слово|{n} слова|{n} слов|{n} слова'        one | few | many | other
//   ja  '{n} 語'                                       other (a language with no plural)
//
// The order is the CLDR one (zero, one, two, few, many, other) filtered to what the language
// has, so a translator reads it off the rules rather than learning a convention from here. A
// string with no `|` is returned as it was, which is every string written before this existed.

import type { SiteLang } from '@/types'
import { dateLocale } from '@/i18n/format'

const ORDER = ['zero', 'one', 'two', 'few', 'many', 'other'] as const

const rules = new Map<string, Intl.PluralRules>()
const ruleFor = (locale: string): Intl.PluralRules => {
  let r = rules.get(locale)
  if (!r) { r = new Intl.PluralRules(locale); rules.set(locale, r) }
  return r
}

/** The categories a language uses, in the order its forms are written. */
export function pluralOrder(lang: SiteLang): string[] {
  const have = new Set<string>(ruleFor(dateLocale(lang)).resolvedOptions().pluralCategories)
  return ORDER.filter((c) => have.has(c))
}

/** `template` with the form for `n` chosen and `{n}` replaced by `shown` (default: `n`). */
export function plural(template: string, n: number, lang: SiteLang, shown: string = String(n)): string {
  const forms = template.split('|')
  const form = forms.length === 1
    ? forms[0]!
    : forms[pluralOrder(lang).indexOf(ruleFor(dateLocale(lang)).select(n))] ?? forms[forms.length - 1]!
  return form.replace('{n}', shown)
}
