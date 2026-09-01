// Optional integration secrets (Turnstile comment anti-spam + Cloudflare cache
// purge) — SERVER-ONLY, like backup-state. The owner enters these in Admin →
// Settings; they live in the `integration_keys` table (single row id=1), NEVER in
// settings.data / the client payload. An env var of the same name still works as a
// fallback (DB wins). Never import this from a client-bound payload.

import { clearCache } from '@/server/cache'
import { one, run } from '@/store/query'
import { seesImages } from '@/server/ai-capabilities'

export type IntegrationKeys = {
  turnstileSiteKey: string // PUBLIC (rendered in the widget)
  turnstileSecretKey: string // secret
  cloudflareApiToken: string // secret — Zone.Cache Purge token
  cloudflareZoneId: string // not secret — the zone to purge
  purgeWebhookUrl: string // secret — any other CDN's purge endpoint, token usually in the URL
  s3Endpoint: string // not secret — '' = AWS; R2/MinIO paste theirs
  s3Region: string // not secret — '' = auto (R2's own word for it)
  s3Bucket: string // not secret
  s3Prefix: string // not secret — folder inside a shared bucket; '' = the root
  s3AccessKeyId: string // paired with the secret below
  s3SecretAccessKey: string // secret
  googleClientId: string // PUBLIC (it travels in the authorize URL the reader follows)
  googleClientSecret: string // secret
  aiProvider: string // one of AI_PROVIDERS, or '' for off — not secret
  aiApiKey: string // secret
  aiModel: string // '' = the provider's default in media/alt-text.ts — not secret
}

// What the admin UI may see: which secrets are set + the PUBLIC values (Turnstile
// site key, Cloudflare zone id). Secrets themselves are never sent back.
export type IntegrationStatus = {
  turnstileConfigured: boolean
  turnstileSiteKey: string
  cloudflareConfigured: boolean
  cloudflareZoneId: string
  purgeWebhookConfigured: boolean
  offsiteConfigured: boolean
  s3Bucket: string
  googleConfigured: boolean
  aiConfigured: boolean
  aiProvider: string
  aiModel: string
  /** False for a text-only MODEL: the alt-text job is the one thing it cannot do. */
  aiSeesImages: boolean
}

type Row = {
  turnstile_site_key: string | null
  turnstile_secret_key: string | null
  cloudflare_api_token: string | null
  cloudflare_zone_id: string | null
  purge_webhook_url: string | null
  s3_endpoint: string | null
  s3_region: string | null
  s3_bucket: string | null
  s3_prefix: string | null
  s3_access_key_id: string | null
  s3_secret_access_key: string | null
  google_client_id: string | null
  google_client_secret: string | null
  ai_provider: string | null
  ai_api_key: string | null
  ai_model: string | null
}

const env = (k: string) => process.env[k] ?? ''

