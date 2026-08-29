// Cloudflare cache-purge credentials (Admin → Settings → Integrations). The API token
// is a SECRET, so it has its OWN API (/api/integrations/cloudflare -> server-only
// `integration_keys` table), NOT the settings form. Write-to-set: a blank field leaves
// the stored value untouched. Once set, the app purges the whole zone on every content
// change + "Clear all cache" (see lib/cdn.ts + lib/revalidate.ts), so an edit is live
// with no manual purge.
import { useRouter } from '@/admin/router'
import { Button } from '@/admin/ui/Button'
import { useAdminT } from './I18nProvider'
import { CONTROL, NOTE_TEXT } from './kit'
import { useSecretKeys } from './useSecretKeys'

const INPUT = `${CONTROL} w-full`
const LINK = 'https://dash.cloudflare.com/profile/api-tokens'

type Keys = { cloudflareZoneId: string; cloudflareApiToken: string; purgeWebhookUrl: string }
const EMPTY: Keys = { cloudflareZoneId: '', cloudflareApiToken: '', purgeWebhookUrl: '' }

export function CloudflareFields(
  { configured, zoneId, webhookConfigured }:
  { configured: boolean; zoneId: string; webhookConfigured: boolean },
) {
  const t = useAdminT()
  const router = useRouter()
  // `router.refresh()` so the "· saved" hint reflects the new state at once.
  const { keys, busy, set, ph, save } = useSecretKeys(
    '/api/integrations/cloudflare', EMPTY, () => router.refresh(),
  )

  return (
    <div className="space-y-3">
      <p className={NOTE_TEXT}>
        {t.cfHelp}{' '}
        <a href={LINK} target="_blank" rel="noopener" className="font-medium underline hover:text-neutral-900 dark:hover:text-white">
          {t.commentsHelpOpen}
        </a>
      </p>
      <input
        className={INPUT}
        placeholder={ph(!!zoneId, t.cfZoneId)}
        value={keys.cloudflareZoneId}
        onChange={(e) => set('cloudflareZoneId', e.target.value)}
      />
      <input
        className={INPUT}
        type="password"
        placeholder={ph(configured, t.cfToken)}
        value={keys.cloudflareApiToken}
        onChange={(e) => set('cloudflareApiToken', e.target.value)}
      />
      {/* Any other CDN (ADR 0033). One URL this blog POSTs to when it flushes, so an
          install behind Bunny, Fastly or a script in front of nginx gets what a Cloudflare
          install has had. Password-typed because a purge URL usually carries its own token. */}
      <p className={NOTE_TEXT}>{t.cfWebhookHelp}</p>
      <input
        className={INPUT}
        type="password"
        placeholder={ph(webhookConfigured, t.cfWebhook)}
        value={keys.purgeWebhookUrl}
        onChange={(e) => set('purgeWebhookUrl', e.target.value)}
      />
      <Button type="button" onClick={save} disabled={busy}>
        {t.commentsKeySave}
      </Button>
    </div>
  )
}
