// The log, in sentences.
//
// It printed its machine codes — `post.create`, `newsletter.send`, `mcp.token.delete`, forty
// of them, each in a grey chip beside a raw detail string. That is the database's vocabulary
// shown to the person the log is for, and the one screen in this admin whose entire job is to
// be READ was the one written in a language nobody speaks. `logSentence.ts` carries the
// table; the code stays in the row's `title`, because somebody debugging an install needs it
// and keeping it costs nothing.
//
// Three controls, because a log of two hundred lines with no way to narrow it is an archive
// rather than an answer: which KIND of thing, how far BACK, and a search over the sentence
// AND the detail. Fifty at a time, with the rest one press away — the endpoint already caps
// at 200, so this is a rendering decision and not a round trip.
import { useMemo, useState } from 'react'
import { useRouter } from '@/admin/router'
import type { ApiResponse } from '@/types'
import type { ActivityEntry } from '@/server/activity'
import { formatDateTimeShort } from '@/utils'
import { useToast } from '@/admin/ui/Toast'
import { useConfirm } from '@/admin/ui/ConfirmDialog'
import { EmptyState, PageHeader, Select } from './kit'
import { SHEET, SHEET_TOOL, SheetTop, SHEET_TOOL_DANGER } from './sheet'
import { useAdminT } from './I18nProvider'
import { fold } from './settings-index'
import { glyphOf, kindOf, logSentence, type LogKind } from './logSentence'
import { ICONS } from '@/icons'

const PAGE = 50

const KINDS: LogKind[] = ['writing', 'media', 'people', 'settings', 'system', 'security', 'error']

/** One 14px glyph, drawn from the shared set so the log looks like the rest of the admin. */
function Glyph({ action }: { action: string }) {
  return (
    <svg
      viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-neutral-400 dark:text-neutral-500"
      fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden
      dangerouslySetInnerHTML={{ __html: ICONS[glyphOf(action)] }}
    />
  )
}

export function ActivityLog({ entries, enabled }: { entries: ActivityEntry[]; enabled: boolean }) {
  const t = useAdminT()
  const router = useRouter()
  const { notify } = useToast()
  const ask = useConfirm()
  const [busy, setBusy] = useState(false)
  const [kind, setKind] = useState<LogKind | 'all'>('all')
  const [days, setDays] = useState(0)
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(PAGE)

  const KIND_LABEL: Record<LogKind, string> = {
    writing: t.logKindWriting,
    media: t.logKindMedia,
    people: t.logKindPeople,
    settings: t.logKindSettings,
    system: t.logKindSystem,
    security: t.logKindSecurity,
    error: t.logKindError,
  }

  /**
   * The rows that survive all three controls, in the order the server gave them.
   *
   * The search reaches the SENTENCE as well as the detail, accent-folded — somebody looking
   * for what happened to a post types its title, and somebody looking for a kind of event
   * types the word the screen shows them, not the code underneath it.
   */
  const rows = useMemo(() => {
    const q = fold(query.trim())
    const since = days > 0 ? Date.now() - days * 86400000 : 0
    return entries.filter((e) => {
      if (kind !== 'all' && kindOf(e.action) !== kind) return false
      if (since && new Date(e.at).getTime() < since) return false
      if (!q) return true
      return fold(`${logSentence(t, e.action, e.detail)} ${e.detail} ${e.action}`).includes(q)
    })
  }, [entries, kind, days, query, t])

  async function clear() {
    if (busy || entries.length === 0) return
    const said = await ask({
      title: t.askClearLogTitle,
      body: t.askClearLogBody,
      confirmLabel: t.askClear,
      cancelLabel: t.askCancel,
      danger: true,
    })
    if (said !== 'confirm') return
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

  // ONE SHEET, two newspaper columns — the log and the guide split in two like the pages
  // that already had: each entry is a one-line ledger —
  // time, the action as a quiet chip, the detail — and the clear control is the
  // sheet-top's one tool.
  return (
    <div>
      <PageHeader title={t.logTitle} />
      <div className={SHEET}>
        <SheetTop>
          <span className={SHEET_TOOL}>{rows.length.toLocaleString()} · {t.logTitle.toLowerCase()}</span>
          <Select
            small
            aria-label={t.logKindAll}
            value={kind}
            onChange={(e) => { setKind(e.target.value as LogKind | 'all'); setShown(PAGE) }}
          >
            <option value="all">{t.logKindAll}</option>
            {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </Select>
          <Select
            small
            aria-label={t.logWhenAll}
            value={String(days)}
            onChange={(e) => { setDays(Number(e.target.value)); setShown(PAGE) }}
          >
            <option value="0">{t.logWhenAll}</option>
            <option value="7">{t.logWhen7}</option>
            <option value="30">{t.logWhen30}</option>
          </Select>
          <input
            type="search"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setShown(PAGE) }}
            placeholder={t.logSearch}
            aria-label={t.logSearch}
            className="h-8 min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-2.5 text-xs text-neutral-900 placeholder:text-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
          {entries.length > 0 && (
            <button type="button" onClick={clear} disabled={busy} className={SHEET_TOOL_DANGER}>
              {t.logClear}
            </button>
          )}
        </SheetTop>

        {!enabled && (
          <p className="border-b border-neutral-100 bg-neutral-50 px-5 py-2.5 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-400">
            {t.logDisabled}
          </p>
        )}

        {/* `EmptyState`, not a loose paragraph. Two shapes for "nothing here" were counted on
            2026-09-07 and this was the other one — a sentence at the top left of an otherwise
            blank sheet, where every other empty screen in the admin centres its. */}
        {entries.length === 0 ? (
          <EmptyState title={t.logEmpty} />
        ) : rows.length === 0 ? (
          <EmptyState title={t.logNoMatch} />
        ) : (
          <>
          <ul className="admin-stagger paper-cols">
            {rows.slice(0, shown).map((e, i) => (
              <li
                key={e.id}
                style={{ ["--i" as string]: i }}
                className="flex items-center gap-2.5 border-b border-neutral-100 px-5 py-2 text-xs transition-colors hover:bg-neutral-50/70 dark:border-neutral-800 dark:hover:bg-neutral-800/30"
                // The machine's own words, kept where somebody debugging an install can
                // reach them and nobody else has to read them.
                title={`${e.action}${e.detail ? ` — ${e.detail}` : ''}`}
              >
                <span className="whitespace-nowrap tabular-nums text-neutral-500 dark:text-neutral-400">{formatDateTimeShort(e.at)}</span>
                <Glyph action={e.action} />
                <span
                  className={`min-w-0 truncate ${
                    e.action === 'error'
                      ? 'font-medium text-neutral-900 dark:text-white'
                      : 'text-neutral-600 dark:text-neutral-300'
                  }`}
                >
                  {logSentence(t, e.action, e.detail)}
                </span>
              </li>
            ))}
          </ul>
          {rows.length > shown && (
            <div className="px-5 py-3">
              <button type="button" onClick={() => setShown((n) => n + PAGE)} className={SHEET_TOOL}>
                {t.logShowMore.replace('{n}', String(Math.min(PAGE, rows.length - shown)))}
              </button>
            </div>
          )}
          </>
        )}
      </div>
    </div>
  )
}
