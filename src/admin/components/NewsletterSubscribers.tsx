// Newsletter → People: who is on the list, and what each address has actually been
// sent. Counts come from the `newsletter_sends` log, so "5 emails" means five emails
// really left the server, not five attempts. Open rate covers broadcasts only (the
// tracking pixel rides on those); a dash means nothing to measure yet.
//
// ⚠️ A LIST OF PEOPLE IS A TABLE, and this was a run-on sentence per person: address, then
// status, then date, then sends, then opens, all joined by middots in 12px grey. Measured on
// a 390px screen it wrapped to two lines with a separator starting the second, so a `·` read
// as a bullet; at 1440 the five facts sat at five different x positions on every row, so no
// column could be compared down the page — which is the only thing a subscriber list is FOR.
// Columns now, one card per person under 640px, where a table would scroll sideways.
//
// FIFTY A PAGE, AND THE PAGING IS THIS COMPONENT'S. The endpoint hands back the whole list —
// it always has — and the search and the status filter run over ALL of it. Moving the paging
// to the server would mean either moving the search there too or shipping a search that only
// looks at the fifty rows in front of you, which is worse than no search: it answers "not
// found" about a list it never read.
import { useMemo, useState } from 'react'
import type { ApiResponse } from '@/types'
import { useFetched } from '@/admin/useFetched'
import { Failed } from '@/admin/pages/state'
import { CONTROL_SM, EmptyState, TABLE_SCROLL, TAP_TOUCH, THEAD, TROW } from './kit'
import { Skeleton } from './Skeleton'
import { NumBand } from './sheet'
import { SelectionBar } from './SelectionBar'
import { Tabs } from './tabs'
import { Tick } from '@/admin/ui/Tick'
import { Lamp, type LampState } from '@/admin/ui/Lamp'
import { IconClose } from './navIcons'
import { TAP } from './scale'
import { useAdminT } from './I18nProvider'
import { useToast } from '@/admin/ui/Toast'

type Stats = { sent: number; failed: number; opened: number; broadcasts: number; lastAt?: string; lastError?: string }
type Status = 'pending' | 'confirmed' | 'unsubscribed'
type Subscriber = { id: number; email: string; status: Status; createdAt: string; stats: Stats | null }
type Counts = { confirmed: number; pending: number; unsubscribed: number }
type Scope = 'all' | Status

const PER_PAGE = 50
const shortDate = (iso?: string) => (iso ? iso.slice(0, 10) : '—')

/**
 * Confirmed is the only state that is DONE. Pending is waiting on the reader and
 * unsubscribed is a decision they made — neither is a fault, so neither is red; the lamp's
 * `off` is exactly "there is nothing to be right or wrong about here".
 */
const LAMP: Record<Status, LampState> = { confirmed: 'good', pending: 'attention', unsubscribed: 'off' }

