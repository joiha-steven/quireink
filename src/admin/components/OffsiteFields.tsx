// Off-server snapshots (Admin → Settings → System). Any S3-compatible bucket — R2, S3,
// MinIO — receives every archive the schedule writes (ADR 0035). The keys are SECRETS,
// so they go to /api/integrations/s3 (server-only integration_keys), never the settings
// form; write-to-set, a blank field leaves the stored value alone. The Test button PUTs
// and deletes one marker object, so a wrong paste is found while the owner is still here
// rather than on the day the machine is gone.
import { useRouter } from '@/admin/router'
import type { ApiResponse } from '@/types'
import { useAdminT } from './I18nProvider'
import { ConnectionCard, type SaveResult } from './ConnectionCard'
import { NOTE_TEXT } from './kit'
import { Input } from '@/admin/ui/Input'
import { useSecretKeys } from './useSecretKeys'

type Keys = {
  s3Endpoint: string; s3Region: string; s3Bucket: string
  s3Prefix: string; s3AccessKeyId: string; s3SecretAccessKey: string
}
const EMPTY: Keys = { s3Endpoint: '', s3Region: '', s3Bucket: '', s3Prefix: '', s3AccessKeyId: '', s3SecretAccessKey: '' }

export function OffsiteCard({ configured, bucket }: { configured: boolean; bucket: string }) {
  const t = useAdminT()
  const router = useRouter()
  const secrets = useSecretKeys('/api/integrations/s3', EMPTY, () => router.refresh())
  const { keys, touched, set, phSet } = secrets

  /**
   * SAVE, THEN REACH THE BUCKET — one press, in that order.
   *
   * They were two buttons and the second was disabled until the first had run, which is an
   * arrangement that teaches nothing: what an owner wants to know is whether the keys they
   * just typed work, and that question needs both halves. The test PUTs and deletes one
   * marker object, so a wrong paste is found while they are still here rather than on the
   * day the machine is gone.
   */
  async function saveAndTest(): Promise<SaveResult> {
    const stored = await secrets.saveResult()
    if (!stored.ok) return stored
    try {
      const res = await fetch('/api/backup/offsite-test', { method: 'POST' })
      const json = (await res.json()) as ApiResponse
      // The transport's own words on failure: a wrong endpoint deserves a name, not "failed".
      return json.success ? { ok: true, tested: true } : { ok: false, error: json.error }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : undefined }
    }
  }

  return (
    <ConnectionCard
      title={t.offsiteTitle}
      connected={configured}
      dirty={touched}
      canTest
      onSave={saveAndTest}
    >
    <div className="space-y-3">
      <p className={NOTE_TEXT}>{t.offsiteHelp}</p>
      <Input label={t.s3Endpoint}
        value={keys.s3Endpoint} onChange={(e) => set('s3Endpoint', e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <Input label={t.s3Bucket} placeholder={bucket || phSet(false)}
          value={keys.s3Bucket} onChange={(e) => set('s3Bucket', e.target.value)} />
        <Input label={t.s3Region}
          value={keys.s3Region} onChange={(e) => set('s3Region', e.target.value)} />
      </div>
      <Input label={t.s3Prefix}
        value={keys.s3Prefix} onChange={(e) => set('s3Prefix', e.target.value)} />
      <Input label={t.s3KeyId} placeholder={phSet(configured)}
        value={keys.s3AccessKeyId} onChange={(e) => set('s3AccessKeyId', e.target.value)} />
      <Input label={t.s3Secret} type="password" placeholder={phSet(configured)}
        value={keys.s3SecretAccessKey} onChange={(e) => set('s3SecretAccessKey', e.target.value)} />
    </div>
    </ConnectionCard>
  )
}
