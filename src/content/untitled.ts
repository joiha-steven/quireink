// A POST MAY HAVE NO TITLE (ADR 0064).
//
// A short post — a thought, a link with a line under it, a small announcement — is a post
// like any other: its own address, the blog's list, the feed, tags and categories. What it
// does not have is a name, and most of the site was built on the assumption that everything
// has one. This file is the two answers for when it does not, so twenty call sites ask the
// same question the same way rather than each inventing a fallback of its own.
//
// Nothing here touches the database or the DOM: the editor's island reads `slugFromWords`
// to name a piece on its first save, and the server reads both.
import { clampExcerpt, slugify, toPlainText } from '@/utils'

/** Words that make up a short post's address, and characters its stand-in name may run to. */
const SLUG_WORDS = 6
const NAME_CHARS = 70

/**
 * The address a piece with no title is saved under: its first words.
 *
 * `hom-nay-toi-doc-lai` reads aloud; `post-1758800000000` does not, and that was the only
 * answer an untitled piece had. Six words, because the address is a handle and not a summary.
 * '' when the words themselves slugify to nothing (CJK, emoji), and the caller falls back to
 * the timestamp exactly as it does for a title that does.
 */
export function slugFromWords(markdown: string): string {
  const words = toPlainText(markdown).split(' ').filter(Boolean).slice(0, SLUG_WORDS)
  return slugify(words.join(' '))
}

/**
 * A post's name, wherever something has to be called something: the tab's `<title>`, the
 * share card, a link in the related list, the subject of a newsletter.
 *
 * The title when there is one. Otherwise the start of its own words — the excerpt, which is
 * the body's opening already stripped to text — cut at a word, and the slug only when there
 * are no words at all.
 */
export function postName(post: { title: string; excerpt?: string | null; slug: string }): string {
  const title = post.title.trim()
  if (title) return title
  const excerpt = (post.excerpt ?? '').trim()
  if (!excerpt) return post.slug
  // The stored excerpt says it was cut with a trailing `...`; so does `clampExcerpt`. Either
  // cut is one ellipsis on the name, and the typographic one, since this is read as a title.
  const cut = excerpt.endsWith('...')
  const name = clampExcerpt(cut ? excerpt.slice(0, -3).trim() : excerpt, NAME_CHARS)
  if (name.endsWith('...')) return `${name.slice(0, -3)}…`
  return cut ? `${name}…` : name
}

/** Has this post a title of its own? The list, the article and the feed each draw it differently when not. */
export const isUntitled = (post: { title: string }): boolean => post.title.trim() === ''
