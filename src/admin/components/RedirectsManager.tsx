// Self-contained CRUD island for URL redirects (Settings → SEO). It manages its own
// rows via /api/redirects — independent of the settings Save bar. A slug rename adds a
// 301 automatically (server-side); this is for manual redirects + reviewing them.
import { useEffect, useState } from 'react'
import type { ApiResponse } from '@/types'
import { Input } from '@/admin/ui/Input'
import { Button } from '@/admin/ui/Button'
import { useToast } from '@/admin/ui/Toast'
import { IconClose } from './navIcons'
import { useAdminT } from './I18nProvider'
import { useFetched } from '@/admin/useFetched'
import { Failed } from '@/admin/pages/state'
import { Skeleton } from './Skeleton'
import { CHECK, EmptyState, NOTE_TEXT } from './kit'

type Redirect = { id: number; source: string; destination: string; permanent: boolean }

export function RedirectsManager() {
  const t = useAdminT()
  const { notify } = useToast()
  const [rows, setRows] = useState<Redirect[]>([])
  const [source, setSource] = useState('')
  const [destination, setDestination] = useState('')
  const [permanent, setPermanent] = useState(true)
  const [busy, setBusy] = useState(false)

  async function reload() {
    const res = await fetch('/api/redirects')
    const json = (await res.json()) as ApiResponse<Redirect[]>
    if (json.success && json.data) setRows(json.data)
  }
  /**
   * ⚠️ The catch here used to be `() => {}`, so a refused request left an empty table with
   * nothing to say the question had failed — and an owner with fifty redirects saw the screen
   * of an owner with none. `useFetched` keeps the three answers apart and carries a Try again.
   */
  const state = useFetched<Redirect[]>('/api/redirects', t.loadFailed)
  useEffect(() => { if (state.data) setRows(state.data) }, [state.data])

  async function add() {
    if (!source.trim() || !destination.trim()) return
    setBusy(true)
    try {
      const res = await fetch('/api/redirects', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ source, destination, permanent }),
      })
      const json = (await res.json()) as ApiResponse<unknown>
      if (!json.success) {
        notify(json.error || t.redirectSaveFailed, 'error')
        return
      }
      setSource('')
      setDestination('')
      setPermanent(true)
      await reload()
      notify(t.redirectSaved)
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: number) {
    setBusy(true)
    try {
      const res = await fetch(`/api/redirects/${id}`, { method: 'DELETE' })
      const json = (await res.json()) as ApiResponse<unknown>
      if (json.success) setRows((r) => r.filter((x) => x.id !== id))
    } finally {
      setBusy(false)
    }
  }

  if (state.error) return <Failed error={state.error} onRetry={state.reload} />
  if (!state.data) return <Skeleton shape="list" />

  return (
    <div className="space-y-4">
      <p className={NOTE_TEXT}>{t.redirectsHint}</p>

      {rows.length === 0 ? (
        <EmptyState title={t.redirectEmpty} />
      ) : (
        <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">
                <code className="text-neutral-800 dark:text-neutral-200">{r.source}</code>
                <span className="mx-1.5 text-neutral-500 dark:text-neutral-400">→</span>
                <code className="text-neutral-600 dark:text-neutral-400">{r.destination}</code>
              </span>
              <span className="shrink-0 rounded-md border border-neutral-200 px-1.5 py-0.5 text-xs text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
                {r.permanent ? '301' : '302'}
              </span>
              <button
                type="button"
                onClick={() => remove(r.id)}
                disabled={busy}
                className="shrink-0 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 disabled:opacity-50 dark:hover:text-white"
                aria-label={t.redirectDelete}
                title={t.redirectDelete}
              >
                <IconClose />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-3 border-t border-neutral-100 pt-4 sm:grid-cols-2 dark:border-neutral-800">
        <Input
          label={t.redirectSource}
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="/old-path"
        />
        <Input
          label={t.redirectDestination}
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="/new-path"
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
          <input type="checkbox" className={CHECK} checked={permanent} onChange={(e) => setPermanent(e.target.checked)} />
          {t.redirectPermanent}
        </label>
        <Button onClick={add} disabled={busy || !source.trim() || !destination.trim()}>
          {t.redirectAdd}
        </Button>
      </div>
    </div>
  )
}
