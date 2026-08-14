// Cloudflare cache-purge credentials (Admin → Settings → Integrations). The API token
// is a SECRET, so it has its OWN API (/api/integrations/cloudflare -> server-only
// `integration_keys` table), NOT the settings form. Write-to-set: a blank field leaves
// the stored value untouched. Once set, the app purges the whole zone on every content
// change + "Clear all cache" (see lib/cdn.ts + lib/revalidate.ts), so an edit is live
// with no manual purge.
import { useState } from 'react'
import { useRouter } from '@/admin/router'
import type { ApiResponse } from '@/types'
import { Button } from '@/admin/ui/Button'
import { useToast } from '@/admin/ui/Toast'
import { useAdminT } from './I18nProvider'
import { NOTE_TEXT } from './kit'

const INPUT =
  'w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100'
const LINK = 'https://dash.cloudflare.com/profile/api-tokens'

type Keys = { cloudflareZoneId: string; cloudflareApiToken: string }
const EMPTY: Keys = { cloudflareZoneId: '', cloudflareApiToken: '' }

export function CloudflareFields({ configured, zoneId }: { configured: boolean; zoneId: string }) {
  const t = useAdminT()
  const router = useRouter()
  const { notify } = useToast()
  const [keys, setKeys] = useState<Keys>(EMPTY)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof Keys, v: string) => setKeys((p) => ({ ...p, [k]: v }))
  // A placeholder hinting the field is already configured (so blank = keep).
  const ph = (has: boolean, label: string) => (has ? `${label} · ${t.commentsKeySet}` : label)

  async function save() {
    setBusy(true)
    // Send only non-empty fields, so a blank input never clears a stored value.
    const body: Partial<Keys> = {}
    for (const k of Object.keys(keys) as (keyof Keys)[]) if (keys[k].trim()) body[k] = keys[k].trim()
    try {
      const res = await fetch('/api/integrations/cloudflare', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = (await res.json()) as ApiResponse
      if (!json.success) throw new Error(json.error)
      setKeys(EMPTY)
      notify(t.commentsKeySaved)
      router.refresh() // re-render so the "· saved" hint reflects the new state at once

    } catch {
      notify(t.deleteFailed, 'error')
    } finally {
      setBusy(false)
    }
  }

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
      <Button type="button" onClick={save} disabled={busy}>
        {t.commentsKeySave}
      </Button>
    </div>
  )
}
