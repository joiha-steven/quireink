// The chat: the owner's side of the second door. Everything it can do is a registry
// tool executed server-side (`server/assistant.ts`); everything it DID is shown as a
// small chip under the reply, because a steward that hides its hands is a liability.
//
// The conversation lives in this component and nowhere else. Closing the tab is the
// archive policy, and that is a feature: the blog's DATABASE holds posts, not chats.
import { useRef, useState } from 'react'
import type { ApiResponse } from '@/types'
import { PageHeader } from './kit'
import { SHEET } from './sheet'
import { Button } from '@/admin/ui/Button'
import { useAdminT } from './I18nProvider'

type Turn =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string }
  | { kind: 'tool_use'; id: string; name: string; args: Record<string, unknown> }
  | { kind: 'tool_result'; id: string; name: string; text: string }

const INPUT =
  'w-full resize-none rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100'

export function AssistantView({ title }: { title: string }) {
  const t = useAdminT()
  const [turns, setTurns] = useState<Turn[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  async function send() {
    const text = draft.trim()
    if (!text || busy) return
    setError('')
    setBusy(true)
    setDraft('')
    // Send a WINDOW, keep the whole transcript: the server caps what it will read, and
    // an old tool result adds cost without adding memory worth paying for.
    const next: Turn[] = [...turns, { kind: 'user', text }]
    setTurns(next)
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ turns: next.slice(-30) }),
      })
      const json = (await res.json()) as ApiResponse<{ turns: Turn[] }>
      if (!json.success || !json.data) throw new Error(json.error || 'failed')
      setTurns([...next, ...json.data.turns])
    } catch (e) {
      const msg = (e as Error).message
      setError(msg === 'ai_not_configured' ? t.aiNotConfigured : t.assistantFailed)
    } finally {
      setBusy(false)
      setTimeout(() => endRef.current?.scrollIntoView({ block: 'end' }), 30)
    }
  }

  // Tool activity renders as chips between bubbles — what ran, at a glance; the answer
  // itself carries the substance.
  const rendered = turns.map((turn, i) => {
    if (turn.kind === 'user') {
      return (
        <div key={i} className="ml-auto max-w-[85%] rounded-lg bg-neutral-900 px-3 py-2 text-sm whitespace-pre-wrap text-neutral-50 dark:bg-neutral-100 dark:text-neutral-900">
          {turn.text}
        </div>
      )
    }
    if (turn.kind === 'assistant') {
      return (
        <div key={i} className="max-w-[85%] rounded-lg border border-neutral-200 px-3 py-2 text-sm whitespace-pre-wrap text-neutral-800 dark:border-neutral-700 dark:text-neutral-100">
          {turn.text}
        </div>
      )
    }
    if (turn.kind === 'tool_use') {
      return (
        <span key={i} className="w-fit rounded-full border border-neutral-200 px-2.5 py-0.5 font-mono text-[11px] text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
          {turn.name}
        </span>
      )
    }
    return null // tool results ride in the transcript, not on the screen
  })

  return (
    <div className="pb-24">
      <PageHeader title={title} />
      <div className={SHEET}>
        <div className="flex min-h-[60vh] flex-col p-5">
          {turns.length === 0 && (
            <p className="max-w-xl text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">{t.assistantIntro}</p>
          )}
          <div className="flex flex-1 flex-col gap-2 py-4">{rendered}<div ref={endRef} /></div>
          {error && <p className="mb-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex items-end gap-2 border-t border-neutral-200 pt-4 dark:border-neutral-800">
            <textarea
              className={INPUT}
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() }
              }}
              placeholder={t.assistantPlaceholder}
              disabled={busy}
            />
            <Button type="button" onClick={() => void send()} disabled={busy || !draft.trim()}>
              {busy ? t.assistantBusy : t.assistantSend}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
