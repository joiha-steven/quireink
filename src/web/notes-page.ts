// The notebook, read: `/notes` (every published note, newest first) and `/notes/{slug}`.
//
// A note is written like a post and kept apart from the posts (ADR 0044), and the reading
// side keeps that apart too: its own list, its own address, no series, no related posts, no
// comment thread, never in the post feed. What it shares is the paper — the same shell,
// the same reading face, the same pen — because a notebook is read on the same desk.
//
// A CLIP opens on the passage it kept and where it came from, then the owner's own words
// beneath; a note the owner simply wrote is only the words.

import { getSettings } from '@/content/settings'
import { getNote, getPublicNotes } from '@/content/notes'
import { renderPostContent } from '@/render/post-content'
import { listingPage } from '@/web/listing-page'
import { formatDate, t } from '@/i18n/i18n'
import { clampExcerpt, escapeAttr, escapeHtml, fill, isPublicallyVisible, toPlainText } from '@/utils'
import type { Note } from '@/types'

/** Where a clip came from, as one line: the word, then the source by its title. */
function sourceLine(note: Note, prefix: string): string {
  if (!note.sourceUrl) return ''
  const name = note.sourceTitle || note.sourceUrl.replace(/^https?:\/\//, '')
  // `u-quotation-of`: the microformat a receiver reads the source off (ADR 0046).
  return `<p class="note-source t-small text-meta">${escapeHtml(prefix)} <a class="link-accent u-quotation-of" href="${
    escapeAttr(note.sourceUrl)}" rel="noopener">${escapeHtml(name)}</a></p>`
}

export async function renderNotesIndex(): Promise<string> {
  const settings = await getSettings()
  const s = t(settings.language)
  const notes = await getPublicNotes()
  const cards = notes.map((n) => {
    const summary = n.quote ? clampExcerpt(n.quote) : ''
    return `<article class="reveal">
<p class="t-small text-meta"><time class="meta-part" datetime="${escapeAttr(n.date)}">${
      escapeHtml(formatDate(n.date, settings.language, settings.timezone))}</time></p>
<h2 class="reading-font mt-2 fs-h3 font-semibold"><a class="link-accent" href="/notes/${escapeAttr(n.slug)}">${
      escapeHtml(n.title || n.sourceTitle || n.slug)}</a></h2>${
      summary ? `<p class="reading-font mt-3 t-body text-text">${escapeHtml(summary)}</p>` : ''}${
      sourceLine(n, s.noteSourcePrefix)}
</article>`
  }).join('\n')
  const body = notes.length === 0
    ? `<p class="empty">${escapeHtml(s.notesEmpty)}</p>`
    : `<div class="post-list">${cards}</div>`
  return listingPage({
    title: `${s.notesTitle} · ${settings.title}`,
    description: fill(s.notesMeta, { site: settings.title }),
    body: `<header class="listing-head"><h1>${escapeHtml(s.notesTitle)}</h1></header>${body}`,
    canonicalPath: '/notes',
    cardTitle: s.notesTitle,
    activeHref: '/notes',
  })
}

/** One note, or null when there is none a reader may see. */
export async function renderNotePage(slug: string): Promise<string | null> {
  const settings = await getSettings()
  const s = t(settings.language)
  const note = await getNote(slug)
  if (!note || !isPublicallyVisible(note.status, note.date)) return null
  const body = await renderPostContent({ markdown: note.content })
  const title = note.title || note.sourceTitle || note.slug
  // The passage a clip kept, before the owner's words: a blockquote in the reading face,
  // so the pen's marks can land on it like on any paragraph.
  const kept = note.quote
    ? `<blockquote class="note-quote"><p>${escapeHtml(note.quote)}</p></blockquote>`
    : ''
  // An h-entry, so a site the clip mentions can read what this is: its name, its date, the
  // source it quotes, its words, and who kept it (the site, as an h-card).
  const article = `<article class="h-entry">
<header>
<p class="t-small text-meta post-meta"><time class="dt-published" datetime="${escapeAttr(note.date)}">${
    escapeHtml(formatDate(note.date, settings.language, settings.timezone))}</time></p>
<h1 class="reading-font mt-2 fs-h1 font-semibold p-name">${escapeHtml(title)}</h1>
${sourceLine(note, s.noteSourcePrefix)}
</header>
<div id="post-body" class="prose">${kept}<div class="e-content">${body}</div></div>
<a class="u-url" href="/notes/${escapeAttr(note.slug)}" hidden></a><span class="p-author h-card" hidden>${escapeHtml(settings.title)}</span>
</article>`
  return listingPage({
    title: `${title} · ${settings.title}`,
    description: clampExcerpt(note.quote || toPlainText(note.content).slice(0, 300)),
    body: article,
    canonicalPath: `/notes/${note.slug}`,
    cardTitle: title,
    activeHref: '/notes',
  })
}
