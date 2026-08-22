// Cloudflare Turnstile server-side verification. The secret comes from the
// admin-managed integration keys (env of the same name is a fallback). Turnstile
// is only ENFORCED when the toggle is on AND a secret exists (see the comments
// POST route, which checks `getCommentEnv().turnstileConfigured`).

import { getIntegrationKeys } from '@/store/integration-keys'

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

// Verify a widget token with Cloudflare. Returns false on any failure (fail closed).
export async function verifyTurnstile(token: string, ip?: string): Promise<boolean> {
  const { turnstileSecretKey } = await getIntegrationKeys()
  if (!turnstileSecretKey || !token) return false
  try {
    const body = new URLSearchParams({ secret: turnstileSecretKey, response: token })
    if (ip) body.set('remoteip', ip)
    const res = await fetch(SITEVERIFY, { method: 'POST', body })
    const data = (await res.json()) as { success?: boolean }
    return data.success === true
  } catch (error) {
    console.error(`[ERROR] verifyTurnstile: ${(error as Error).message}`)
    return false
  }
}
