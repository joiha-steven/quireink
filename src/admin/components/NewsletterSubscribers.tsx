// Newsletter → People: who is on the list, and what each address has actually been
// sent. Counts come from the `newsletter_sends` log, so "5 emails" means five emails
// really left the server, not five attempts. Open rate covers broadcasts only (the
// tracking pixel rides on those); a dash means nothing to measure yet.
import { useEffect, useState } from 'react'
import type { ApiResponse } from '@/types'
import { EmptyState } from './kit'
import { NumBand } from './sheet'
import { useAdminT } from './I18nProvider'

type Stats = { sent: number; failed: number; opened: number; broadcasts: number; lastAt?: string; lastError?: string }
type Subscriber = {
  id: number
  email: string
  status: 'pending' | 'confirmed' | 'unsubscribed'
  createdAt: string
  stats: Stats | null
}
type Counts = { confirmed: number; pending: number; unsubscribed: number }

const shortDate = (iso?: string) => (iso ? iso.slice(0, 10) : '—')

export function NewsletterSubscribers() {
  const t = useAdminT()
  const [subs, setSubs] = useState<Subscriber[] | null>(null)
  const [counts, setCounts] = useState<Counts>({ confirmed: 0, pending: 0, unsubscribed: 0 })

  useEffect(() => {
    fetch('/api/subscribers')
      .then((r) => r.json() as Promise<ApiResponse<{ subscribers: Subscriber[]; counts: Counts }>>)
      .then((j) => {
        if (j.success && j.data) {
          setSubs(j.data.subscribers)
          setCounts(j.data.counts)
        } else setSubs([])
      })
      .catch(() => setSubs([]))
  }, [])

  async function removeSub(id: number) {
    const res = await fetch(`/api/subscribers/${id}`, { method: 'DELETE' })
    const j = (await res.json()) as ApiResponse<unknown>
    if (j.success) setSubs((s) => (s ? s.filter((x) => x.id !== id) : s))
  }

  if (!subs) return <p className="px-5 py-6 text-sm text-neutral-400">{t.loading}</p>

  const openRate = (s: Stats | null) =>
    s && s.broadcasts > 0 ? `${Math.round((s.opened / s.broadcasts) * 100)}%` : null

  const statusLabel: Record<Subscriber['status'], string> = {
    confirmed: t.nlConfirmed,
    pending: t.nlPending,
    unsubscribed: t.nlUnsub,
  }

  // Two newspaper columns of one-line ledgers (the admin-pages mock): the address is
  // the thing, everything the log knows about it follows as small print. The dot ahead
  // of a PENDING address is the pen's edge — the list's own work-in-progress.
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
      {subs.length === 0 ? (
        <div className="p-8"><EmptyState title={t.nlNoSubs} description={t.nlNoSubsHint} /></div>
      ) : (
        <ul className="paper-cols">
          {subs.map((s) => (
            <li key={s.id} className="border-b border-neutral-100 px-5 py-2.5 dark:border-neutral-800">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs text-neutral-400 dark:text-neutral-500">
                <span
                  aria-hidden
                  className={`inline-block h-1.5 w-1.5 shrink-0 self-center rounded-full ${
                    s.status === 'pending' ? 'bg-[var(--pen-edge)]' : 'bg-neutral-300 dark:bg-neutral-600'
                  }`}
                />
                <span className="max-w-[18rem] truncate text-sm font-medium text-neutral-800 dark:text-neutral-200" title={s.email}>{s.email}</span>
                <span aria-hidden>·</span>
                <span>{statusLabel[s.status]}</span>
                <span className="whitespace-nowrap">· {shortDate(s.createdAt)}</span>
                {s.stats && s.stats.sent > 0 && (
                  <span className="whitespace-nowrap tabular-nums">· {t.nlColSent} {s.stats.sent}</span>
                )}
                {/* Failures are the whole point of keeping the log — never hide them. */}
                {s.stats && s.stats.failed > 0 && (
                  <span className="whitespace-nowrap" title={s.stats.lastError}>+{s.stats.failed} {t.nlFailedSuffix}</span>
                )}
                {openRate(s.stats) && (
                  <span className="whitespace-nowrap tabular-nums">· {t.nlColOpenRate} {openRate(s.stats)}</span>
                )}
                <button
                  type="button"
                  onClick={() => removeSub(s.id)}
                  className="ml-auto text-neutral-400 transition hover:text-neutral-900 dark:hover:text-white"
                  aria-label={t.nlDeleteSub}
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
