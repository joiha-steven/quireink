// Cloudflare cache-purge credentials (Admin → Settings → Integrations). The API token
// is a SECRET, so it has its OWN API (/api/integrations/cloudflare -> server-only
// `integration_keys` table), NOT the settings form. Write-to-set: a blank field leaves
// the stored value untouched. Once set, the app purges the whole zone on every content
// change + "Clear all cache" (see lib/cdn.ts + lib/revalidate.ts), so an edit is live
// with no manual purge.
import { useRouter } from '@/admin/router'
import { useAdminT } from './I18nProvider'
import { ConnectionCard } from './ConnectionCard'
import { NOTE_TEXT } from './kit'
import { Input } from '@/admin/ui/Input'
import { useSecretKeys } from './useSecretKeys'

const LINK = 'https://dash.cloudflare.com/profile/api-tokens'

type Keys = { cloudflareZoneId: string; cloudflareApiToken: string; purgeWebhookUrl: string }
const EMPTY: Keys = { cloudflareZoneId: '', cloudflareApiToken: '', purgeWebhookUrl: '' }

/**
 * The card, which since ADR 0041 is what owns the save.
 *
 * The button and the lamp moved out of the field list and into `ConnectionCard` — one shape
 * for every card that stores its own keys, so a tab of six says "saved / changed / refused"
 * the same way six times instead of six ways.
 */
export function CloudflareCard(
  { configured, zoneId, webhookConfigured }:
  { configured: boolean; zoneId: string; webhookConfigured: boolean },
) {
  const t = useAdminT()
  const router = useRouter()
  // `router.refresh()` so the "· saved" hint reflects the new state at once.
  const secrets = useSecretKeys('/api/integrations/cloudflare', EMPTY, () => router.refresh())
  const { keys, touched, set, phSet } = secrets

  return (
    <ConnectionCard
      title={t.cardCloudflare}
      connected={configured}
      dirty={touched}
      onSave={secrets.saveResult}
    >
    <div className="space-y-3">
      <p className={NOTE_TEXT}>
        {t.cfHelp}{' '}
        <a href={LINK} target="_blank" rel="noopener" className="font-medium underline hover:text-neutral-900 dark:hover:text-white">
          {t.commentsHelpOpen}
        </a>
      </p>
      <Input
        label={t.cfZoneId}
        placeholder={phSet(!!zoneId)}
        value={keys.cloudflareZoneId}
        onChange={(e) => set('cloudflareZoneId', e.target.value)}
      />
      <Input
        label={t.cfToken}
        type="password"
        placeholder={phSet(configured)}
        value={keys.cloudflareApiToken}
        onChange={(e) => set('cloudflareApiToken', e.target.value)}
      />
      {/* Any other CDN (ADR 0033). One URL this blog POSTs to when it flushes, so an
          install behind Bunny, Fastly or a script in front of nginx gets what a Cloudflare
          install has had. Password-typed because a purge URL usually carries its own token. */}
      <p className={NOTE_TEXT}>{t.cfWebhookHelp}</p>
      <Input
        label={t.cfWebhook}
        type="password"
        placeholder={phSet(webhookConfigured)}
        value={keys.purgeWebhookUrl}
        onChange={(e) => set('purgeWebhookUrl', e.target.value)}
      />
    </div>
    </ConnectionCard>
  )
}
