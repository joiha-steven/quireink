// `POST /webmention`: the public door a mention comes in through (ADR 0046).
//
// Answers 202 the moment the two URLs look right, and verifies in the background — the
// source is fetched through the SSRF guard and must really link to the target. Rate-limited
// per address, because the endpoint is open by protocol and a fetch is what it costs us.

import type { Context } from 'hono'
import { getSettings, resolveSiteUrl } from '@/content/settings'
import { clientIp, rateLimited } from '@/server/rate-limit'
import { receiveWebmention, verifyMention } from '@/server/webmention'

export async function handleWebmention(c: Context): Promise<Response> {
  if (rateLimited(`webmention:${clientIp(c)}`, 20)) return c.text('too many requests', 429)
  const form = await c.req.parseBody().catch(() => ({} as Record<string, unknown>))
  const source = typeof form.source === 'string' ? form.source.trim() : ''
  const target = typeof form.target === 'string' ? form.target.trim() : ''
  const site = resolveSiteUrl(await getSettings())
  const id = receiveWebmention(source, target, site)
  if (id === 'invalid') return c.text('source and target must be http(s) URLs, and target must be on this site', 400)
  void verifyMention(id).catch((e: unknown) => console.error(`[ERROR] webmention.verify: ${(e as Error).message}`))
  return c.text('accepted', 202)
}
