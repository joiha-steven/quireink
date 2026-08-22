// Server-only: which comment integrations are usable right now. Both Turnstile and Google
// come from the admin-managed `integration_keys` table (env fallback). A toggle in settings
// is only EFFECTIVE when its keys exist — the admin UI flags the rest. The Turnstile SITE
// key is public (it renders in the widget), so it's safe to send to the client; no secret
// is ever exposed.

import { getIntegrationStatus } from '@/store/integration-keys'

export type CommentEnv = {
  turnstileConfigured: boolean // a Turnstile secret exists (verification can run)
  googleConfigured: boolean // a Google client id AND secret exist (the flow can complete)
  turnstileSiteKey: string // public site key for the widget ('' = none)
}

export async function getCommentEnv(): Promise<CommentEnv> {
  const s = await getIntegrationStatus()
  return {
    turnstileConfigured: s.turnstileConfigured,
    googleConfigured: s.googleConfigured,
    turnstileSiteKey: s.turnstileSiteKey,
  }
}
