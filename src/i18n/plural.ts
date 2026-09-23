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

/**
 * The categories each language's strings were WRITTEN for, in the order they are written.
 *
 * Fixed here rather than asked of the engine, because the engine's answer depends on how old
 * its plural data is: a browser from before about 2022 reports only one/other for es, it and
 * pt (no "many"), and French before about 2020 the same. Asked by position, that browser picked
 * the MIDDLE form for "other" and the editor printed "5 de palabras" (release review,
 * 2026-09-23). Asked by name, an old engine that says "other" where a new one says "many" gets
 * the "other" form, which for these languages is the right plural anyway.
 *
 * A language added to SiteLang must be added here, and the type makes that a compile error.
 */
const WRITTEN: Record<SiteLang, readonly string[]> = {
  en: ['one', 'other'], de: ['one', 'other'],
  es: ['one', 'many', 'other'], fr: ['one', 'many', 'other'],
  it: ['one', 'many', 'other'], pt: ['one', 'many', 'other'],
  ru: ['one', 'few', 'many', 'other'],
  vi: ['other'], ja: ['other'], ko: ['other'], zh: ['other'],
}

const rules = new Map<string, Intl.PluralRules>()
const ruleFor = (locale: string): Intl.PluralRules => {
  let r = rules.get(locale)
  if (!r) { r = new Intl.PluralRules(locale); rules.set(locale, r) }
  return r
}

/** The categories a language uses, in the order its forms are written. */
export function pluralOrder(lang: SiteLang): string[] {
  return [...(WRITTEN[lang] ?? ['one', 'other'])]
}

/** `template` with the form for `n` chosen and `{n}` replaced by `shown` (default: `n`). */
export function plural(template: string, n: number, lang: SiteLang, shown: string = String(n)): string {
  const forms = template.split('|')
  const form = forms.length === 1
    ? forms[0]!
    : forms[pluralOrder(lang).indexOf(ruleFor(dateLocale(lang)).select(n))]
      // A category the strings were not written for (an engine newer than this table) takes
      // the last form, which is "other" in every language here.
      ?? forms[forms.length - 1]!
  return form.replace('{n}', shown)
}
