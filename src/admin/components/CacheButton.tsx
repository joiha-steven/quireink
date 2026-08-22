// Header button: purge the whole public cache and warm it again. Public pages
// are ISR-cached and also auto-purge on save; this is the manual "refresh
// everything now" escape hatch (e.g. after editing content directly in Blob).
import { useState, type ReactNode } from 'react'
import type { ApiResponse } from '@/types'
import { useToast } from '@/admin/ui/Toast'
import { useAdminT } from './I18nProvider'
import { ADMIN_NAV } from './headerActions'

// `icon` + `collapsed` let the sidebar render this as an icon row (label shown
// only when expanded). Without an icon it stays a plain text button (default).
export function CacheButton({
  className = ADMIN_NAV,
  icon,
  collapsed = false,
}: {
  className?: string
  icon?: ReactNode
  collapsed?: boolean
}) {
  const t = useAdminT()
  const { notify } = useToast()
  const [busy, setBusy] = useState(false)

  async function clear() {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch('/api/cache/clear', { method: 'POST' })
      const json = (await res.json()) as ApiResponse<{ warmed: number }>
      if (!json.success) throw new Error(json.error)
      notify(t.cacheCleared)
    } catch {
      notify(t.clearCacheFailed, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button type="button" onClick={clear} disabled={busy} className={className} title={collapsed ? t.clearCache : undefined}>
      {icon}
      {!collapsed && <span>{t.clearCache}</span>}
    </button>
  )
}
