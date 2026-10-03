// The AI describer: writes alt text for an uploaded image, in the site's own language.
//
// Pasting a key in Admin → Settings → AI is the master switch, and "Describe uploaded
// images" beside it is this job's own; both must be on for a single byte to leave the
// machine. The provider plumbing lives in `server/ai-provider.ts` — this file knows only
// the image job: which files qualify, what to ask, and the one rule about the answer:
//
//   `alt IS NULL` guards the write. NULL means "never described"; '' means the owner
//   CLEARED it, and refilling a cleared field would be the machine overruling a person.

import { run } from '@/store/query'
import { getIntegrationKeys } from '@/store/integration-keys'
import { getSettings } from '@/content/settings'
import { logActivity } from '@/server/activity'
import { ask, buildParts, parseText } from '@/server/ai-provider'
import { liveOnly } from '@/store/db'
import { mediaKey } from '@/media/media'
import { bytesOf, sizeOf, type UploadBody } from '@/media/blob'

// Compatibility exports: the provider plumbing moved to `server/ai-provider.ts` on
// 2026-08-23; these keep every existing caller and test honest about where it lives.
export { listModels, parseModels, readListFailure, DEFAULT_MODELS } from '@/server/ai-provider'
export type { ModelChoice, AiListing, ListFailure } from '@/server/ai-provider'

export type AltRequest = { url: string; headers: Record<string, string>; body: string }

/** The image request, via the shared builder. Kept for the tests that pin its shape. */
export function buildRequest(
  provider: string, model: string, key: string, mime: string, b64: string, language: string,
): AltRequest | null {
  return buildParts(provider, model, key, [
    { imageMime: mime, imageB64: b64 },
    { text: prompt(language) },
  ])
}

export function parseAlt(provider: string, json: unknown): string | null {
  return parseText(provider, json, 300)
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', vi: 'Vietnamese', de: 'German', ja: 'Japanese', zh: 'Chinese', ko: 'Korean',
}

export const languageName = (code: string): string => LANGUAGE_NAMES[code] ?? 'English'

const prompt = (language: string): string =>
  `Write alt text for this image in ${languageName(language)}: one factual sentence describing what is visible. `
  + `No "image of", no quotation marks, no trailing period commentary. `
  // Same reason as the excerpt: a screen reader speaks this aloud, and a dash it has to
  // announce is worse than the comma that would have done the job.
  + `Do not use em dashes or en dashes. Answer with the alt text only.`

const DESCRIBABLE = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_BYTES = 8 * 1024 * 1024 // providers cap around here, and a poster is smaller anyway

/**
 * Fire-and-forget entry, called by the upload paths with what they already hold: the bytes, or
 * the request's `File`, which is read only once everything that can decline has declined — on a
 * blog with the describer off, never. Everything that can decline, declines silently BEFORE any
 * network is touched.
 */
export async function describeUpload(path: string, body: UploadBody | Uint8Array, mime: string): Promise<void> {
  try {
    if (!DESCRIBABLE.has(mime) || sizeOf(body) > MAX_BYTES) return
    const keys = await getIntegrationKeys()
    if (!keys.aiProvider || !keys.aiApiKey) return
    const { language, ai } = await getSettings()
    if (!ai.altText) return // the owner's per-job switch (Settings → AI)

    // A view in every case: `Buffer.from(aUint8Array)` would copy it.
    const bytes = body instanceof Uint8Array ? Buffer.from(body.buffer, body.byteOffset, body.byteLength) : Buffer.from(await bytesOf(body))
    const alt = await ask([
      { imageMime: mime, imageB64: bytes.toString('base64') },
      { text: prompt(language) },
    ])
    if (!alt) return

    // `alt is null` and not `coalesce(alt,'') = ''`: an owner who cleared the field said no.
    run(`update media set alt = $alt where path = $path and alt is null and ${liveOnly('media')}`, { alt, path })
    void logActivity('media.upload', `alt: ${path}`)
  } catch (error) {
    console.error(`[ERROR] alt-text: ${(error as Error).message}`)
  }
}

/** The most a hand-written description keeps; the describer stops at 300. */
export const MAX_ALT_CHARS = 500

/**
 * The owner's own words for a picture (2026-09-30). The library had no way to read or change a
 * description by hand: the AI button was the only door, and a wrong one stayed wrong. An empty
 * string is kept as '' — "cleared", which the describer above will not refill.
 */
export function setMediaAlt(url: string, alt: string): boolean {
  const path = mediaKey(url)
  if (!path) return false
  const text = alt.replace(/\s+/g, ' ').trim().slice(0, MAX_ALT_CHARS)
  return run(`update media set alt = ? where path = ? and ${liveOnly('media')}`, text, path).changes > 0
}
