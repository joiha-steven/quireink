// WHAT THE CONTENT API HANDS OVER, field by field, and nothing else.
//
// ADR 0057. Every function here builds a NEW object and NAMES each field it emits. Not one of
// them spreads a stored row and deletes from it, and that is the entire guarantee this file
// makes: a column added to `posts` next year reaches the public API when somebody writes its
// name here, on purpose, and never by arriving.
//
// ⚠️ THE TEST FOR THIS FILE ASSERTS THE KEY SET, not a handful of fields. A projection checked
// field by field is a list of the fields somebody remembered, which is the same hand-written
// list one layer up — this repository shipped that bug twice in one afternoon on 2026-09-19
// (`getPage` reading a stale column list, `payloadOf` sending one). Here the stale list would
// leak rather than lose, so the test is built the other way round: every piece it projects is
// filled in FULL, including the fields that must not travel, and the assertion is equality.

import type { Note, NoteWithContent, Page, PageWithContent, Post, PostWithContent, SiteLang } from '@/types'
import type { Sibling } from '@/content/translations'

/** A page of results, and enough about the paging for a client to walk it without guessing. */
export type Listing<T> = {
  items: T[]
  total: number
  page: number
  per: number
  pages: number
}

/** How many a page holds when the caller does not say, and the most it may ask for. */
export const PER_DEFAULT = 20
export const PER_MAX = 100

/**
 * A number a caller sent, or the fallback.
 *
 * Everything that is not a whole number in range becomes the fallback rather than an error:
 * `?page=abc` is a client bug, and answering page 1 is more useful to whoever is debugging it
 * than a 400 that reads like the endpoint is broken. What it must NOT do is pass the string on
 * — `per=1e9` as a LIMIT is a way to ask this blog to build its entire body of writing in one
 * response, which is the shape of every "read-only endpoints are harmless" outage.
 */
function whole(raw: string | undefined, fallback: number, max: number): number {
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1) return fallback
  return Math.min(n, max)
}

/** The slice a query asks for, clamped. `page` past the end yields an empty page, not a 404. */
export function paginate<T>(all: T[], pageRaw?: string, perRaw?: string): Listing<T> {
  const per = whole(perRaw, PER_DEFAULT, PER_MAX)
  const pages = Math.max(1, Math.ceil(all.length / per))
  const page = Math.min(whole(pageRaw, 1, Number.MAX_SAFE_INTEGER), pages)
  return { items: all.slice((page - 1) * per, page * per), total: all.length, page, per, pages }
}

/**
 * A stored URL as something a client on another machine can fetch.
 *
 * An upload reads back site-rooted (`/uploads/…`), which is right for a page on this site and
 * useless in a JSON document being parsed somewhere else. An absolute URL the owner typed —
 * a picture hosted elsewhere — is left exactly as it is.
 */
const absolute = (site: string, url: string | undefined): string | undefined =>
  url === undefined || url === '' ? undefined : (url.startsWith('/') ? `${site}${url}` : url)

/**
 * One sibling, as the article's own hreflang set already names it.
 *
 * `siblingsOf` answers root-relative paths, like every internal link this blog writes; the same
 * absolute-URL rule applies here as to the piece's own `url`, and for the same reason that
 * hreflang itself takes nothing else — a relative href in a document parsed somewhere else has
 * no base to resolve against.
 */
const translation = (s: Sibling, site: string): { lang: SiteLang; url: string; title: string } =>
  ({ lang: s.lang, url: `${site}${s.path}`, title: s.title })

/**
 * A post, without its body.
 *
 * ⚠️ `status` IS NOT HERE, and its absence is the point. Every piece this API returns is public
 * by the same test the page uses, so a `status` field could only ever read `"published"` — and a
 * field that is always the same is a field a future leak could hide behind. Nothing to compare
 * means nothing to be reassured by.
 *
 * ⚠️ `deletedAt` IS NOT HERE either, and `translationGroup` is not here. The first is a fact
 * about the owner's trash; the second is an opaque internal key that means nothing outside this
 * database, and the useful half of it — who the translations ARE — travels with the single piece
 * as `translations`, from the one rule every other surface reads (ADR 0056).
 */
export function apiPost(p: Post, site: string): Record<string, unknown> {
  return {
    slug: p.slug,
    url: `${site}/${p.slug}`,
    title: p.title,
    date: p.date,
    updatedAt: p.updatedAt ?? null,
    excerpt: p.excerpt ?? '',
    categories: p.categories,
    tags: p.tags,
    series: p.series ?? null,
    seriesOrder: p.seriesOrder ?? null,
    readingMinutes: p.readingMinutes ?? null,
    coverImage: absolute(site, p.coverImage) ?? null,
    featuredImage: absolute(site, p.featuredImage) ?? null,
    lang: p.lang ?? null,
  }
}

/**
 * A post with the Markdown its author wrote, and who its translations are.
 *
 * MARKDOWN, NOT HTML, and that is ADR 0052 rather than an omission. There is one markdown
 * engine in this product, its output is cached under a hash of its input, and it renders against
 * settings a client cannot see — tables, figures, galleries and the pen all read them. A second
 * door handing out HTML would be a second set of those decisions, drifting from the page it
 * claims to be a copy of. `/api/md/:slug` has served the same source since the port.
 */
export function apiPostFull(p: PostWithContent, site: string, siblings: Sibling[]): Record<string, unknown> {
  return { ...apiPost(p, site), content: p.content, translations: siblings.map((s) => translation(s, site)) }
}

/** A page: no date, no taxonomy, and never in a feed. */
export function apiPage(p: Page, site: string): Record<string, unknown> {
  return {
    slug: p.slug,
    url: `${site}/${p.slug}`,
    title: p.title,
    updatedAt: p.updatedAt ?? null,
    featuredImage: absolute(site, p.featuredImage) ?? null,
    lang: p.lang ?? null,
  }
}

export function apiPageFull(p: PageWithContent, site: string, siblings: Sibling[]): Record<string, unknown> {
  return { ...apiPage(p, site), content: p.content, translations: siblings.map((s) => translation(s, site)) }
}

/**
 * A note (ADR 0044): its own address, never in the post namespace.
 *
 * The `source*` trio is what a CLIP carries and is absent on a note the owner wrote. It ships
 * because it is already on the page — a clip that did not name where its passage came from
 * would be the one thing a notebook must not do.
 *
 * No `lang` and no `translations`: a note has neither column (ADR 0056), because a clip quotes
 * its source in the source's own language and there is no second note that is "the English one".
 */
export function apiNote(n: Note, site: string): Record<string, unknown> {
  return {
    slug: n.slug,
    url: `${site}/notes/${n.slug}`,
    title: n.title,
    date: n.date,
    updatedAt: n.updatedAt ?? null,
    quote: n.quote ?? null,
    sourceUrl: n.sourceUrl ?? null,
    sourceTitle: n.sourceTitle ?? null,
  }
}

export function apiNoteFull(n: NoteWithContent, site: string): Record<string, unknown> {
  return { ...apiNote(n, site), content: n.content }
}
