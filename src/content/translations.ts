// THE SAME PIECE, SAID IN ANOTHER LANGUAGE (ADR 0056).
//
// A piece names the language it is written in and a group its translations share. Two pieces
// with the same group are each other's translations — a GROUP rather than a pointer, because a
// pointer stored as a slug breaks the day that slug is renamed, and because three languages are
// a graph and not a chain.
//
// ⚠️ THE EFFECTIVE LANGUAGE IS `lang ?? settings.language`, and the distinction between the two
// is load-bearing. A row that has never named a language is not "English" — it is a row nobody
// has thought about, which is every row on every blog written before this existed. It renders
// in the site's language exactly as it always did and it advertises nothing. Only a piece that
// SAYS what it is can be one half of an hreflang pair, so a blog that has never touched this
// cannot be given a wrong pair by accident.
//
// ⚠️ ONE RULE, TWO SURFACES. The `<link rel="alternate">` block on an article and the
// `<xhtml:link>` block in the sitemap are the same claim written twice, and a crawler that
// finds them disagreeing is entitled to ignore both. So the decision — which pieces are in a
// group, what each one's language is, and what to do when two of them collide — lives in
// `groupsOf` below, and both surfaces read it.
//
// ⚠️ AND IT READS THE INDEX, not the database. `getPublicPosts` and `getPublicPages` are read
// whole by every listing on the site and are behind the page cache; walking them costs a pass
// over rows already in memory. A `where tr_group = ?` would be a second query per article page
// for a fact almost no article has, which is the trade the sitemap's image rule turns down for
// the same reason.

import type { Page, Post, SiteLang, SiteSettings } from '@/types'
import { escapeAttr } from '@/utils'
import { getIndex, getPublicPosts } from '@/content/posts'
import { getPageIndex, getPublicPages } from '@/content/pages'
import { getSettings } from '@/content/settings'
import { SITE_LANGS } from '@/locales/langs'

/** One language this piece exists in, ready to be printed as a link. */
export type Sibling = {
  lang: SiteLang
  /** Root-relative, like every internal link this blog writes. */
  path: string
  title: string
}

type Piece = Pick<Post, 'slug' | 'title' | 'lang' | 'translationGroup'>

/** What a piece is written in when it has not said: the site's own language. */
export const langOf = (piece: { lang?: SiteLang }, siteLang: SiteLang): SiteLang =>
  piece.lang ?? siteLang

/**
 * ` lang="ko"` for a title in a LIST, and '' far more often than not.
 *
 * An article page gets the piece's language on `<html>` and everything inside it inherits.
 * A listing cannot: one document carries thirty titles, and the eleven in Korean sit beside
 * the twenty in English under one root. Without this, `:lang()` matches that root and every
 * one of them is Korean-or-not by the site's answer — which is how a Han character ends up
 * drawn in the wrong country's shapes (`content/fonts.ts` builds those rules and says so) and
 * how a screen reader reads 모아쓰기 in an English voice.
 *
 * ⚠️ IT GOES ON THE PIECE'S OWN WORDS AND NOTHING ELSE — the title and the excerpt. The date,
 * the category, the reading time and the pager around them are the SITE speaking, in the site's
 * language, and ADR 0056 turns down "the whole page follows the piece" in as many words. A
 * `lang` on the card would hand the date to the wrong dictionary to win the headline.
 *
 * ⚠️ AND IT IS EMPTY WHEN THE TWO AGREE, which is every card on the monolingual blogs that are
 * almost all of them. `lang` is inherited: repeating the root's own answer thirty times is
 * thirty attributes that change nothing. Same reasoning as a NULL `lang` advertising no
 * hreflang — a blog that has not said anything has nothing said on its behalf.
 */
export const langAttr = (piece: { lang?: SiteLang }, siteLang: SiteLang): string =>
  piece.lang && piece.lang !== siteLang ? ` lang="${escapeAttr(piece.lang)}"` : ''

/**
 * Every translation group on the blog, as `slug -> the whole group INCLUDING that slug`.
 *
 * Pure, so the sitemap can hand it the lists it already holds and an article page can hand it
 * the ones behind the cache. Neither reads the database for this.
 *
 * ⚠️ A GROUP WITH TWO PIECES IN ONE LANGUAGE IS DROPPED WHOLE, not deduped. Deduping looks
 * kinder and produces an INVALID document: the rule is that every page in a group lists every
 * page in the group including itself, so the piece that lost the tie would publish a set it is
 * not in — and a crawler finding an asymmetric set may ignore the group entirely. Dropping it
 * is the same answer on every surface, and the collision is visible in the editor's panel,
 * which lists the group whether or not it can be advertised.
 */
