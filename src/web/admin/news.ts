// The newsletter admin, comment moderation, and the two integration-key forms.
//
// Ported from `src/app/api/{mail,mail/test,broadcast,subscribers,comments,integrations}`.
//
// The rule that governs this whole file, from the frozen tree and unchanged: NOTHING is
// emailed automatically. A scheduled post goes live on time, but the newsletter goes out
// only when the owner presses the button. `/api/broadcast` POST is that button and there
// is no cron path to it.

import type { Context } from 'hono'
import type { IntegrationKeys } from '@/store/integration-keys'
import type { SmtpConfig } from '@/news/mail'
import { getSmtpConfig, isMailConfigured, saveSmtpConfig, sendMail } from '@/news/mail'
import { broadcastEmail, confirmEmail } from '@/news/newsletter-email'
import { emailBrand } from '@/news/email-brand'
import { BroadcastError, broadcastPosts, previewBroadcast } from '@/news/broadcast'
import { listSubscribers, subscriberCounts, deleteSubscriber } from '@/news/subscribers'
import { statsByEmail } from '@/news/newsletter-log'
import { softDeleteComment } from '@/comments/comments'
import { getIntegrationKeys, saveIntegrationKeys } from '@/store/integration-keys'
import { getPublicPosts } from '@/content/posts'
import { getSettings, resolveSiteUrl } from '@/content/settings'
import { t } from '@/i18n/i18n'
import { clearCache } from '@/server/cache'
import { logActivity } from '@/server/activity'
import { fail, json } from '@/web/api'
import { owner, ownerRouter, param } from '@/web/guard'
import { escapeHtml } from '@/utils'

const body = async <T>(c: Context): Promise<Partial<T>> =>
  (await c.req.json().catch(() => ({}))) as Partial<T>

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)

/** An integer path parameter, or null. Used by the two delete-by-id routes. */
function intParam(c: Context, name: string): number | null {
  const n = Number(param(c, name))
  return Number.isInteger(n) ? n : null
}

const KINDS = ['smtp', 'post', 'subscribe'] as const
type TestKind = (typeof KINDS)[number]

/**
 * The token every TEST email carries in its links.
 *
 * Deliberately not a real one. A test send must be indistinguishable from the real thing
 * to look at, and completely inert to click: a genuine token in a test would let clicking
 * the preview confirm or unsubscribe a real address.
 */
const FAKE_TOKEN = 'test-token'

/** `BroadcastError` is a validation failure with a code the admin shows; anything else is a 500. */
const broadcastFailure = (e: unknown): { status: number; code: string } =>
  e instanceof BroadcastError ? { status: 400, code: e.message } : { status: 500, code: 'broadcast_failed' }

