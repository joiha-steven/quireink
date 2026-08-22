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

import type { PostWithContent, SiteSettings } from '@/types'
import type { Dict } from '@/locales/types'
import { formatCount, formatDate } from '@/i18n/i18n'
import { tagText, termSlug } from '@/content/taxonomy'
import { escapeAttr, escapeHtml, readingMinutes, wordCount } from '@/utils'

/**
 * Comma-separated term links, as the frozen tree rendered them. Tags read lowercase.
 *
 * Shared with the article footer rather than copied into it: the two runs are the same
 * information at two widths, and a divergence between them is a difference the reader would
 * see when they turned their phone sideways.
 */
export function termLinks(list: string[], kind: 'category' | 'tag', lower = false): string {
  return list
    .map((x) => `<a class="link-accent${lower ? ' lower' : ''}" href="/${kind}/${
      escapeAttr(termSlug(x))}">${escapeHtml(kind === 'tag' ? tagText(x) : x)}</a>`)
    .join(', ')
}

/** A labelled run of terms, wrapped so the IDE chrome can bracket it as an array. */
const termRow = (label: string, html: string): string =>
  `<p class="info-terms">${escapeHtml(label)}: <span class="term-list">${html}</span></p>`

export function postInfoPanel(post: PostWithContent, settings: SiteSettings, s: Dict): string {
  const { features } = settings
  const rows: string[] = [
    `<p><time datetime="${escapeAttr(post.date)}">${
      escapeHtml(formatDate(post.date, settings.language, settings.timezone))}</time></p>`,
  ]
  if (features.readingTime) {
    // The figures are wrapped and the units are not, the same way the meta line does it, so
    // the IDE chrome can set a literal apart from the words beside it.
    rows.push(`<p><span class="num">${
      formatCount(wordCount(post.content), settings.language)}</span> ${escapeHtml(s.wordsSuffix)}</p>`)
    rows.push(`<p><span class="num">${readingMinutes(post.content)}</span> ${
      escapeHtml(s.readingSuffix)}</p>`)
  }
  // No category link among the rows even though the meta line carries one: the full list of
  // categories is two lines further down, and naming the first of them twice in a 250px
  // column reads as a rendering fault rather than as emphasis.
  if (post.tags.length) rows.push(termRow(s.tagLabel, termLinks(post.tags, 'tag', true)))
  if (post.categories.length) {
    rows.push(termRow(s.categoryLabel, termLinks(post.categories, 'category')))
  }
  // LAST, and set apart. Everything above it is a fact about the post; this is the one thing
  // in the panel the reader can DO, so it goes at the foot with air around it rather than
  // buried between the reading time and the tags. The IDE chrome marks it like a label.
  if (features.bookMode) {
    rows.push(`<p class="info-action"><button type="button" class="book-mode-toggle" data-book-open>${
      escapeHtml(s.bookMode)}</button></p>`)
  }

  return `<aside class="post-info t-small text-meta">${rows.join('')}</aside>`
}