export function groupsOf(
  pieces: readonly { piece: Piece; path: string }[], siteLang: SiteLang,
): Map<string, Sibling[]> {
  const byGroup = new Map<string, { lang: SiteLang; path: string; title: string; slug: string }[]>()
  for (const { piece, path } of pieces) {
    const group = piece.translationGroup?.trim()
    if (!group) continue
    const entry = { lang: langOf(piece, siteLang), path, title: piece.title, slug: piece.slug }
    byGroup.set(group, [...(byGroup.get(group) ?? []), entry])
  }
  const out = new Map<string, Sibling[]>()
  for (const members of byGroup.values()) {
    if (members.length < 2) continue
    const langs = new Set(members.map((m) => m.lang))
    if (langs.size !== members.length) continue
    const set = members.map(({ lang, path, title }) => ({ lang, path, title }))
    for (const member of members) out.set(member.slug, set)
  }
  return out
}

/** Posts and pages as `groupsOf` takes them. Both public: a draft is nobody's translation. */
export async function publicPieces(): Promise<{ piece: Piece; path: string }[]> {
  const [posts, pages] = await Promise.all([getPublicPosts(), getPublicPages()])
  return [
    ...posts.map((p: Post) => ({ piece: p, path: `/${p.slug}` })),
    ...pages.map((p: Page) => ({ piece: p, path: `/${p.slug}` })),
  ]
}

/**
 * The OTHER languages this piece exists in, for a switcher a reader can press.
 *
 * A draft is never here, because both lists are the public ones — a translation still being
 * written is not advertised to a crawler, not printed in a switcher and not named in the
 * sitemap, which is the rule every other surface on this site already follows.
 */
export async function siblingsOf(piece: Piece, settings: SiteSettings): Promise<Sibling[]> {
  if (!piece.translationGroup?.trim()) return []
  const groups = groupsOf(await publicPieces(), settings.language)
  return (groups.get(piece.slug) ?? []).filter((s) => s.path !== `/${piece.slug}`)
}

/**
 * The `<link rel="alternate" hreflang>` set for a piece, as markup, or ''.
 *
 * THIS PIECE IS IN IT TOO, which is what `groupsOf` returns and what the specification asks
 * for. `x-default` goes to the piece in the SITE's own language, and to the first otherwise:
 * it is what a search engine offers a reader whose language is in none of the set, so "the
 * language this blog is mostly written in" is the only answer that is not arbitrary.
 *
 * Absolute URLs, because hreflang takes nothing else — a relative href here is a line every
 * crawler drops in silence.
 */
export function alternateLinks(
  self: { lang: SiteLang; path: string }, siblings: readonly Sibling[],
  site: string, siteLang: SiteLang,
): string {
  if (siblings.length === 0 || !site) return ''
  const all = [{ lang: self.lang, path: self.path }, ...siblings]
  const link = (hreflang: string, path: string): string =>
    `<link rel="alternate" hreflang="${hreflang}" href="${site}${path}">`
  const fallback = all.find((entry) => entry.lang === siteLang) ?? all[0]!
  return all.map((entry) => link(entry.lang, entry.path)).join('')
    + link('x-default', fallback.path)
}

/**
 * Every group name in use, for the editor's datalist. Drafts INCLUDED.
 *
 * ⚠️ The public lists are the wrong ones here, and that is the one place in this file where
 * they are. A translation is normally written BEFORE it is published, so offering only the
 * groups that are already live would hide the name from exactly the moment the owner is
 * typing it — the second half of a pair, still a draft, looking for what the first half is
 * called.
 */
export async function translationGroups(): Promise<string[]> {
  const [posts, pages] = await Promise.all([getIndex(), getPageIndex()])
  const names = new Set<string>()
  for (const piece of [...posts, ...pages]) {
    const group = piece.translationGroup?.trim()
    if (group) names.add(group)
  }
  return [...names].sort((a, b) => a.localeCompare(b))
}

/**
 * The group's members, as `English · Tiếng Việt`, for the editor to print under the field.
 *
 * DRAFTS INCLUDED and the piece itself EXCLUDED, for the same reason as above: the owner is
 * looking for "did my name land in the right group", and the answer has to count the draft
 * they are typing beside. A published-only line would read empty on a pair that exists.
 *
 * It is a SENTENCE and not a link list: the panel is drawn by the server on every open, and a
 * second way to navigate between pieces is a second thing to keep working.
 */
export async function groupMembersLine(selfSlug: string, group: string): Promise<string> {
  const name = group.trim()
  if (!name) return ''
  const settings = await getSettings()
  const [posts, pages] = await Promise.all([getIndex(), getPageIndex()])
  return [...posts, ...pages]
    .filter((p) => p.translationGroup?.trim() === name && p.slug !== selfSlug)
    .map((p) => {
      const code = langOf(p, settings.language)
      return `${SITE_LANGS.find((l) => l.value === code)?.label ?? code} — ${p.title || p.slug}`
    })
    .join(' · ')
}
