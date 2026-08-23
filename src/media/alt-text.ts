// The AI describer: writes alt text for an uploaded image, in the site's own language.
//
// Pasting a key in Admin → Settings → Connections IS the opt-in. Without one this module
// answers instantly and no byte ever leaves the machine; with one, a small copy of each
// uploaded image goes to the provider the OWNER chose and paid for — their key, their
// bill, their call. That is the same shape as SMTP: the product ships no service and
// signs nobody up for anything.
//
// Three providers rather than one because the owner asked for a menu, and the differences
// are confined to two pure functions (build the request, read the answer) so a fourth is
// twenty lines. The model is a setting with a per-provider default: model names age, and
// a renamed default must not need a release.
//
// Two quiet rules:
//  - `alt IS NULL` guards the write. NULL means "never described"; '' means the owner
//    CLEARED it, and refilling a cleared field would be the machine overruling a person.
//  - Failure logs one line and stops. A missing network or a bad key must not make an
//    upload look broken — the image is already saved and the alt was always optional.

import { run } from '@/store/query'
import { getIntegrationKeys } from '@/store/integration-keys'
import { getSettings } from '@/content/settings'
import { logActivity } from '@/server/activity'

export const DEFAULT_MODELS: Record<string, string> = {
  anthropic: 'claude-haiku-4-5',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.0-flash',
}

// The languages the product ships; the describer answers in the site's one.
const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', vi: 'Vietnamese', de: 'German', ja: 'Japanese', zh: 'Chinese', ko: 'Korean',
}

const prompt = (language: string): string =>
  `Write alt text for this image in ${LANGUAGE_NAMES[language] ?? 'English'}: one factual sentence describing what is visible. No "image of", no quotation marks, no trailing period commentary. Answer with the alt text only.`

export type AltRequest = { url: string; headers: Record<string, string>; body: string }

/** Pure: the exact HTTP request each provider wants. The key never rides in a URL. */
export function buildRequest(
  provider: string, model: string, key: string, mime: string, b64: string, language: string,
): AltRequest | null {
  const text = prompt(language)
  if (provider === 'anthropic') {
    return {
      url: 'https://api.anthropic.com/v1/messages',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model, max_tokens: 120,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: mime, data: b64 } },
          { type: 'text', text },
        ] }],
      }),
    }
  }
  if (provider === 'openai') {
    return {
      url: 'https://api.openai.com/v1/chat/completions',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model, max_tokens: 120,
        messages: [{ role: 'user', content: [
          { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } },
          { type: 'text', text },
        ] }],
      }),
    }
  }
  if (provider === 'gemini') {
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: [
          { inline_data: { mime_type: mime, data: b64 } },
          { text },
        ] }],
      }),
    }
  }
  return null
}

/** Pure: one sentence out of each provider's answer shape, or null. */
export function parseAlt(provider: string, json: unknown): string | null {
  const j = json as Record<string, any>
  let text: unknown
  if (provider === 'anthropic') text = j?.content?.[0]?.text
  else if (provider === 'openai') text = j?.choices?.[0]?.message?.content
  else if (provider === 'gemini') text = j?.candidates?.[0]?.content?.parts?.[0]?.text
  if (typeof text !== 'string') return null
  const clean = text.trim().replace(/^["'“‘]+|["'’”]+$/g, '').replace(/\s+/g, ' ').slice(0, 300).trim()
  return clean || null
}

const DESCRIBABLE = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_BYTES = 8 * 1024 * 1024 // providers cap around here, and a poster is smaller anyway

/**
 * Fire-and-forget entry, called by `addMediaBatch` with the bytes it already holds.
 * Everything that can decline, declines silently BEFORE any network is touched.
 */
export async function describeUpload(path: string, body: ArrayBuffer, mime: string): Promise<void> {
  try {
    if (!DESCRIBABLE.has(mime) || body.byteLength > MAX_BYTES) return
    const keys = await getIntegrationKeys()
    if (!keys.aiProvider || !keys.aiApiKey) return
    const model = keys.aiModel || DEFAULT_MODELS[keys.aiProvider]
    if (!model) return

    const { language, ai } = await getSettings()
    if (!ai.altText) return // the owner's per-job switch (Settings → AI)
    const req = buildRequest(keys.aiProvider, model, keys.aiApiKey, mime, Buffer.from(body).toString('base64'), language)
    if (!req) return

    const res = await fetch(req.url, {
      method: 'POST', headers: req.headers, body: req.body,
      signal: AbortSignal.timeout(25_000),
    })
    if (!res.ok) {
      console.error(`[ERROR] alt-text: ${keys.aiProvider} answered ${res.status} for ${path}`)
      return
    }
    const alt = parseAlt(keys.aiProvider, await res.json())
    if (!alt) return

    // `alt is null` and not `coalesce(alt,'') = ''`: an owner who cleared the field said no.
    run(`update media set alt = $alt where path = $path and alt is null and deleted_at is null`, { alt, path })
    void logActivity('media.upload', `alt: ${path}`)
  } catch (error) {
    console.error(`[ERROR] alt-text: ${(error as Error).message}`)
  }
}

// ---- the model menu ---------------------------------------------------------------------
// "Paste the key, and the models list themselves" — the admin's AI card calls this via
// /api/integrations/ai/models the moment a key lands, so the owner picks from what their
// account can actually see instead of typing a model id from memory.

export type ModelChoice = { id: string; label: string }

// OpenAI's /v1/models returns every family they have ever shipped; most cannot look at
// an image or are not chat models at all. Names, because capability is not in the API.
const OPENAI_SKIP = /embed|whisper|tts|audio|dall-e|davinci|babbage|moderation|realtime|transcribe|image/

export async function listModels(provider: string, key: string): Promise<ModelChoice[] | null> {
  let url = ''
  let headers: Record<string, string> = {}
  if (provider === 'anthropic') {
    url = 'https://api.anthropic.com/v1/models?limit=100'
    headers = { 'x-api-key': key, 'anthropic-version': '2023-06-01' }
  } else if (provider === 'openai') {
    url = 'https://api.openai.com/v1/models'
    headers = { authorization: `Bearer ${key}` }
  } else if (provider === 'gemini') {
    url = 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=200'
    headers = { 'x-goog-api-key': key }
  } else return null

  const res = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) })
  if (!res.ok) return null
  return parseModels(provider, await res.json())
}

/** Pure: each provider's listing shape into one menu, newest first where the API says. */
export function parseModels(provider: string, json: unknown): ModelChoice[] {
  const j = json as Record<string, any>
  if (provider === 'anthropic') {
    return ((j?.data ?? []) as Record<string, any>[])
      .map((m) => ({ id: String(m.id ?? ''), label: String(m.display_name || m.id || '') }))
      .filter((m) => m.id)
  }
  if (provider === 'openai') {
    return ((j?.data ?? []) as Record<string, any>[])
      .map((m) => String(m.id ?? ''))
      .filter((id) => id && !OPENAI_SKIP.test(id))
      .sort()
      .map((id) => ({ id, label: id }))
  }
  if (provider === 'gemini') {
    return ((j?.models ?? []) as Record<string, any>[])
      .filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
      .map((m) => ({ id: String(m.name ?? '').replace(/^models\//, ''), label: String(m.displayName || m.name || '') }))
      .filter((m) => m.id)
  }
  return []
}
