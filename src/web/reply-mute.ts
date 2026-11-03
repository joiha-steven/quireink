// The two halves of a commenter's "stop emailing me about replies" (`comments/reply-mute.ts`).
//
// GET asks for a click and POST does it, as the newsletter's unsubscribe does: link scanners and
// mail-client prefetchers follow GETs, and a security appliance that merely looked at an inbox
// must not decide what the reader is sent. Both answer with a page, since they open from an email.
import type { Context } from 'hono'
import { muteFromToken } from '@/comments/reply-mute'
import { confirmPage, resultPage } from '@/news/newsletter-html'
import { getSettings, resolveSiteUrl } from '@/content/settings'
import { t } from '@/i18n/i18n'

export async function handleReplyMuteGet(c: Context): Promise<Response> {
  const token = c.req.query('t') ?? ''
  const tx = t((await getSettings()).language)
  return confirmPage(tx.replyMuteLink, tx.replyMuteConfirm, tx.replyMuteBtn, `/api/comments/mute?t=${encodeURIComponent(token)}`)
}

export async function handleReplyMutePost(c: Context): Promise<Response> {
  const settings = await getSettings()
  const tx = t(settings.language)
  if (muteFromToken(c.req.query('t') ?? '')) {
    return resultPage(tx.replyMuteTitle, tx.replyMuteBody, resolveSiteUrl(settings), settings.title)
  }
  const page = resultPage(tx.nlLinkInvalid, '', resolveSiteUrl(settings), settings.title)
  return new Response(page.body, { status: 404, headers: page.headers })
}
