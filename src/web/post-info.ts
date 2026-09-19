// The post info panel: the date, the length, the way into book mode and the taxonomy, in
// the RIGHT gutter of an article — the half of the page that had nothing in it.
//
// It exists only above the rail breakpoint. Below it there is no gutter to put anything in,
// so the panel is `display:none` and the in-flow originals (the meta line above the title,
// the taxonomy over a rule at the end) are what the reader gets, exactly as before. That is
// the reason the same facts are in the markup twice: at any one width precisely one copy
// has a box, so a screen reader is never read the date twice. The listing sidebar already
// does this for the mobile drawer (`drawer-only`).
//
// It does NOT scroll with the article. A sticky panel would ride down the gutter and sit on
// top of any wide image or video, which noses out into that same gutter by one rail width.
// So it stands at the top of the article and leaves with it.
//
// One line per fact, not the meta line's run of middots: 250px is too narrow for
// "date · 4,160 words · 21 min" and the wrap lands mid-phrase. Stacked, it reads as what it
// is — a properties panel.

import type { SiteLang } from '@/types'
import type { Sibling } from '@/content/translations'
import { SITE_LANGS } from '@/locales/langs'
import type { PostWithContent, SiteSettings } from '@/types'
import type { Dict } from '@/locales/types'
import { formatCount, formatDate, zonedDay } from '@/i18n/i18n'
import { tagText, termSlug } from '@/content/taxonomy'
import { escapeAttr, escapeHtml, minutesFor } from '@/utils'
import { ICONS, INK_LOOP_SVG } from '@/icons'
import { TOC_ANCHORS } from '@/render/toc'

/**
 * Comma-separated term links, as the frozen tree rendered them. Tags read lowercase.
 *
 * Shared with the article footer rather than copied into it: the two runs are the same
 * information at two widths, and a divergence between them is a difference the reader would
 * see when they turned their phone sideways.
 */
/** The one button that opens the book, with the pen loop it wears on hover, for both places it is drawn. */
export const bookToggle = (inner: string): string =>
  `<button type="button" class="book-mode-toggle" data-book-open>${inner}${INK_LOOP_SVG}</button>`

export function termLinks(list: string[], kind: 'category' | 'tag', lower = false): string {
  return list
    .map((x) => `<a class="link-accent${lower ? ' lower' : ''}" href="/${kind}/${
      escapeAttr(termSlug(x))}">${escapeHtml(kind === 'tag' ? tagText(x) : x)}</a>`)
    .join(', ')
}

/** A labelled run of terms, wrapped so the IDE chrome can bracket it as an array. */
const termRow = (label: string, html: string): string =>
  `<p class="info-terms">${escapeHtml(label)}: <span class="term-list">${html}</span></p>`

/**
 * @param words the body's word count, already taken.
 *
 * Passed in rather than taken again: `renderArticle` prints the same two numbers in the meta
 * line above the title, so the pair was being computed FOUR times per article, each one a
 * `toPlainText` pass over the whole body. Measured 2026-09-16 on a 2,978 character post,
 * toggling `features.readingTime`: 1,515us against 973us, so that one line of chrome was 36%
 * of the render, and it grows with the piece. It is also the repo's worst smell in its
 * plainest form, one rule written twice for one screen.
 *
 * NOT read off `post.readingMinutes`, though the column exists. A row written before
 * `toPlainText` learned to drop list markers holds the old answer, and a panel disagreeing
 * with the line six centimetres above it is the fault this change is fixing.
 */
