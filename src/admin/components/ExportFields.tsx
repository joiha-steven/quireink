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
import { useConfirm } from '@/admin/ui/ConfirmDialog'
import { useAdminT } from './I18nProvider'
import { Lamp } from '@/admin/ui/Lamp'
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
  const ask = useConfirm()
  const [busy, setBusy] = useState<'export' | 'run' | null>(null)
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/backup/list')
      const json = (await res.json()) as ApiResponse<ListPayload>
      // NARROWED, not merely truthy: the list is read as an array in three places, and a
      // payload that is not the shape this panel knows must leave it empty rather than
      // throw the tab away on `snapshots[0].createdAt` two renders later.
      if (json.success && Array.isArray(json.data?.snapshots)) setSnapshots(json.data.snapshots)
    } catch {
      // The list is informational. A failure here should not colour the whole panel.
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  /**
   * A PLAIN LINK, handed to the browser. Not a fetch, and not a blob.
   *
   * The version this replaces read the whole archive into a blob first, and the comment
   * above it said a blob was necessary because these routes are owner-gated. That was
   * wrong: a same-origin link IS a request with the session cookie on it — `SameSite=Lax`
   * sends it on exactly this kind of navigation — so the gate was never the reason.
   *
   * What the blob cost was the download itself. `/api/backup/export` streams the archive
   * with a declared length precisely so the browser can write it to disk as it arrives and
   * draw a progress bar; pulling it through `fetch().blob()` undid all of that and held the
   * whole file in the tab's memory instead. On a 262 MB archive over a real connection that
   * is minutes with NOTHING on screen — no bar, no bytes, no way to resume — and a browser
   * free to drop the tab's allocation at any point in it. Reported 2026-09-13 by the owner,
   * who had never had reason to press the button before: the first backup he tried to take
   * away was one he could not.
   *
   * And a second bug underneath the first: `URL.revokeObjectURL` ran on the line after
   * `click()`, while the download it had just started was still asynchronous. On a small
   * file the browser usually wins that race. On a large one it does not.
   *
   * Straight to the browser, the download survives the tab, resumes, and shows its progress
   * where every other download on the machine shows it.
   */
  function download(url: string, filename: string): void {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    // IN the document: a detached anchor's click is ignored by some browsers, and this is
    // the one button where "works on mine" is not good enough.
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  function exportNow(): void {
    // No `busy` state and no toast on success: the browser owns the download now, and it
    // reports on it in its own downloads shelf. A spinner here would be this panel claiming
    // to know about something it handed away.
    download('/api/backup/export', 'quire-archive.tar.gz')
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
    const said = await ask({
      title: t.askDeleteBackupTitle,
      body: `${name} — ${t.askDeleteBackupBody}`,
      confirmLabel: t.askDeleteForever,
      cancelLabel: t.askCancel,
      danger: true,
    })
    if (said !== 'confirm') return
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
          {/* THE LAMP SAYS WHETHER THERE IS ONE AT ALL, before the date is read. "Last
              backup: never" and "Last backup: 3 days ago" are the same shape of sentence and
              read the same at a glance, which is the wrong answer for the one line on this
              screen that can mean there is no copy of the blog anywhere. */}
          <span className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
            <Lamp
              state={snapshots[0] ? 'good' : 'attention'}
              title={snapshots[0] ? t.backupLastRun : t.backupNever}
            />
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
                    onClick={() => { download(`/api/backup/download?name=${encodeURIComponent(s.name)}`, s.name) }}
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
