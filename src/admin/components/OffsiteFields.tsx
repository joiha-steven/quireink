// Off-server snapshots (Admin → Settings → System). Any S3-compatible bucket — R2, S3,
// MinIO — receives every archive the schedule writes (ADR 0035). The keys are SECRETS,
// so they go to /api/integrations/s3 (server-only integration_keys), never the settings
// form; write-to-set, a blank field leaves the stored value alone. The Test button PUTs
// and deletes one marker object, so a wrong paste is found while the owner is still here
// rather than on the day the machine is gone.
import { useState } from 'react'
import { useRouter } from '@/admin/router'
import type { ApiResponse } from '@/types'
import { Button } from '@/admin/ui/Button'
import { useToast } from '@/admin/ui/Toast'
import { useAdminT } from './I18nProvider'
import { NOTE_TEXT } from './kit'

const INPUT =
  'w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100'

type Keys = {
  s3Endpoint: string; s3Region: string; s3Bucket: string
  s3Prefix: string; s3AccessKeyId: string; s3SecretAccessKey: string
}
const EMPTY: Keys = { s3Endpoint: '', s3Region: '', s3Bucket: '', s3Prefix: '', s3AccessKeyId: '', s3SecretAccessKey: '' }

export function OffsiteFields({ configured, bucket }: { configured: boolean; bucket: string }) {
  const t = useAdminT()
  const router = useRouter()
  const { notify } = useToast()
  const [keys, setKeys] = useState<Keys>(EMPTY)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof Keys, v: string) => setKeys((p) => ({ ...p, [k]: v }))
  const ph = (has: boolean, label: string) => (has ? `${label} · ${t.commentsKeySet}` : label)

  async function save() {
    setBusy(true)
    const body: Partial<Keys> = {}
    for (const k of Object.keys(keys) as (keyof Keys)[]) if (keys[k].trim()) body[k] = keys[k].trim()
    try {
      const res = await fetch('/api/integrations/s3', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = (await res.json()) as ApiResponse
      if (!json.success) throw new Error(json.error)
      setKeys(EMPTY)
      notify(t.commentsKeySaved)
      router.refresh()
    } catch {
      notify(t.deleteFailed, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function test() {
    setBusy(true)
    try {
      const res = await fetch('/api/backup/offsite-test', { method: 'POST' })
      const json = (await res.json()) as ApiResponse
      // The transport's own words on failure: a wrong endpoint deserves a name, not "failed".
      notify(json.success ? t.offsiteTestOk : json.error || t.deleteFailed, json.success ? undefined : 'error')
    } catch {
      notify(t.deleteFailed, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className={NOTE_TEXT}>{t.offsiteHelp}</p>
      <input className={INPUT} placeholder={t.s3Endpoint}
        value={keys.s3Endpoint} onChange={(e) => set('s3Endpoint', e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <input className={INPUT} placeholder={ph(!!bucket, bucket || t.s3Bucket)}
          value={keys.s3Bucket} onChange={(e) => set('s3Bucket', e.target.value)} />
        <input className={INPUT} placeholder={t.s3Region}
          value={keys.s3Region} onChange={(e) => set('s3Region', e.target.value)} />
      </div>
      <input className={INPUT} placeholder={t.s3Prefix}
        value={keys.s3Prefix} onChange={(e) => set('s3Prefix', e.target.value)} />
      <input className={INPUT} placeholder={ph(configured, t.s3KeyId)}
        value={keys.s3AccessKeyId} onChange={(e) => set('s3AccessKeyId', e.target.value)} />
      <input className={INPUT} type="password" placeholder={ph(configured, t.s3Secret)}
        value={keys.s3SecretAccessKey} onChange={(e) => set('s3SecretAccessKey', e.target.value)} />
      <div className="flex items-center gap-3">
        <Button type="button" onClick={save} disabled={busy}>{t.commentsKeySave}</Button>
        <Button type="button" variant="secondary" onClick={test} disabled={busy || !configured}>
          {t.offsiteTest}
        </Button>
      </div>
    </div>
  )
}
