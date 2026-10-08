// THE HELP SCREEN'S CONTENT: which language's words, and how they become the screen's HTML.
//
// The words live in `locales/help/<lang>.ts` since 2026-09-30. They were English here "by
// design", as a mirror of the repository docs — and they had drifted from the admin they
// describe: five settings tabs that no longer exist, a comment reply that was never built, a
// sign-in variable from an old version. So every place the prose names part of the admin is now
// a `{t:key}` the admin dictionary fills in, in the reader's language and always current.
//
// The locale files hold plain HTML with no classes: a translator should not have to carry the
// admin's class lists. `dress` puts them on.
import type { SiteLang } from '@/types'
import type { AdminStrings } from '@/locales/types'
import type { HelpText } from '@/locales/help/types'
import en from '@/locales/help/en'
import vi from '@/locales/help/vi'
import de from '@/locales/help/de'
import ja from '@/locales/help/ja'
import zh from '@/locales/help/zh'
import ko from '@/locales/help/ko'
import fr from '@/locales/help/fr'
import es from '@/locales/help/es'
import pt from '@/locales/help/pt'
import it from '@/locales/help/it'
import ru from '@/locales/help/ru'
import { escapeHtml } from '@/utils'
import { A, CODE, LINKS, P, UL } from '@/admin-shared/kit'
import { TAP } from '@/admin-shared/scale'

/**
 * A link that stands on its own line (a list item): `inline-block` so the matching negative
 * margin works and the 24px hit box costs no height. Links INSIDE a sentence (`dress` below)
 * stay plain `A`: padding on an inline link overlaps the lines above and below it, and WCAG 2.5.8
 * exempts a link in running text from the 24px minimum.
 */
const LINK = `inline-block ${TAP} ${A}`
import { TAB_IDS } from '@/admin-shared/settings-tabs'

export const REPO = 'https://github.com/joiha-steven/quireink'
export const doc = (p: string): string => `${REPO}/blob/main/${p}`

const HELP: Record<SiteLang, HelpText> = { en, vi, de, ja, zh, ko, fr, es, pt, it, ru }

export const helpText = (lang: SiteLang): HelpText => HELP[lang] ?? en

/** `{t:key}` with the admin's own words for that key; a key that is not a string stays visible. */
export function fillWords(text: string, t: AdminStrings): string {
  const words = t as unknown as Record<string, unknown>
  return text.replace(/\{t:(\w+)\}/g, (all, key: string) =>
    typeof words[key] === 'string' ? escapeHtml(words[key] as string) : all)
}

const TAB_WORDS: Record<string, [keyof AdminStrings, keyof AdminStrings]> = {
  blog: ['tabBlog', 'tabBlogHint'], home: ['tabHome', 'tabHomeHint'], post: ['tabPost', 'tabPostHint'],
  appearance: ['tabAppearance', 'tabAppearanceHint'], people: ['tabPeople', 'tabPeopleHint'],
  server: ['tabServer', 'tabServerHint'], account: ['tabAccount', 'tabAccountHint'],
}

/** The settings tabs as a list, each named and explained in the admin's own words. */
function tabList(t: AdminStrings): string {
  return `<ul class="${UL} mt-2">` + TAB_IDS.map((tab) => {
    const [name, hint] = TAB_WORDS[tab] ?? ['tabBlog', 'tabBlogHint']
    return `<li><a href="/admin/settings?tab=${tab}" class="${LINK}">${escapeHtml(String(t[name]))}</a>`
      + ` — ${escapeHtml(String(t[hint]))}</li>`
  }).join('') + `</ul>`
}

const OUT = 'target="_blank" rel="noopener noreferrer"'

/** A locale's plain HTML, with the admin's classes on it and every placeholder filled. */
export function dress(html: string, t: AdminStrings): string {
  return fillWords(html, t)
    .replace('{tabs}', tabList(t))
    .replace(/<p class="links">/g, `<p class="${LINKS}">`)
    .replace(/<p>/g, `<p class="${P}">`)
    .replace(/<ul class="after">/g, `<ul class="${UL} mt-2">`)
    .replace(/<ul>/g, `<ul class="${UL}">`)
    .replace(/<code>/g, `<code class="${CODE}">`)
    .replace(/<a href="doc:([^"]+)">/g, (_, p: string) => `<a href="${doc(p)}" ${OUT} class="${A}">`)
    .replace(/<a href="(https:[^"]+)">/g, `<a href="$1" ${OUT} class="${A}">`)
    .replace(/<a href="(\/[^"]*)">/g, `<a href="$1" class="${A}">`)
}
