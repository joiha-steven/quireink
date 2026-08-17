// Admin activity log view: a transparent table of recent admin mutations.
// Server passes the entries + whether logging is currently enabled.
import { useState } from 'react'
import { useRouter } from '@/admin/router'
import type { ApiResponse } from '@/types'
import type { ActivityEntry } from '@/server/activity'
import { formatDateTimeShort } from '@/utils'
import { useToast } from '@/admin/ui/Toast'
import { PageHeader } from './kit'
import { SHEET, SHEET_TOOL, SheetTop } from './sheet'
import { useAdminT } from './I18nProvider'

export function ActivityLog({ entries, enabled }: { entries: ActivityEntry[]; enabled: boolean }) {
  const t = useAdminT()
  const router = useRouter()
  const { notify } = useToast()
  const [busy, setBusy] = useState(false)

  async function clear() {
    if (busy || entries.length === 0) return
    if (!window.confirm(t.logClearConfirm)) return
    setBusy(true)
    try {
      const res = await fetch('/api/activity', { method: 'DELETE' })
      const json = (await res.json()) as ApiResponse
      if (!json.success) throw new Error(json.error)
      notify(t.logCleared)
      router.refresh()
    } catch {
      notify(t.deleteFailed, 'error')
    } finally {
      setBusy(false)
    }
  }

  // ONE SHEET, two newspaper columns (the owner's follow-up on the mock build: "nhật
  // ký, hướng dẫn nên chia đôi giống mấy cái kia"): each entry is a one-line ledger —
  // time, the action as a quiet chip, the detail — and the clear control is the
  // sheet-top's one tool.
  return (
    <div>
      <PageHeader title={t.logTitle} />
      <div className={SHEET}>
        <SheetTop>
          <span className={SHEET_TOOL}>{entries.length.toLocaleString()} · {t.logTitle.toLowerCase()}</span>
          <span className="flex-1" />
          {entries.length > 0 && (
            <button type="button" onClick={clear} disabled={busy} className={SHEET_TOOL}>
              {t.logClear}
            </button>
          )}
        </SheetTop>

        {!enabled && (
          <p className="border-b border-neutral-100 bg-neutral-50 px-5 py-2.5 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-400">
            {t.logDisabled}
          </p>
        )}

        {entries.length === 0 ? (
          <p className="px-5 py-8 text-sm text-neutral-400 dark:text-neutral-500">{t.logEmpty}</p>
        ) : (
          <ul className="paper-cols">
            {entries.map((e) => (
              <li key={e.id} className="flex items-baseline gap-2.5 border-b border-neutral-100 px-5 py-2 text-xs dark:border-neutral-800">
                <span className="whitespace-nowrap tabular-nums text-neutral-400 dark:text-neutral-500">{formatDateTimeShort(e.at)}</span>
                <span
                  className={`whitespace-nowrap rounded-full px-2 py-0.5 ${
                    e.action === 'error'
                      ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                      : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200'
                  }`}
                >
                  {e.action}
                </span>
                <span className="min-w-0 truncate text-neutral-600 dark:text-neutral-300" title={e.detail}>{e.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
