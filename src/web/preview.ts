// GET /preview/:slug?key= — a draft, rendered for whoever holds the token.
//
// Kept off `/{slug}` on purpose: the public route then only ever has to know about
// published content, and there is no branch in it that could be reached without a token.
// The key is an HMAC of the slug (`content/preview.ts`), so a preview link cannot be
// guessed from the slug and cannot be edited into a link to a different draft.
//
// Never indexed, never cached.

import type { Context } from 'hono'
import { getPost } from '@/content/posts'
import { getPage } from '@/content/pages'
import { getSettings } from '@/content/settings'
import { verifyPreview } from '@/content/preview'
import { formatDate, t } from '@/i18n/i18n'
import { renderPostContent } from '@/render/post-content'
import { renderDocument, pageStyles } from '@/web/layout'
import { PUBLIC_SHEET } from '@/web/assets'

// The canonical pair rather than a private three-replacement copy, for the reason written out
// in `web/search-page.ts`: the copy did not escape a quote and line 34 puts a value in an
// attribute. Nothing reaches that one but an ISO date, so it was not exploitable here. It was
// the same wrong shape, which is what the next person copies.
import { escapeAttr, escapeHtml } from '@/utils'

export async function handlePreview(c: Context): Promise<Response> {
  // Typed as optional because a bare `Context` does not know the route's shape.
  const slug = c.req.param('slug')
  if (!slug || !verifyPreview(slug, c.req.query('key'))) return c.text('Not found', 404)

  const [post, page, settings] = await Promise.all([getPost(slug), getPage(slug), getSettings()])
  const entry = post ?? page
  if (!entry) return c.text('Not found', 404)

  const body = await renderPostContent({ markdown: entry.content })
  const meta = post
    ? `<p class="meta"><time datetime="${escapeAttr(post.date)}">${
        escapeHtml(formatDate(post.date, settings.language, settings.timezone))}</time></p>`
    : ''

  const html = renderDocument(
    settings,
    { title: `${entry.title} · ${settings.title}`, stylesheet: PUBLIC_SHEET },
    pageStyles(settings),
    `<div class="wrap">
<article>
<p class="preview-note">${escapeHtml(t(settings.language).previewNotice)}</p>
<h1>${escapeHtml(entry.title)}</h1>
${meta}
<div class="prose">${body}</div>
</article>
</div>`,
  )

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Two separate jobs. `noindex` keeps the draft out of search results; `no-store`
      // keeps it out of any shared cache between here and the reader, which matters
      // because the whole point of this route is content that is not published yet.
      'x-robots-tag': 'noindex, nofollow',
      'cache-control': 'no-store',
    },
  })
}
