// The notebook's receiving door: `/notes/clip` (ADR 0045).
//
// A passage arrives from somewhere else — the reader's pen on another Quire Ink, or the
// bookmarklet on any page at all — as query parameters: where it came from, that page's
// title, the passage, and the words the reader typed beside it. The OWNER of this blog is
// the only person who may keep it, so the page is theirs: anyone else is sent to sign in
// and comes back here afterwards. What they see is the passage and one small form; Keep
// writes a note (a draft by default, so nothing arrives in public by accident) and shows
// the way to it.
//
// No JavaScript on this page. It is a form, it posts to itself, and the answer is a page.
// That is what lets it work from a popup the other site opened, from a phone, and from a
// browser with scripts off — and it is the shape a later door (Micropub) will keep.
//
// With no passage in the query it is the tool's own page: the bookmarklet to drag to the
// bookmarks bar, and a line saying what it does.

import type { Context } from 'hono'
import { getSettings, resolveSiteUrl } from '@/content/settings'
import { saveNote, getNote } from '@/content/notes'
import { SlugConflictError } from '@/content/slugs'
import { clearCache } from '@/server/cache'
import { logActivity } from '@/server/activity'
import { listingPage } from '@/web/listing-page'
import { currentOwner, ownerRouter } from '@/web/guard'
import { t } from '@/i18n/i18n'
import { escapeAttr, escapeHtml, fill } from '@/utils'

/** The longest passage the door accepts: a page of a book, not a book. */
const MAX_QUOTE = 4000
const MAX_NOTE = 4000

