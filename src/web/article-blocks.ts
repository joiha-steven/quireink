// The three blocks an article gained on 2026-08-29: its own picture at the top, a byline,
// and the author box under the words.
//
// A file of their own because `web/article.ts` was at 374 of its 400 lines and these are
// three self-contained strings, not three more branches in the composer. The seam is the
// one `front-card.ts` already established: a function that takes a post and returns markup,
// with the page deciding where it goes.
//
// NONE OF THEM RENDERS BY DEFAULT. `postImage.hero` is `none` and `author.name` is `''` on
// a fresh install and on every install that upgrades into this version, so an existing blog
// gets byte-identical HTML until its owner turns something on. That is deliberate and it is
// the reason each function starts with a guard rather than the caller doing it.

import type { Post, SiteSettings } from '@/types'
import { postImage, type ReadyImages } from '@/web/front-card'
import { escapeAttr, escapeHtml } from '@/utils'

/**
 * The picture at the top of an article, ABOVE the headline, or ''.
 *
 * Above and not below, which is the order every magazine and most blogs use: the picture
 * is what makes somebody stop, and a cover printed underneath the standfirst is a cover
 * that has already been scrolled past. It also puts the two halves in the right order for
 * a reader — see it, then read what it is.
 *
 * `featuredImage` has been stored, resized and served since the port, and until this
 * function existed a reader could only ever see it on a share card or a newspaper-mode
 * front page. The article — the page the picture belongs to — never showed it.
 *
 * `priority` is passed as TRUE, and it is the one call in the file that has to be: a hero
 * sits at the top of the page, which makes it the LCP element on any post that has one.
 * `postImage` turns that into `fetchpriority="high"` instead of `loading="lazy"`, and the
 * reasoning for why lazy is wrong there is written out where that function lives. Every
 * other picture on the page keeps its lazy default, so a post with a hero still only ever
 * declares one priority image.
 *
 * The reading column is the only width on offer, and `types-settings.ts` carries the
 * measurement that says why: a hero that broke into the gutter covered the table of
 * contents, and the band between the two rails is eight pixels wide and does not grow.
 */
export function heroImage(
  post: Post,
  settings: SiteSettings,
  ready: ReadyImages,
  dims?: { width: number; height: number },
): string {
  const { hero } = settings.postImage
  if (hero === 'none') return ''
  // `dims` is what stops the page jumping when the file lands. The article render already
  // reads every picture's intrinsic size for the body (`mediaFacts`), so this costs nothing
  // beyond passing it along.
  const picture = postImage(post, ready, `(max-width: 700px) 100vw, ${settings.contentWidth}px`, true, dims)
  if (!picture) return ''
  // `data-hero` rather than a class: it is a setting, and an attribute selector reads the
  // setting directly instead of the markup encoding a decision that can change while the
  // page sits in the cache.
  return `<figure class="post-hero" data-hero="${hero}">${picture}</figure>`
}

/**
 * ` · by Name` for the meta line, or ''.
 *
 * A fragment rather than a block, because the meta line above a title is where a reader
 * looks for this and the line already carries the date and the length. It is emitted with
 * its own separator so it disappears cleanly when there is no name.
 */
export function byline(settings: SiteSettings, byLabel: string): string {
  const { name, url } = settings.author
  if (!name) return ''
  const who = url
    ? `<a class="link-accent" href="${escapeAttr(url)}" rel="author">${escapeHtml(name)}</a>`
    : escapeHtml(name)
  return ` · <span class="byline">${escapeHtml(byLabel)} ${who}</span>`
}

/**
 * The author box under an article, or ''.
 *
 * Needs a name AND a bio: a box holding a name the meta line already printed is furniture,
 * not information. The portrait is optional and the box lays out without it.
 *
 * `rel="author"` on the link and `itemprop`-free markup on purpose — the machine-readable
 * copy of this is the `author` object in the JSON-LD (`render/schema.ts`), and two
 * declarations of the same fact are two things to keep in step.
 */
export function authorBox(settings: SiteSettings): string {
  const { name, bio, avatarUrl, url } = settings.author
  if (!name || !bio) return ''
  // 96px at 2x: the box draws it at 48, and a portrait is the one image on the page whose
  // dimensions are known before the render, so it carries width/height and never shifts.
  const portrait = avatarUrl
    ? `<img class="author-face" src="${escapeAttr(avatarUrl)}" alt="" width="48" height="48" loading="lazy" decoding="async">`
    : ''
  const who = url
    ? `<a class="link-accent" href="${escapeAttr(url)}" rel="author">${escapeHtml(name)}</a>`
    : escapeHtml(name)
  return `<aside class="author-box">${portrait}<div class="author-text">
<p class="author-name">${who}</p>
<p class="author-bio t-small text-meta">${escapeHtml(bio)}</p>
</div></aside>`
}