export function NewsletterSubscribers() {
  const t = useAdminT()
  const { notify } = useToast()
  /**
   * ⚠️ A REFUSED REQUEST IS NOT AN EMPTY LIST, and this component used to say it was: the
   * catch ran `setSubs([])`, so a server that was down printed "No subscribers yet" to
   * somebody who has twenty-five. `useFetched` keeps the three answers apart and carries a
   * Try again, so asking a second time does not mean reloading the whole admin.
   */
  const state = useFetched<{ subscribers: Subscriber[]; counts: Counts }>('/api/subscribers', t.loadFailed)
  const [removed, setRemoved] = useState<Set<number>>(new Set())
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<Scope>('all')
  const [page, setPage] = useState(0)
  const [chosen, setChosen] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState(false)

  const live = state.data ? state.data.subscribers.filter((x) => !removed.has(x.id)) : null
  const counts: Counts = state.data?.counts ?? { confirmed: 0, pending: 0, unsubscribed: 0 }

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return (live ?? []).filter((s) => (scope === 'all' || s.status === scope)
      && (!needle || s.email.toLowerCase().includes(needle)))
  }, [live, query, scope])

  // The page is clamped rather than reset: filtering down to two pages while standing on
  // page five should land on the last page that exists, not throw you back to the first.
  const pages = Math.max(1, Math.ceil(shown.length / PER_PAGE))
  const at = Math.min(page, pages - 1)
  const slice = shown.slice(at * PER_PAGE, at * PER_PAGE + PER_PAGE)

  async function removeSub(id: number) {
    const res = await fetch(`/api/subscribers/${id}`, { method: 'DELETE' })
    const j = (await res.json()) as ApiResponse<unknown>
    // Hidden locally rather than refetched: the row is gone from the server either way, and
    // a refetch here would throw away the scroll position for one deleted line.
    if (j.success) setRemoved((prev) => new Set(prev).add(id))
    else notify(t.deleteFailed, 'error')
  }

  async function removeChosen() {
    setBusy(true)
    try {
      for (const id of chosen) await removeSub(id)
      setChosen(new Set())
    } finally {
      setBusy(false)
    }
  }

  /**
   * The selection, as a file, built in the browser.
   *
   * No endpoint: the rows are already here, and a server route for this would be a second
   * place that decides what a subscriber export contains. RFC 4180 quoting — an address
   * cannot contain a comma or a quote, but the STATUS and the dates are printed beside it and
   * a CSV that is right only for well-behaved input is a CSV that corrupts somebody's file.
   */
  function exportChosen() {
    const rows = shown.filter((s) => chosen.has(s.id))
    const cell = (v: string | number) => {
      const text = String(v)
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
    }
    const head = [t.nlColEmail, t.nlColStatus, t.nlColJoined, t.nlColSent, t.nlColOpenRate]
    const body = rows.map((s) => [
      s.email,
      s.status,
      shortDate(s.createdAt),
      s.stats?.sent ?? 0,
      openRate(s.stats) ?? '',
    ])
    const csv = [head, ...body].map((r) => r.map(cell).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `subscribers-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (state.error) return <div className="p-5"><Failed error={state.error} onRetry={state.reload} /></div>
  if (!live) return <Skeleton shape="list" />

  const statusLabel: Record<Status, string> = {
    confirmed: t.nlConfirmed,
    pending: t.nlPending,
    unsubscribed: t.nlUnsub,
  }
  const toggle = (id: number) => setChosen((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  return (
    <>
      <NumBand
        items={[
          { n: counts.confirmed.toLocaleString(), label: t.nlConfirmed },
          {
            n: counts.pending.toLocaleString(),
            label: (
              <>
                <span aria-hidden className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-[var(--pen-edge)] align-middle" />
                {t.nlPending}
              </>
            ),
          },
          { n: counts.unsubscribed.toLocaleString(), label: t.nlUnsub },
        ]}
      />
      {live.length === 0 ? (
        <div className="p-8"><EmptyState glyph="letter" title={t.nlNoSubs} description={t.nlNoSubsHint} /></div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 border-b border-neutral-100 px-5 py-3 dark:border-neutral-800">
            <input
              type="search"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(0) }}
              placeholder={t.nlSearchPlaceholder}
              aria-label={t.nlSearchPlaceholder}
              className={`${CONTROL_SM} min-w-0 flex-1`}
            />
            <Tabs
              tabs={[
                { key: 'all', label: t.filterAll },
                { key: 'confirmed', label: t.nlConfirmed },
                { key: 'pending', label: t.nlPending },
                { key: 'unsubscribed', label: t.nlUnsub },
              ]}
              value={scope}
              onChange={(k) => { setScope(k); setPage(0) }}
              size="sm"
            />
            <SelectionBar
              count={chosen.size}
              onClear={() => setChosen(new Set())}
              onDelete={() => { void removeChosen() }}
              actions={
                <button type="button" onClick={exportChosen} disabled={busy} className={`${TAP} text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white`}>
                  {t.nlExportCsv}
                </button>
              }
            />
          </div>
          {shown.length === 0 ? (
            <div className="p-8"><EmptyState glyph="lens" title={t.nlNoMatch} /></div>
          ) : (
            <>
              {/* THE TABLE, from 640px up. Below that the same rows are cards: five columns in
                  343px is a table that scrolls sideways, and a list you have to drag to read
                  is not a list. */}
              <div className={`hidden sm:block ${TABLE_SCROLL}`}>
                <table className="w-full text-sm">
                  <thead className={THEAD}>
                    <tr>
                      <th className="w-9 px-4 py-2.5" />
                      {/* `w-full` on the address, so the table's auto layout gives it the room the
                          other five columns do not need. Without it every column shared the width
                          evenly and the one variable-length thing on the row — the address — was
                          truncated at "foteini.lambr..." beside 300px of empty Status column. */}
                      <th className="w-full px-2 py-2.5 font-medium">{t.nlColEmail}</th>
                      <th className="px-2 py-2.5 font-medium">{t.nlColStatus}</th>
                      <th className="px-2 py-2.5 font-medium">{t.nlColJoined}</th>
                      <th className="px-2 py-2.5 text-right font-medium">{t.nlColSent}</th>
                      <th className="px-2 py-2.5 text-right font-medium">{t.nlColOpenRate}</th>
                      <th className="w-12 px-2 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {slice.map((s) => (
                      <tr key={s.id} className={TROW}>
                        <td className="px-4 py-2 align-middle">
                          <Tick checked={chosen.has(s.id)} onChange={() => toggle(s.id)} disabled={busy} />
                        </td>
                        <td className="max-w-0 px-2 py-2 align-middle">
                          <span className="block truncate font-medium text-neutral-800 dark:text-neutral-200" title={s.email}>{s.email}</span>
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 align-middle">
                          <span className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
                            <Lamp state={LAMP[s.status]} />
                            {statusLabel[s.status]}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 align-middle tabular-nums text-neutral-500 dark:text-neutral-400">{shortDate(s.createdAt)}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-right align-middle tabular-nums text-neutral-500 dark:text-neutral-400">
                          {s.stats?.sent ?? 0}
                          {/* Failures are the whole point of keeping the log — never hide them. */}
                          {s.stats && s.stats.failed > 0 && (
                            <span className="ml-1 text-[var(--pen-red)]" title={s.stats.lastError}>+{s.stats.failed}</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right align-middle tabular-nums text-neutral-500 dark:text-neutral-400">{openRate(s.stats) ?? '—'}</td>
                        <td className="px-2 py-2 text-right align-middle">
                          <button
                            type="button"
                            onClick={() => void removeSub(s.id)}
                            className={`${TAP_TOUCH} grid h-9 w-9 place-items-center rounded-md text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white`}
                            aria-label={t.nlDeleteSub}
                          >
                            <IconClose />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="admin-stagger sm:hidden">
                {slice.map((s, i) => (
                  <li key={s.id} style={{ ['--i' as string]: i }} className="border-b border-neutral-100 px-5 py-3 dark:border-neutral-800">
                    <div className="flex items-start gap-3">
                      <Tick checked={chosen.has(s.id)} onChange={() => toggle(s.id)} disabled={busy} className="mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-neutral-800 dark:text-neutral-200" title={s.email}>{s.email}</span>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
                          <span className="flex items-center gap-1.5"><Lamp state={LAMP[s.status]} />{statusLabel[s.status]}</span>
                          <span className="tabular-nums">{shortDate(s.createdAt)}</span>
                          <span className="tabular-nums">{t.nlColSent} {s.stats?.sent ?? 0}</span>
                          {openRate(s.stats) && <span className="tabular-nums">{t.nlColOpenRate} {openRate(s.stats)}</span>}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void removeSub(s.id)}
                        className={`${TAP_TOUCH} -mr-1.5 grid h-9 w-9 shrink-0 place-items-center rounded-md text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white`}
                        aria-label={t.nlDeleteSub}
                      >
                        <IconClose />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              {/* The paging line only appears when there is more than one page: a control that
                  says "1-25 of 25" beside two dead arrows is furniture. */}
              {pages > 1 && (
                <div className="flex items-center justify-between gap-3 px-5 py-3 text-xs text-neutral-500 dark:text-neutral-400">
                  <span className="tabular-nums">
                    {t.nlShowing
                      .replace('{from}', String(at * PER_PAGE + 1))
                      .replace('{to}', String(at * PER_PAGE + slice.length))
                      .replace('{n}', String(shown.length))}
                  </span>
                  <span className="flex items-center gap-3">
                    <button type="button" disabled={at === 0} onClick={() => setPage(at - 1)} className={`${TAP} disabled:opacity-40 hover:text-neutral-900 dark:hover:text-white`}>{t.nlPagePrev}</button>
                    <button type="button" disabled={at >= pages - 1} onClick={() => setPage(at + 1)} className={`${TAP} disabled:opacity-40 hover:text-neutral-900 dark:hover:text-white`}>{t.nlPageNext}</button>
                  </span>
                </div>
              )}
            </>
          )}
        </>
      )}
    </>
  )
}

const openRate = (s: Stats | null) =>
  s && s.broadcasts > 0 ? `${Math.round((s.opened / s.broadcasts) * 100)}%` : null
