// The backup panel: the copy the owner takes away, and the copies the server keeps.
//
// Quire Ink 2.0 does not back up to Google Drive (parity exception 1), which deleted ~730 lines
// of OAuth, token refresh and folder bookkeeping. For a while afterwards the schedule and
// retention fields stayed here pointing at a destination that no longer existed, so this
// panel offered a setting that did nothing. It now drives snapshots written to a directory
// on this machine — see `src/server/backup.ts` for what that is and is not.

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/admin/ui/Button'
import { Input } from '@/admin/ui/Input'
import { ToggleField } from '@/admin/ui/Switch'
import { useToast } from '@/admin/ui/Toast'
import { useAdminT } from './I18nProvider'
import { NOTE, NOTE_TEXT, PANEL_LIST } from './kit'
import type { ApiResponse, BackupSettings } from '@/types'

type Snapshot = { name: string; size: number; createdAt: string }
type ListPayload = { snapshots: Snapshot[]; lastRunAt: string | null }

/** A number field that tolerates being emptied while it is being retyped. */
function Count({
  label, value, min, max, onChange,
}: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <Input
      label={label}
      type="number"
      min={min}
      max={max}
      value={value}
      onChange={(e) => {
        const n = Number(e.target.value)
        if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, Math.round(n))))
      }}
    />
  )
}

export function ExportFields({
  backups,
  onChange,
}: {
  backups: BackupSettings
  onChange: (b: BackupSettings) => void
}) {
  const t = useAdminT()
  const { notify } = useToast()
  const [busy, setBusy] = useState<'export' | 'run' | null>(null)
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/backup/list')
      const json = (await res.json()) as ApiResponse<ListPayload>
      if (json.success && json.data) setSnapshots(json.data.snapshots)
    } catch {
      // The list is informational. A failure here should not colour the whole panel.
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  /**
   * A blob, not a plain link: every one of these routes is owner-gated, so the file has to
   * be fetched with the session's cookies and handed to the browser as a download after.
   */
  async function download(url: string, fallback: string): Promise<void> {
    const res = await fetch(url)
    if (!res.ok) throw new Error(String(res.status))
    const objectUrl = URL.createObjectURL(await res.blob())
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = res.headers.get('content-disposition')?.match(/filename="(.+)"/)?.[1] ?? fallback
    a.click()
    URL.revokeObjectURL(objectUrl)
  }

  async function exportNow(): Promise<void> {
    setBusy('export')
    try {
      await download('/api/backup/export', 'quire-archive.tar.gz')
      notify(t.backupToastOk)
    } catch {
      notify(t.backupToastFail, 'error')
    } finally {
      setBusy(null)
    }
  }

  async function runNow(): Promise<void> {
    setBusy('run')
    try {
      const res = await fetch('/api/backup/run', { method: 'POST' })
      const json = (await res.json()) as ApiResponse
      if (!json.success) throw new Error(json.error)
      notify(t.backupToastOk)
      await refresh()
    } catch {
      notify(t.backupToastFail, 'error')
    } finally {
      setBusy(null)
    }
  }

  async function remove(name: string): Promise<void> {
    if (!confirm(t.backupDeleteConfirm)) return
    try {
      const res = await fetch('/api/backup/delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!((await res.json()) as ApiResponse).success) throw new Error()
      await refresh()
    } catch {
      notify(t.backupToastFail, 'error')
    }
  }

  const when = (iso: string): string => new Date(iso).toLocaleString()
  const size = (bytes: number): string => `${(bytes / 1024 / 1024).toFixed(1)} MB`

  return (
    <div className="space-y-5">
      <p className={NOTE_TEXT}>{t.exportHint}</p>

      <Button onClick={exportNow} disabled={busy !== null}>
        {busy === 'export' ? t.exportBusy : t.exportNow}
      </Button>

      <div className="space-y-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">
        <div>
          <ToggleField
            label={t.backupAuto}
            checked={backups.enabled}
            onChange={(enabled) => onChange({ ...backups, enabled })}
          />
          <p className={NOTE}>{t.backupAutoDesc}</p>
        </div>

        {backups.enabled && (
          <div className="grid grid-cols-2 gap-3">
            <Count
              label={t.backupIntervalLabel}
              value={backups.intervalDays}
              min={1}
              max={30}
              onChange={(intervalDays) => onChange({ ...backups, intervalDays })}
            />
            <Count
              label={t.backupKeepLabel}
              value={backups.keep}
              min={1}
              max={30}
              onChange={(keep) => onChange({ ...backups, keep })}
            />
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={runNow} disabled={busy !== null}>
            {busy === 'run' ? t.exportBusy : t.backupNow}
          </Button>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            {`${t.backupLastRun}: ${snapshots[0] ? when(snapshots[0].createdAt) : t.backupNever}`}
          </span>
        </div>

        {snapshots.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{t.backupNone}</p>
        ) : (
          <ul className={PANEL_LIST}>
            {snapshots.map((s) => (
              <li key={s.name} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0 truncate">
                  {when(s.createdAt)}
                  <span className="ml-2 text-neutral-500 dark:text-neutral-400">{size(s.size)}</span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <button
                    type="button"
                    className="underline hover:text-neutral-900 dark:hover:text-white"
                    onClick={() => { void download(`/api/backup/download?name=${encodeURIComponent(s.name)}`, s.name) }}
                  >
                    {t.download}
                  </button>
                  <button
                    type="button"
                    className="underline hover:text-neutral-900 dark:hover:text-white"
                    onClick={() => { void remove(s.name) }}
                  >
                    {t.delete}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <p className={NOTE_TEXT}>{t.exportReplicationNote}</p>
      </div>
    </div>
  )
}
