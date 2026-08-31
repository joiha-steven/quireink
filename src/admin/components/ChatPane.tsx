// The conversations, in the column the writing screen taught this admin to expect.
//
// Same frame, same ground, same "you are here" as `WritePane`: a second list idiom on the
// screen next door is the drift `docs/admin-design.md` calls "one of each", and the owner
// has already learned to read this one.
//
// It draws no transcript. A column of forty chats holding forty transcripts is forty
// transcripts fetched to render forty titles, which is why the list route sends none.
import { useState, type JSX } from 'react'
import { META } from './kit'
import { SHEET_TOOL } from './sheet'
import { useAdminT } from './I18nProvider'
import { formatDateTimeShort } from '@/utils'

export type ChatSummary = {
  id: number
  title: string
  updatedAt: string
  usage: { input: number; output: number }
  context: number
}

/** 1,240 rather than 1240: a token count is read at a glance, not calculated with. */
export const tokens = (n: number): string =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : String(n)

export function ChatPane({ chats, activeId, onOpen, onNew, onDelete, busy }: {
  chats: ChatSummary[]
  activeId: number | null
  onOpen: (id: number) => void
  onNew: () => void
  onDelete: (id: number) => void
  busy: boolean
}): JSX.Element {
  const t = useAdminT()
  // Confirm in place rather than in a dialog: a chat is small enough that a modal asking
  // about it is heavier than the thing it is protecting.
  const [confirming, setConfirming] = useState<number | null>(null)

  return (
    <aside className="hidden w-72 shrink-0 flex-col self-start overflow-hidden rounded-[10px] border border-neutral-200/80 bg-neutral-50 xl:sticky xl:top-0 xl:flex xl:max-h-[calc(100dvh-1.5rem)] dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
        <span className={META}>{t.assistantChats}</span>
        <button type="button" className={SHEET_TOOL} onClick={onNew} disabled={busy}>
          {t.assistantNew}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {chats.length === 0 ? (
          <p className="px-4 py-3 text-sm text-neutral-500 dark:text-neutral-400">{t.assistantNoChats}</p>
        ) : (
          <ul>
            {chats.map((c) => {
              const active = c.id === activeId
              return (
                <li key={c.id} className="relative border-b border-neutral-100 dark:border-neutral-800">
                  {/* The open chat is a key held down — carved on the paper ground, same
                      as the write pane's open piece. An inset shifts no text. */}
                  <button
                    type="button"
                    onClick={() => onOpen(c.id)}
                    className={`block w-full px-4 py-3 text-left ${active ? 'bg-white shadow-[inset_0_2px_3px_rgba(0,0,0,.14)] dark:bg-neutral-900 dark:shadow-[inset_0_2px_3px_rgba(0,0,0,.5)]' : ''}`}
                  >
                    <span className={`block truncate text-sm ${active ? 'font-semibold text-neutral-900 dark:text-neutral-100' : 'text-neutral-700 dark:text-neutral-300'}`}>
                      {c.title || t.assistantUntitled}
                    </span>
                    <span className={`mt-0.5 flex items-center gap-2 ${META}`}>
                      <span>{formatDateTimeShort(c.updatedAt)}</span>
                      {c.context > 0 && <span className="tabular-nums">{tokens(c.context)}</span>}
                    </span>
                  </button>

                  {confirming === c.id ? (
                    <span className="flex items-center gap-2 px-4 pb-3">
                      <button
                        type="button"
                        className={SHEET_TOOL}
                        onClick={() => { setConfirming(null); onDelete(c.id) }}
                      >
                        {t.assistantDeleteYes}
                      </button>
                      <button type="button" className={SHEET_TOOL} onClick={() => setConfirming(null)}>
                        {t.close}
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      aria-label={t.assistantDelete}
                      className="absolute right-2 top-2 rounded p-1 text-neutral-400 opacity-0 transition hover:text-neutral-700 focus:opacity-100 group-hover:opacity-100 dark:hover:text-neutral-200 [li:hover_&]:opacity-100"
                      onClick={() => setConfirming(c.id)}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                      </svg>
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </aside>
  )
}