export function newsRoutes() {
  const router = ownerRouter()

  // ----- SMTP configuration ---------------------------------------------------

  router.get('/api/mail', async () => {
    const config = await getSmtpConfig()
    // `hasPass`, never `pass`. The password is a secret and this response goes to a
    // browser; the form shows a filled placeholder from this boolean instead.
    return json({
      host: config.host,
      port: config.port,
      user: config.user,
      from: config.from,
      secure: config.secure,
      hasPass: !!config.pass,
      configured: isMailConfigured(config),
    })
  })

  router.post('/api/mail', async (c) => {
    const input = await body<Record<string, unknown>>(c)
    // Field by field, so an absent key LEAVES the stored value alone. A wholesale
    // assignment would wipe the password every time the form is saved without retyping it.
    const patch: Partial<SmtpConfig> = {}
    if (typeof input.host === 'string') patch.host = input.host
    if (typeof input.user === 'string') patch.user = input.user
    if (typeof input.pass === 'string') patch.pass = input.pass
    if (typeof input.from === 'string') patch.from = input.from
    if (typeof input.port === 'number') patch.port = input.port
    if (typeof input.secure === 'boolean') patch.secure = input.secure
    await saveSmtpConfig(patch)
    // The footer shows a subscribe form only when mail is configured.
    clearCache()
    void logActivity('mail.config')
    return json({ ok: true })
  })

  router.post('/api/mail/test', async (c) => {
    const input = await body<{ kind: unknown; to: unknown }>(c)
    const kind = KINDS.find((k) => k === input.kind) as TestKind | undefined
    if (kind === undefined) return fail(c, 'invalid_kind', 400)

    // Default recipient is the signed-in owner. The form can override it to check
    // deliverability against a different provider.
    const to = (str(input.to) ?? '').trim() || owner(c).user.email || ''
    if (!to) return fail(c, 'no_recipient', 400)

    const settings = await getSettings()
    const tx = t(settings.language)
    const base = resolveSiteUrl(settings)
    // The owner's own logo and palette, so a test looks exactly like the real thing.
    const brand = emailBrand(settings)

    let mail: { subject: string; html: string }
    if (kind === 'smtp') {
      mail = {
        subject: `${tx.mailTestSubject} — ${settings.title}`,
        html: `<p>${escapeHtml(tx.mailTestBody)}</p>`,
      }
    } else if (kind === 'subscribe') {
      mail = confirmEmail(tx, brand, `${base}/api/newsletter/confirm?token=${FAKE_TOKEN}`)
    } else {
      // The newest published post is exactly what the next broadcast would carry. On an
      // empty blog a stand-in keeps the layout previewable.
      const [latest] = await getPublicPosts()
      const post = latest ?? { slug: '', title: tx.mailTestSamplePost, excerpt: null }
      mail = broadcastEmail(tx, brand, [post], FAKE_TOKEN)
    }

    const { sent, error } = await sendMail({ to, ...mail, kind: 'test' })
    // 502, not 500: the failure is the upstream mail server's, and the distinction is what
    // tells the owner to check their SMTP settings rather than report a bug.
    if (!sent) return fail(c, error || 'send_failed', 502)
    void logActivity('mail.test', kind)
    return json({ to })
  })

  // ----- the broadcast --------------------------------------------------------

  router.get('/api/broadcast', async (c) => {
    // Repeated `?slug=`. Several posts go out as ONE digest, so the preview has to take
    // the same list the send will, or the preview is of a different email.
    const slugs = c.req.queries('slug')?.filter(Boolean) ?? []
    if (slugs.length === 0) return fail(c, 'missing_slug', 400)
    try {
      return json(await previewBroadcast(slugs))
    } catch (error) {
      const { status, code } = broadcastFailure(error)
      return fail(c, code, status)
    }
  })

  // The button. There is no cron path to this and there must not be one: a newsletter
  // cannot be unsent, so the owner presses it or it does not happen.
  router.post('/api/broadcast', async (c) => {
    const input = await body<{ slugs: unknown; force: unknown }>(c)
    const slugs = Array.isArray(input.slugs)
      ? input.slugs.filter((s): s is string => typeof s === 'string' && s !== '')
      : []
    if (slugs.length === 0) return fail(c, 'missing_slug', 400)
    try {
      const result = await broadcastPosts(slugs, { force: input.force === true })
      void logActivity('newsletter.send', `${slugs.join(',')} — ${result.sent}/${result.recipients}`)
      return json(result)
    } catch (error) {
      const { status, code } = broadcastFailure(error)
      return fail(c, code, status)
    }
  })

  // ----- subscribers ----------------------------------------------------------

  router.get('/api/subscribers', async () => {
    const [subscribers, counts, stats] = await Promise.all([
      listSubscribers(), subscriberCounts(), statsByEmail(),
    ])
    // One rollup read joined in memory, not a query per row.
    return json({
      subscribers: subscribers.map((s) => ({ ...s, stats: stats.get(s.email) ?? null })),
      counts,
    })
  })

  router.delete('/api/subscribers/:id', async (c) => {
    const id = intParam(c, 'id')
    if (id === null) return fail(c, 'Invalid id', 400)
    await deleteSubscriber(id)
    void logActivity('subscriber.delete', String(id))
    return json({ ok: true })
  })

  // ----- comment moderation ---------------------------------------------------

  router.delete('/api/comments/:id', async (c) => {
    const id = intParam(c, 'id')
    if (id === null) return fail(c, 'Invalid comment id', 400)
    // Soft delete (Invariant 6). It lands in the trash and can be restored.
    await softDeleteComment(id)
    void logActivity('comment.delete', String(id))
    return json({ id })
  })

  // ----- integration keys -----------------------------------------------------
  // Two forms, two routes, each writing only its own pair. `saveIntegrationKeys` leaves
  // any field it is not given, so the Turnstile form cannot clear the Cloudflare token.

  router.post('/api/comments/keys', async (c) => {
    const input = await body<IntegrationKeys>(c)
    await saveIntegrationKeys({
      turnstileSiteKey: str(input.turnstileSiteKey),
      turnstileSecretKey: str(input.turnstileSecretKey),
      googleClientId: str(input.googleClientId),
      googleClientSecret: str(input.googleClientSecret),
    })
    // The site key is rendered into the comment form, so a cached page carries the old one.
    // So does the flag that draws the Google button, for the same reason.
    clearCache()
    return json({ saved: true })
  })

  router.post('/api/integrations/cloudflare', async (c) => {
    const input = await body<IntegrationKeys>(c)
    await saveIntegrationKeys({
      cloudflareApiToken: str(input.cloudflareApiToken),
      cloudflareZoneId: str(input.cloudflareZoneId),
      // Any other CDN (ADR 0033). Same write-to-set rule: blank leaves the stored one alone.
      purgeWebhookUrl: str(input.purgeWebhookUrl),
    })
    return json({ saved: true })
  })

  router.post('/api/integrations/ai', async (c) => {
    const input = await body<IntegrationKeys>(c)
    const provider = str(input.aiProvider) ?? ''
    // The one enum the schema also checks; anything else becomes "off" rather than a 500.
    await saveIntegrationKeys({
      aiProvider: ['anthropic', 'openai', 'gemini'].includes(provider) ? provider : '',
      aiApiKey: str(input.aiApiKey),
      aiModel: str(input.aiModel),
    })
    void logActivity('settings.save', 'ai keys')
    return json({ saved: true })
  })

  router.post('/api/integrations/ai/models', async (c) => {
    const input = await body<{ provider: unknown; apiKey: unknown }>(c)
    const provider = str(input.provider) ?? ''
    if (!['anthropic', 'openai', 'gemini'].includes(provider)) return fail(c, 'unknown_provider', 400)
    // A freshly pasted key is tried BEFORE it is saved — that is the whole point: the
    // owner sees the menu appear and knows the key works before committing it.
    const typed = str(input.apiKey)
    const stored = (await getIntegrationKeys()).aiApiKey
    const key = typed || stored
    if (!key) return fail(c, 'no_key', 400)
    const { listModels } = await import('@/media/alt-text')
    const models = await listModels(provider, key).catch(() => null)
    // 502, like the SMTP test: the failure is the provider's (or the key's), not a bug.
    if (models === null) return fail(c, 'model_list_failed', 502)
    return json({ models })
  })

  return router
}
