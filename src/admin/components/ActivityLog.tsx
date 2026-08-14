// Admin activity log view: a transparent table of recent admin mutations.
// Server passes the entries + whether logging is currently enabled.
import { useState } from 'react'
import { useRouter } from '@/admin/router'
import type { ApiResponse } from '@/types'
import type { ActivityEntry } from '@/server/activity'
import { formatDateTimeShort } from '@/utils'
import { useToast } from '@/admin/ui/Toast'
import { PageHeader, READING, TableFrame, THEAD } from './kit'
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

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.logTitle}
        actions={
          entries.length > 0 ? (
            <button
              type="button"
              onClick={clear}
              disabled={busy}
              className="text-sm text-neutral-500 transition-colors hover:text-neutral-900 disabled:opacity-50 dark:text-neutral-400 dark:hover:text-white"
            >
              {t.logClear}
            </button>
          ) : undefined
        }
      />

      {!enabled && (
        <p className={`${READING} border border-neutral-300 bg-neutral-100 px-4 py-3 text-sm leading-6 text-neutral-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200`}>
          {t.logDisabled}
        </p>
      )}

      {entries.length === 0 ? (
        <p className="text-sm text-neutral-400 dark:text-neutral-500">{t.logEmpty}</p>
      ) : (
        <TableFrame>
            <thead className={THEAD}>
              <tr>
                <th className="px-4 py-2 font-medium">{t.logColTime}</th>
                <th className="px-4 py-2 font-medium">{t.logColAction}</th>
                <th className="hidden px-4 py-2 font-medium sm:table-cell">{t.logColDetail}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-2 whitespace-nowrap text-neutral-500 dark:text-neutral-400">
                    {formatDateTimeShort(e.at)}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        e.action === 'error'
                          ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                          : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200'
                      }`}
                    >
                      {e.action}
                    </span>
                    <span className="ml-2 text-neutral-500 sm:hidden">{e.detail}</span>
                  </td>
                  <td className="hidden px-4 py-2 text-neutral-600 sm:table-cell dark:text-neutral-300">{e.detail}</td>
                </tr>
              ))}
            </tbody>
        </TableFrame>
      )}
    </div>
  )
}
