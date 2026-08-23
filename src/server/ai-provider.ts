// One plug, three sockets: the provider-facing half of every AI job the blog runs.
//
// Split out of `media/alt-text.ts` on 2026-08-23, the day the SECOND job arrived
// (excerpts) — the request shapes and answer shapes are provider facts, not image facts,
// and two copies of "how to talk to Gemini" is one copy too many. Jobs stay where their
// subject lives (alt text with media, excerpts with content, the comment guard with
// comments); this file only knows how to ask a question and read the answer.
//
// The key never rides in a URL, requests carry their own timeout, and every caller is
// expected to have already checked BOTH switches: the stored key (the master) and the
// job's own toggle in Settings → AI.

import { getIntegrationKeys } from '@/store/integration-keys'

export const DEFAULT_MODELS: Record<string, string> = {
  anthropic: 'claude-haiku-4-5',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.0-flash',
}

export type AiRequest = { url: string; headers: Record<string, string>; body: string }

type Part = { text?: string; imageMime?: string; imageB64?: string }

/** Pure: the exact HTTP request each provider wants, for text and image parts alike. */
export function buildParts(provider: string, model: string, key: string, parts: Part[]): AiRequest | null {
  if (provider === 'anthropic') {
    return {
      url: 'https://api.anthropic.com/v1/messages',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model, max_tokens: 300,
        messages: [{ role: 'user', content: parts.map((p) => p.text !== undefined
          ? { type: 'text', text: p.text }
          : { type: 'image', source: { type: 'base64', media_type: p.imageMime, data: p.imageB64 } }) }],
      }),
    }
  }
  if (provider === 'openai') {
    return {
      url: 'https://api.openai.com/v1/chat/completions',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model, max_tokens: 300,
        messages: [{ role: 'user', content: parts.map((p) => p.text !== undefined
          ? { type: 'text', text: p.text }
          : { type: 'image_url', image_url: { url: `data:${p.imageMime};base64,${p.imageB64}` } }) }],
      }),
    }
  }
  if (provider === 'gemini') {
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: parts.map((p) => p.text !== undefined
          ? { text: p.text }
          : { inline_data: { mime_type: p.imageMime, data: p.imageB64 } }) }],
      }),
    }
  }
  return null
}

/** Pure: one string out of each provider's answer shape, cleaned, or null. */
export function parseText(provider: string, json: unknown, cap = 300): string | null {
  const j = json as Record<string, any>
  let text: unknown
  if (provider === 'anthropic') text = j?.content?.[0]?.text
  else if (provider === 'openai') text = j?.choices?.[0]?.message?.content
  else if (provider === 'gemini') text = j?.candidates?.[0]?.content?.parts?.[0]?.text
  if (typeof text !== 'string') return null
  const clean = text.trim().replace(/^["'“‘]+|["'’”]+$/g, '').replace(/\s+/g, ' ').slice(0, cap).trim()
  return clean || null
}

/**
 * The high-level ask: reads the stored key, sends the parts, returns the cleaned answer
 * or null. Null for EVERY kind of no — unconfigured, refused, timed out — because every
 * caller treats all of them the same way: quietly do nothing.
 */
export async function ask(parts: Part[], cap = 300): Promise<string | null> {
  try {
    const keys = await getIntegrationKeys()
    if (!keys.aiProvider || !keys.aiApiKey) return null
    const model = keys.aiModel || DEFAULT_MODELS[keys.aiProvider]
    if (!model) return null
    const req = buildParts(keys.aiProvider, model, keys.aiApiKey, parts)
    if (!req) return null
    const res = await fetch(req.url, {
      method: 'POST', headers: req.headers, body: req.body,
      signal: AbortSignal.timeout(25_000),
    })
    if (!res.ok) {
      console.error(`[ERROR] ai: ${keys.aiProvider} answered ${res.status}`)
      return null
    }
    return parseText(keys.aiProvider, await res.json(), cap)
  } catch (error) {
    console.error(`[ERROR] ai: ${(error as Error).message}`)
    return null
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