export function postInfoPanel(
  post: PostWithContent, settings: SiteSettings, s: Dict, words: number,
): string {
  const { features } = settings
  const rows: string[] = [
    `<p><time datetime="${escapeAttr(post.date)}">${
      escapeHtml(formatDate(post.date, settings.language, settings.timezone))}</time></p>`,
  ]
  // Who wrote it, directly under the date — the same place the meta line puts it, and this
  // panel IS the meta line above the rail breakpoint (`article.ts` hides `.post-meta`
  // there, so a byline that lived only in that line was invisible on every desktop).
  if (settings.author.name) {
    const who = settings.author.url
      ? `<a class="link-accent" href="${escapeAttr(settings.author.url)}" rel="author">${escapeHtml(settings.author.name)}</a>`
      : escapeHtml(settings.author.name)
    rows.push(`<p class="byline">${escapeHtml(s.bylinePrefix)} ${who}</p>`)
  }
  // Edited AFTER publishing, and only then. On a technical blog a post gets corrected, and a
  // reader deciding whether to trust what they are reading wants to know they are on the
  // current version. Same DAY as the date above counts as unedited: a line saying a post was
  // updated the day it went out is a line that says nothing, printed forever.
  if (post.updatedAt
    && zonedDay(post.updatedAt, settings.timezone) > zonedDay(post.date, settings.timezone)) {
    rows.push(`<p class="info-updated">${escapeHtml(s.updatedPrefix)} <time datetime="${
      escapeAttr(post.updatedAt)}">${
      escapeHtml(formatDate(post.updatedAt, settings.language, settings.timezone))}</time></p>`)
  }
  if (features.readingTime) {
    // ONE line for the two, because they answer one question — how long is this. They were
    // two of a seven-line column, and the wrap this file's header warns about is about the
    // DATE line, not these: "2.799 chữ · 14 phút đọc" is short enough to hold at 250px.
    // The figures are wrapped and the units are not, the same way the meta line does it, so
    // the IDE chrome can set a literal apart from the words beside it.
    rows.push(`<p><span class="num">${
      formatCount(words, settings.language)}</span> ${escapeHtml(s.wordsSuffix)}`
      + ` · <span class="num">${minutesFor(words)}</span> ${escapeHtml(s.readingSuffix)}</p>`)
  }
  // No category link among the rows even though the meta line carries one: the full list of
  // categories is two lines further down, and naming the first of them twice in a 250px
  // column reads as a rendering fault rather than as emphasis.
  // Each term row leads with its own anchor. Above the rail breakpoint this panel is the
  // ONLY copy of these facts — the end-of-article block is hidden there — so the contents
  // list's last row needs somewhere real to land at that width. `render/toc.ts` says why
  // the names differ from the footer's, and `assets/js/toc.ts` picks between them.
  const anchor = (id: string) => `<span class="anchor" id="${id}"></span>`
  if (post.tags.length) {
    rows.push(anchor(TOC_ANCHORS.infoTags) + termRow(s.tagLabel, termLinks(post.tags, 'tag', true)))
  }
  if (post.categories.length) {
    rows.push(anchor(TOC_ANCHORS.infoCategories)
      + termRow(s.categoryLabel, termLinks(post.categories, 'category')))
  }
  // LAST, and set apart. Everything above it is a fact about the post; this is the one thing
  // in the panel the reader can DO, so it goes at the foot with air around it rather than
  // buried between the reading time and the tags. The IDE chrome marks it like a label.
  // A BUTTON that looks like one. It was a text link in a column of grey text: the only
  // thing in the panel a reader can press, dressed exactly like the six facts above it, and
  // reachable only by hitting the words themselves. Now it carries an edge, a hand-sized
  // target and the book from the shared icon set — and the press has the product's own
  // click, from `utility.css.ts`.
  if (features.bookMode) {
    rows.push(`<p class="info-action">${bookToggle(
      `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"`
      + ` stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS.book}</svg>`
      + `<span>${escapeHtml(s.bookMode)}</span>`)}</p>`)
  }

  return `<aside class="post-info t-small text-meta">${rows.join('')}</aside>`
}

/**
 * THE OTHER LANGUAGES, AS LINKS A READER CAN PRESS (ADR 0056).
 *
 * `hreflang` tells a search engine; this tells the person. They are not the same job and the
 * first does not do the second — a reader who lands on the Vietnamese essay from a Vietnamese
 * search has no way to the English one except this line.
 *
 * ⚠️ EACH NAME IS IN ITS OWN LANGUAGE, and each link carries `lang` as well as `hreflang`. A
 * screen reader in a Vietnamese document meeting the string "English" pronounces it as
 * Vietnamese unless the element says otherwise, which is the one place a language switcher can
 * be actively worse than no switcher at all.
 *
 * NOT in the meta line: `post-meta` is hidden above the rail breakpoint, where the same facts
 * are in the gutter, and a way out of the page is not a fact that may disappear on a wide
 * screen.
 */
export function languageLine(siblings: readonly Sibling[], label: string): string {
  if (siblings.length === 0) return ''
  const link = (sibling: Sibling): string =>
    `<a class="link-accent" href="${escapeAttr(sibling.path)}" hreflang="${escapeAttr(sibling.lang)}"`
    + ` lang="${escapeAttr(sibling.lang)}">${escapeHtml(nameOfLang(sibling.lang))}</a>`
  return `\n<p class="t-small text-meta post-langs">${escapeHtml(label)} ${
    siblings.map(link).join(' · ')}</p>`
}

/** A language in its own name — the only spelling a switcher may use. */
const nameOfLang = (code: SiteLang): string =>
  SITE_LANGS.find((l) => l.value === code)?.label ?? code
