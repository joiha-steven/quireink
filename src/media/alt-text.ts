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

// Compatibility exports: the provider plumbing moved to `server/ai-provider.ts` on
// 2026-08-23; these keep every existing caller and test honest about where it lives.
export { listModels, parseModels, DEFAULT_MODELS } from '@/server/ai-provider'
export type { ModelChoice } from '@/server/ai-provider'

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
  `Write alt text for this image in ${languageName(language)}: one factual sentence describing what is visible. No "image of", no quotation marks, no trailing period commentary. Answer with the alt text only.`

const DESCRIBABLE = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_BYTES = 8 * 1024 * 1024 // providers cap around here, and a poster is smaller anyway

/**
 * Fire-and-forget entry, called by the upload paths with the bytes they already hold.
 * Everything that can decline, declines silently BEFORE any network is touched.
 */
export async function describeUpload(path: string, body: ArrayBuffer, mime: string): Promise<void> {
  try {
    if (!DESCRIBABLE.has(mime) || body.byteLength > MAX_BYTES) return
    const keys = await getIntegrationKeys()
    if (!keys.aiProvider || !keys.aiApiKey) return
    const { language, ai } = await getSettings()
    if (!ai.altText) return // the owner's per-job switch (Settings → AI)

    const alt = await ask([
      { imageMime: mime, imageB64: Buffer.from(body).toString('base64') },
      { text: prompt(language) },
    ])
    if (!alt) return

    // `alt is null` and not `coalesce(alt,'') = ''`: an owner who cleared the field said no.
    run(`update media set alt = $alt where path = $path and alt is null and deleted_at is null`, { alt, path })
    void logActivity('media.upload', `alt: ${path}`)
  } catch (error) {
    console.error(`[ERROR] alt-text: ${(error as Error).message}`)
  }
}
