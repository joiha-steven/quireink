// Email the parent commenter when someone replies to their comment. Best-effort; never throws,
// degrades when SMTP is unconfigured. Called from the comment POST route on a reply, AFTER the
// spam filter has had its say, and never to an address that asked not to be told
// (`reply-mute.ts`): the address on a hand-written comment is whatever was typed, so this was a
// way to make the blog mail anybody words a stranger chose (2026-11-03).

import { getSmtpConfig, isMailConfigured, sendMail } from '@/news/mail'
import { getSettings } from '@/content/settings'
import { emailBrand } from '@/news/email-brand'
import { replyEmail } from '@/news/newsletter-email'
import { t } from '@/i18n/i18n'
import { one } from '@/store/query'
import { isMuted, muteLink } from '@/comments/reply-mute'

export async function notifyReply(opts: {
  parentId: number
  /** The reply itself: held as spam by the time this runs (`comment-guard.ts`), it is not announced. */
  replyId?: number
  postSlug: string
  replierName: string
  replierEmail: string
  contentHtml: string
}): Promise<void> {
  try {
    const cfg = await getSmtpConfig()
    if (!isMailConfigured(cfg)) return
    const p = one<{ author_email: string | null; deleted_at: number | null }>(
      `select author_email, deleted_at from comments where id = ?`, opts.parentId,
    )
    const email = p?.author_email?.trim()
    if (!email || p?.deleted_at) return
    if (email.toLowerCase() === opts.replierEmail.trim().toLowerCase()) return // don't self-notify
    if (opts.replyId !== undefined) {
      const r = one<{ deleted_at: number | null }>(`select deleted_at from comments where id = ?`, opts.replyId)
      if (!r || r.deleted_at) return
    }
    if (isMuted(email)) return
    const postRow = one<{ title: string }>(`select title from posts where slug = ?`, opts.postSlug)
    const postTitle = postRow?.title ?? opts.postSlug
    const settings = await getSettings()
    const { subject, html } = replyEmail(
      t(settings.language),
      emailBrand(settings),
      opts.postSlug,
      postTitle,
      opts.replierName,
      opts.contentHtml,
      muteLink(emailBrand(settings).base, opts.parentId, email),
    )
    await sendMail({ to: email, subject, html, kind: 'reply' })
  } catch (e) {
    console.error(`[ERROR] notifyReply: ${(e as Error).message}`)
  }
}
