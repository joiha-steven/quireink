// Optional integration secrets (Turnstile comment anti-spam + Cloudflare cache
// purge) — SERVER-ONLY, like backup-state. The owner enters these in Admin →
// Settings; they live in the `integration_keys` table (single row id=1), NEVER in
// settings.data / the client payload. An env var of the same name still works as a
// fallback (DB wins). Never import this from a client-bound payload.

import { clearCache } from '@/server/cache'
import { one, run } from '@/store/query'

export type IntegrationKeys = {
  turnstileSiteKey: string // PUBLIC (rendered in the widget)
  turnstileSecretKey: string // secret
  cloudflareApiToken: string // secret — Zone.Cache Purge token
  cloudflareZoneId: string // not secret — the zone to purge
  googleClientId: string // PUBLIC (it travels in the authorize URL the reader follows)
  googleClientSecret: string // secret
}

// What the admin UI may see: which secrets are set + the PUBLIC values (Turnstile
// site key, Cloudflare zone id). Secrets themselves are never sent back.
export type IntegrationStatus = {
  turnstileConfigured: boolean
  turnstileSiteKey: string
  cloudflareConfigured: boolean
  cloudflareZoneId: string
  googleConfigured: boolean
}

type Row = {
  turnstile_site_key: string | null
  turnstile_secret_key: string | null
  cloudflare_api_token: string | null
  cloudflare_zone_id: string | null
  google_client_id: string | null
  google_client_secret: string | null
}

const env = (k: string) => process.env[k] ?? ''

function readRow(): Row | null {
  return one<Row>(
    `select turnstile_site_key, turnstile_secret_key, cloudflare_api_token, cloudflare_zone_id,
            google_client_id, google_client_secret
       from integration_keys where id = 1`,
  )
}

// Resolve each key: stored value wins, else the same-named env var (back-compat).
export async function getIntegrationKeys(): Promise<IntegrationKeys> {
  let row: Row | null = null
  try {
    row = readRow()
  } catch (error) {
    console.error(`[ERROR] integration-keys.getIntegrationKeys: ${(error as Error).message}`)
  }
  return {
    turnstileSiteKey: row?.turnstile_site_key || env('TURNSTILE_SITE_KEY'),
    turnstileSecretKey: row?.turnstile_secret_key || env('TURNSTILE_SECRET_KEY'),
    cloudflareApiToken: row?.cloudflare_api_token || env('CLOUDFLARE_API_TOKEN'),
    cloudflareZoneId: row?.cloudflare_zone_id || env('CLOUDFLARE_ZONE_ID'),
    // The env names the frozen tree used, so an instance that still has them set keeps
    // working without the owner re-pasting anything.
    googleClientId: row?.google_client_id || env('AUTH_GOOGLE_ID'),
    googleClientSecret: row?.google_client_secret || env('AUTH_GOOGLE_SECRET'),
  }
}

// Client-safe view: configured flags + the public values, never the secrets.
export async function getIntegrationStatus(): Promise<IntegrationStatus> {
  const k = await getIntegrationKeys()
  return {
    turnstileConfigured: !!k.turnstileSecretKey,
    turnstileSiteKey: k.turnstileSiteKey,
    cloudflareConfigured: !!(k.cloudflareApiToken && k.cloudflareZoneId),
    cloudflareZoneId: k.cloudflareZoneId,
    // BOTH halves. An id without a secret cannot complete the code exchange, so a flow
    // offered on that basis would fail after the reader has already left for Google.
    googleConfigured: !!(k.googleClientId && k.googleClientSecret),
  }
}

// Save provided keys. `undefined` leaves a field untouched; '' clears it (back to
// the env fallback, if any). Trims input.
//
// PostgREST's upsert took a partial payload and updated exactly those columns. SQLite has
// no partial upsert without assembling the SET clause from the payload, and assembling SQL
// is the one thing this codebase does not do. So the merge happens here and the statement
// stays a literal that writes all four columns. Read-modify-write is safe for the same
// reason it was in the frozen tree: one owner, one settings form, no other writer.
export async function saveIntegrationKeys(input: Partial<IntegrationKeys>): Promise<void> {
  const current = readRow()
  const pick = (next: string | undefined, stored: string | null | undefined): string | null =>
    next === undefined ? (stored ?? null) : next.trim() || null

  run(
    `insert into integration_keys (id, turnstile_site_key, turnstile_secret_key,
                                   cloudflare_api_token, cloudflare_zone_id,
                                   google_client_id, google_client_secret)
     values (1, $siteKey, $secretKey, $apiToken, $zoneId, $googleId, $googleSecret)
     on conflict(id) do update set
       turnstile_site_key   = excluded.turnstile_site_key,
       turnstile_secret_key = excluded.turnstile_secret_key,
       cloudflare_api_token = excluded.cloudflare_api_token,
       cloudflare_zone_id   = excluded.cloudflare_zone_id,
       google_client_id     = excluded.google_client_id,
       google_client_secret = excluded.google_client_secret`,
    {
      siteKey: pick(input.turnstileSiteKey, current?.turnstile_site_key),
      secretKey: pick(input.turnstileSecretKey, current?.turnstile_secret_key),
      apiToken: pick(input.cloudflareApiToken, current?.cloudflare_api_token),
      zoneId: pick(input.cloudflareZoneId, current?.cloudflare_zone_id),
      googleId: pick(input.googleClientId, current?.google_client_id),
      googleSecret: pick(input.googleClientSecret, current?.google_client_secret),
    },
  )
  clearCache()
}