const clean = (v: string | undefined, max: number) => (v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
const isHttp = (v: string) => /^https?:\/\/\S+$/i.test(v)

/** What a page carries in for keeping, read the same way from a GET and from a POST body. */
function fields(src: Record<string, string | undefined>) {
  const url = clean(src.url, 2048)
  return {
    url: isHttp(url) ? url : '',
    title: clean(src.title, 300),
    quote: (src.quote ?? '').trim().slice(0, MAX_QUOTE),
    note: (src.note ?? '').trim().slice(0, MAX_NOTE),
    status: src.status === 'published' ? 'published' as const : 'draft' as const,
  }
}

/** The bookmarklet: a script the reader's browser runs on some other page, opening this door. */
function bookmarklet(site: string): string {
  const js = `(function(){var q=String(window.getSelection()||'').trim();`
    + `window.open('${site}/notes/clip?url='+encodeURIComponent(location.href)`
    + `+'&title='+encodeURIComponent(document.title)+'&quote='+encodeURIComponent(q),`
    + `'quire-clip','width=560,height=680,noopener')})()`
  return `javascript:${encodeURIComponent(js)}`
}

function page(title: string, body: string): Promise<string> {
  return listingPage({ title, body, noindex: true, noRail: true, cardTitle: title })
}

async function signInFirst(c: Context): Promise<Response> {
  const next = encodeURIComponent(c.req.path + (new URL(c.req.url).search || ''))
  return c.redirect(`/login?next=${next}`, 302)
}

export async function handleClipPage(c: Context): Promise<Response> {
  if (currentOwner(c) === null) return signInFirst(c)
  const settings = await getSettings()
  const s = t(settings.language)
  const site = resolveSiteUrl(settings)
  const q = c.req.query()

  // Just kept: say so, and point at the note.
  if (q.saved) {
    const note = await getNote(q.saved)
    const body = `<header class="listing-head"><h1>${escapeHtml(s.clipSavedHeading)}</h1></header>`
      + `<p class="clip-line">${note ? `<a class="link-accent" href="/notes/${escapeAttr(note.slug)}">${escapeHtml(s.clipSavedView)}</a>` : ''}</p>`
      + `<p class="clip-line"><a class="link-accent" href="/notes/clip">${escapeHtml(s.clipAgain)}</a></p>`
    return c.html(await page(`${s.clipSavedHeading} · ${settings.title}`, body), 200, { 'x-robots-tag': 'noindex' })
  }

  const f = fields(q)
  // Nothing to keep: the tool's own page.
  if (!f.quote && !f.url) {
    const label = fill(s.clipToolLabel, { site: settings.title })
    const body = `<header class="listing-head"><h1>${escapeHtml(s.clipToolHeading)}</h1></header>`
      + `<p class="clip-line"><a class="clip-tool" href="${escapeAttr(bookmarklet(site))}" draggable="true">${escapeHtml(label)}</a></p>`
      + `<p class="clip-line t-small text-meta">${escapeHtml(s.clipToolHint)}</p>`
    return c.html(await page(`${s.clipToolHeading} · ${settings.title}`, body), 200, { 'x-robots-tag': 'noindex' })
  }

  const source = f.url
    ? `<p class="note-source t-small text-meta">${escapeHtml(s.noteSourcePrefix)} <a class="link-accent" href="${
        escapeAttr(f.url)}" rel="noopener">${escapeHtml(f.title || f.url.replace(/^https?:\/\//, ''))}</a></p>`
    : ''
  const kept = f.quote ? `<blockquote class="note-quote"><p>${escapeHtml(f.quote)}</p></blockquote>` : ''
  const hidden = (name: string, value: string) =>
    `<input type="hidden" name="${name}" value="${escapeAttr(value)}">`
  const body = `<header class="listing-head"><h1>${escapeHtml(s.clipHeading)}</h1></header>
<div class="prose">${kept}</div>${source}
<form class="clip-form" method="post" action="/notes/clip">
${hidden('url', f.url)}${hidden('quote', f.quote)}
<label>${escapeHtml(s.clipTitleLabel)}<input type="text" name="title" value="${escapeAttr(f.title)}" maxlength="300"></label>
<label>${escapeHtml(s.clipNoteLabel)}<textarea name="note" rows="5" maxlength="${MAX_NOTE}">${escapeHtml(f.note)}</textarea></label>
<div class="clip-status">
<label><input type="radio" name="status" value="draft"${f.status === 'draft' ? ' checked' : ''}> ${escapeHtml(s.clipPrivate)}</label>
<label><input type="radio" name="status" value="published"${f.status === 'published' ? ' checked' : ''}> ${escapeHtml(s.clipPublic)}</label>
</div>
<button type="submit">${escapeHtml(s.clipSave)}</button>
</form>`
  return c.html(await page(`${s.clipHeading} · ${settings.title}`, body), 200, { 'x-robots-tag': 'noindex' })
}

/** The POST half: owner-gated like every write, and it answers with a redirect to the page. */
export function clipRoutes() {
  const router = ownerRouter()
  router.post('/notes/clip', async (c) => {
    const form = await c.req.parseBody()
    const str = (k: string) => (typeof form[k] === 'string' ? (form[k] as string) : undefined)
    const f = fields({ url: str('url'), title: str('title'), quote: str('quote'), note: str('note'), status: str('status') })
    if (!f.quote && !f.url && !f.note) return c.redirect('/notes/clip', 303)
    try {
      const meta = await saveNote({
        title: f.title, content: f.note, status: f.status, date: new Date().toISOString(),
        sourceUrl: f.url || undefined, sourceTitle: f.title || undefined, quote: f.quote || undefined,
      })
      clearCache()
      void logActivity('note.create', meta.title || meta.slug)
      return c.redirect(`/notes/clip?saved=${encodeURIComponent(meta.slug)}`, 303)
    } catch (error) {
      if (error instanceof SlugConflictError) {
        // The name is taken: keep it anyway, under a dated name, rather than lose a passage
        // the reader has already left the other page to bring here.
        const meta = await saveNote({
          title: f.title, slug: `clip-${Date.now()}`, content: f.note, status: f.status,
          date: new Date().toISOString(),
          sourceUrl: f.url || undefined, sourceTitle: f.title || undefined, quote: f.quote || undefined,
        })
        clearCache()
        return c.redirect(`/notes/clip?saved=${encodeURIComponent(meta.slug)}`, 303)
      }
      throw error
    }
  })
  return router
}
