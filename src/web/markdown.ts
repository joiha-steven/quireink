// The post as the Markdown its author wrote, for agents.
//
// An agent that wants the text should not have to parse rendered HTML back into prose. The
// frozen tree exposed this at `/api/md/:slug` and rewrote `/:slug` to it in `next.config`
// when the request carried `Accept: text/markdown`. Both entry points are kept, but the
// negotiation happens in the router rather than in a config file, which is the only place
// it can be read next to the route it affects.
//
// Same visibility rules as the HTML page: published pages, and posts that are public and
// not future-dated. A draft is not readable here either.

import type { Context } from 'hono'
import { getPost } from '@/content/posts'
import { getPage } from '@/content/pages'
import { getSettings } from '@/content/settings'
import { formatDate } from '@/i18n/i18n'
import { isPublicallyVisible } from '@/utils'

/** True when the client asked for Markdown specifically, rather than listing it in `*​/*`. */
export function wantsMarkdown(accept: string | undefined): boolean {
  return !!accept && /\btext\/markdown\b/.test(accept)
}

function document(title: string, meta: string, body: string): Response {
  return new Response(`# ${title}\n\n${meta ? `${meta}\n\n` : ''}${body}\n`, {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'cache-control': 'public, max-age=300',
      // The HTML page is the canonical one. Indexing the raw view too would put two URLs
      // with the same words in the index, competing with each other.
      'x-robots-tag': 'noindex',
    },
  })
}

export async function handleMarkdown(c: Context): Promise<Response> {
  // Typed as optional because a bare `Context` does not know the route's shape. Every
  // route that reaches here has the parameter; if one ever does not, 404 is the answer.
  const slug = c.req.param('slug')
  if (!slug) return c.text('Not found', 404)

  const [post, page, settings] = await Promise.all([getPost(slug), getPage(slug), getSettings()])

  if (post && isPublicallyVisible(post.status, post.date)) {
    const parts = [formatDate(post.date, settings.language, settings.timezone)]
    if (post.categories.length) parts.push(post.categories.join(', '))
    return document(post.title, `*${parts.join(' · ')}*`, post.content)
  }
  if (page && page.status === 'published') return document(page.title, '', page.content)
  return c.text('Not found', 404)
}
