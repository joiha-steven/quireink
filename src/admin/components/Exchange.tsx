// ONE QUESTION AND EVERYTHING THAT CAME BACK FOR IT.
//
// Its own file because `AssistantView` reached the 400-line cap, and the seam is a real
// one: that component owns the conversation (fetching, streaming, storing), and this owns
// what a single exchange looks like on paper.
//
// The shape of it, and why: the QUESTION is framed and the ANSWER is not. A transcript is
// read by scanning for where each exchange begins, and marking both sides makes the eye
// read two marks to find one boundary. So one side gets an edge and the other gets the
// page — and the reply needs no name, because on this screen nothing else could have
// written it.
import type { JSX } from 'react'
import { Button } from '@/admin/ui/Button'
import { META } from './kit'
import { useAdminT } from './I18nProvider'
import { RichText } from './rich-text'
import { tokens } from './ChatPane'

export type Turn =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string }
  | { kind: 'tool_use'; id: string; name: string; args: Record<string, unknown>; reasoning?: string; at?: number }
  | { kind: 'tool_result'; id: string; name: string; text: string }

export type Pending = { id: string; name: string; args: Record<string, unknown>; reason?: 'listed' | 'untrusted' }

/** One question and everything that came back for it. */
export type Block = { question: string; parts: Turn[] }

const ASKED =
  'rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm leading-relaxed font-medium'
  + ' whitespace-pre-wrap text-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100'

const ANSWER = 'mt-4 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300'

const CHIP =
  'inline-flex items-center rounded-full border border-neutral-200 px-2.5 py-0.5 text-[11px] text-neutral-500 dark:border-neutral-700 dark:text-neutral-400'

export function Exchange({ block, last, live, busy, cost, awaiting, onAnswer }: {
  block: Block
  /** Only the last exchange can be mid-flight, waiting, or holding a question. */
  last: boolean
  live: string
  busy: boolean
  cost?: { input: number; output: number }
  awaiting: Pending[]
  onAnswer: (verdict: { approve?: string[]; decline?: string[] }) => void
}): JSX.Element {
  const t = useAdminT()
  const said = block.parts.filter((p) => p.kind === 'assistant')
  const used = block.parts.filter((p) => p.kind === 'tool_use')
  const asking = last && awaiting.length > 0

  return (
    <li className="pt-9 first:pt-0">
      <p className={ASKED}>{block.question}</p>

      {said.map((p, j) => (
        <div key={j} className={ANSWER}>
          <RichText text={p.kind === 'assistant' ? p.text : ''} />
        </div>
      ))}

      {/* THE PAUSE, drawn where the answer would be. Not a modal: a dialog over the
          transcript hides the sentence that explains what is about to happen, and the
          arguments below are the whole basis for saying yes. Nothing runs until one of
          these is pressed. Amber, because this is the admin's one "look at this" ink and
          nothing has been destroyed yet — red is reserved for what does the destroying. */}
      {asking && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50/60 p-3 dark:border-amber-800/60 dark:bg-amber-950/20">
          <p className={META}>{t.assistantWants}</p>
          {/* Said only when the pause is the second kind: an ordinary edit stopped because
              readers' words are in the conversation. The listed kind needs no explanation
              beyond the call itself. */}
          {awaiting.some((a) => a.reason === 'untrusted') && <p className={`${META} mt-1`}>{t.assistantAfterReaders}</p>}
          <ul className="mt-1.5 space-y-1">
            {awaiting.map((a) => (
              <li key={a.id} className="font-mono text-xs break-all text-neutral-800 dark:text-neutral-200">
                {a.name}{' '}
                <span className="text-neutral-500 dark:text-neutral-400">{JSON.stringify(a.args)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center gap-2">
            <Button variant="secondary" disabled={busy} onClick={() => onAnswer({ approve: awaiting.map((a) => a.id) })}>
              {t.assistantAllow}
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => onAnswer({ decline: awaiting.map((a) => a.id) })}>
              {t.assistantDeny}
            </Button>
          </div>
        </div>
      )}

      {/* Waiting, in the place the answer will appear rather than on the button: the eye
          is already here, and a composer that says "working" while the page says nothing
          is a page that looks broken. */}
      {last && busy && live === '' && said.length === 0 && !asking && (
        <p className={`${ANSWER} flex items-center gap-2`}>
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-400 dark:bg-neutral-500" />
          <span className={META}>{t.assistantBusy}</span>
        </p>
      )}

      {/* The answer still arriving, drawn by the same renderer: a mark that has not closed
          yet stays literal, so nothing flickers as it lands. */}
      {last && live !== '' && (
        <div className={ANSWER}>
          <RichText text={live} />
          <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-neutral-400 align-text-bottom dark:bg-neutral-500" />
        </div>
      )}

      {/* What it touched and what it cost, on one quiet row. The cost is known only for an
          exchange this tab watched happen: a transcript reopened from the database shows
          the chips and no number, which is honest where a figure reconstructed from the
          conversation's total would not be. */}
      {(used.length > 0 || cost) && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {used.map((p, j) => <span key={j} className={CHIP}>{p.kind === 'tool_use' ? p.name : ''}</span>)}
          {cost && (
            <span className={`${META} tabular-nums`}>
              {tokens(cost.input + cost.output)} {t.assistantTokens}
            </span>
          )}
        </div>
      )}
    </li>
  )
}