function readRow(): Row | null {
  return one<Row>(
    `select turnstile_site_key, turnstile_secret_key, cloudflare_api_token, cloudflare_zone_id,
            purge_webhook_url, s3_endpoint, s3_region, s3_bucket, s3_prefix,
            s3_access_key_id, s3_secret_access_key,
            google_client_id, google_client_secret,
            ai_provider, ai_api_key, ai_model
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
    purgeWebhookUrl: row?.purge_webhook_url || env('PURGE_WEBHOOK_URL'),
    s3Endpoint: row?.s3_endpoint || env('S3_ENDPOINT'),
    s3Region: row?.s3_region || env('S3_REGION'),
    s3Bucket: row?.s3_bucket || env('S3_BUCKET'),
    s3Prefix: row?.s3_prefix || env('S3_PREFIX'),
    s3AccessKeyId: row?.s3_access_key_id || env('S3_ACCESS_KEY_ID'),
    s3SecretAccessKey: row?.s3_secret_access_key || env('S3_SECRET_ACCESS_KEY'),
    // The env names the frozen tree used, so an instance that still has them set keeps
    // working without the owner re-pasting anything.
    googleClientId: row?.google_client_id || env('AUTH_GOOGLE_ID'),
    googleClientSecret: row?.google_client_secret || env('AUTH_GOOGLE_SECRET'),
    aiProvider: row?.ai_provider || env('AI_PROVIDER'),
    aiApiKey: row?.ai_api_key || env('AI_API_KEY'),
    aiModel: row?.ai_model || env('AI_MODEL'),
  }
}

/**
 * Is Cloudflare actually in front of this install?
 *
 * The answer decides whether `CF-Connecting-IP` may be believed, so it is a security question
 * rather than a convenience one. A default install has Caddy in front and no Cloudflare
 * anywhere, and Caddy forwards an unknown header untouched: measured through a real Caddy 2,
 * 45 requests against a 30-per-minute cap with a different made-up `CF-Connecting-IP` on each
 * one were refused **zero** times, where the same 45 without the header were refused 16. Only
 * Cloudflare overwrites that header, which is what makes it trustworthy behind Cloudflare and
 * a free pass behind anything else.
 *
 * The same two keys as `cloudflareConfigured`, because they are what an owner fills in when
 * they put the zone in front of the blog. Turning the integration on in the admin is what
 * turns this on, which is the whole switch.
 *
 * CACHED, and that is the reason this is not just a call to `getIntegrationStatus`: it is
 * asked on every rate-limited request and on every analytics write, and neither can afford a
 * row read. `saveIntegrationKeys` forgets it, which is the only moment the answer can change.
 */
let inFront: boolean | null = null

export function cloudflareInFront(): boolean {
  if (inFront === null) {
    // The row read is the fragile half and the env is the fallback, so the catch goes around
    // the read alone — exactly as `getIntegrationKeys` does it. Wrapping both meant a missing
    // table answered `false` for an install that had said so in its environment.
    let row: Row | null = null
    try {
      row = readRow()
    } catch (error) {
      console.error(`[ERROR] integration-keys.cloudflareInFront: ${(error as Error).message}`)
    }
    inFront = !!((row?.cloudflare_api_token || env('CLOUDFLARE_API_TOKEN'))
      && (row?.cloudflare_zone_id || env('CLOUDFLARE_ZONE_ID')))
  }
  return inFront
}

/** Invalidation, and the seam a test uses to change the answer between cases. */
export function forgetCloudflareInFront(): void {
  inFront = null
}

// Client-safe view: configured flags + the public values, never the secrets.
export async function getIntegrationStatus(): Promise<IntegrationStatus> {
  const k = await getIntegrationKeys()
  return {
    turnstileConfigured: !!k.turnstileSecretKey,
    turnstileSiteKey: k.turnstileSiteKey,
    cloudflareConfigured: !!(k.cloudflareApiToken && k.cloudflareZoneId),
    cloudflareZoneId: k.cloudflareZoneId,
    purgeWebhookConfigured: !!k.purgeWebhookUrl,
    // All three, because a bucket with no keys (or keys with no bucket) uploads nothing —
    // same reasoning as Google below. The endpoint is optional: empty means AWS.
    offsiteConfigured: !!(k.s3Bucket && k.s3AccessKeyId && k.s3SecretAccessKey),
    s3Bucket: k.s3Bucket,
    // BOTH halves. An id without a secret cannot complete the code exchange, so a flow
    // offered on that basis would fail after the reader has already left for Google.
    googleConfigured: !!(k.googleClientId && k.googleClientSecret),
    // Both halves, like Google above: a provider without a key describes nothing.
    aiConfigured: !!(k.aiProvider && k.aiApiKey),
    aiProvider: k.aiProvider,
    aiModel: k.aiModel,
    // The stored model, or the one the job would fall back to — the same resolution `ask()`
    // does, so the switch the owner sees matches the request that would actually be built.
    aiSeesImages: seesImages(k.aiProvider, k.aiModel),
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
                                   cloudflare_api_token, cloudflare_zone_id, purge_webhook_url,
                                   s3_endpoint, s3_region, s3_bucket, s3_prefix,
                                   s3_access_key_id, s3_secret_access_key,
                                   google_client_id, google_client_secret,
                                   ai_provider, ai_api_key, ai_model)
     values (1, $siteKey, $secretKey, $apiToken, $zoneId, $purgeHook,
             $s3Endpoint, $s3Region, $s3Bucket, $s3Prefix, $s3KeyId, $s3Secret,
             $googleId, $googleSecret, $aiProvider, $aiApiKey, $aiModel)
     on conflict(id) do update set
       turnstile_site_key   = excluded.turnstile_site_key,
       turnstile_secret_key = excluded.turnstile_secret_key,
       cloudflare_api_token = excluded.cloudflare_api_token,
       cloudflare_zone_id   = excluded.cloudflare_zone_id,
       purge_webhook_url    = excluded.purge_webhook_url,
       s3_endpoint          = excluded.s3_endpoint,
       s3_region            = excluded.s3_region,
       s3_bucket            = excluded.s3_bucket,
       s3_prefix            = excluded.s3_prefix,
       s3_access_key_id     = excluded.s3_access_key_id,
       s3_secret_access_key = excluded.s3_secret_access_key,
       google_client_id     = excluded.google_client_id,
       google_client_secret = excluded.google_client_secret,
       ai_provider          = excluded.ai_provider,
       ai_api_key           = excluded.ai_api_key,
       ai_model             = excluded.ai_model`,
    {
      siteKey: pick(input.turnstileSiteKey, current?.turnstile_site_key),
      secretKey: pick(input.turnstileSecretKey, current?.turnstile_secret_key),
      apiToken: pick(input.cloudflareApiToken, current?.cloudflare_api_token),
      zoneId: pick(input.cloudflareZoneId, current?.cloudflare_zone_id),
      purgeHook: pick(input.purgeWebhookUrl, current?.purge_webhook_url),
      s3Endpoint: pick(input.s3Endpoint, current?.s3_endpoint),
      s3Region: pick(input.s3Region, current?.s3_region),
      s3Bucket: pick(input.s3Bucket, current?.s3_bucket),
      s3Prefix: pick(input.s3Prefix, current?.s3_prefix),
      s3KeyId: pick(input.s3AccessKeyId, current?.s3_access_key_id),
      s3Secret: pick(input.s3SecretAccessKey, current?.s3_secret_access_key),
      googleId: pick(input.googleClientId, current?.google_client_id),
      googleSecret: pick(input.googleClientSecret, current?.google_client_secret),
      aiProvider: pick(input.aiProvider, current?.ai_provider),
      aiApiKey: pick(input.aiApiKey, current?.ai_api_key),
      aiModel: pick(input.aiModel, current?.ai_model),
    },
  )
  // The zone keys may have just arrived or just gone, and `clientIp` reads the answer from a
  // module variable rather than from this table.
  forgetCloudflareInFront()
  clearCache()
}
