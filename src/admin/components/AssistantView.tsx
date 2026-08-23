// The chat: the owner's side of the second door. Everything it can do is a registry
// tool executed server-side (`server/assistant.ts`); everything it DID is shown as a
// small chip under the reply, because a steward that hides its hands is a liability.
//
// The conversation lives in this component and nowhere else. Closing the tab is the
// archive policy, and that is a feature: the blog's DATABASE holds posts, not chats.
//
// ⚠️ The first cut was a bubble chat on a sheet with a 60vh floor, and photographing it on
// 2026-08-24 is the whole argument for what is here now. The composer sat two thirds of the
// way down a full-height page with 380px of empty paper under it; the intro was a paragraph
// of prose hanging in the top-left corner of an otherwise blank screen; nothing said which
// model would answer, or that none was connected, until a question had been typed and sent;
// and a long transcript would have pushed the composer off the bottom of the page for good.
// So: a sheet the size of the window, a transcript that scrolls INSIDE it, the composer
// fixed to its bottom edge, and the model named on the sheet's own first row.
//
// It is not a bubble chat any more either. Rounded fills on alternating sides is the costume
// `docs/admin-design.md` rejects on sight; this admin is paper, hairlines and space, so an
// exchange is a block on the page — the question in the owner's own weight, the answer in
// prose under it, a rule between one exchange and the next.
import { useRef, useState } from 'react'
import Link from '@/admin/router'
import type { ApiResponse } from '@/types'
import { CONTROL, EmptyState, META, PageHeader } from './kit'
import { SHEET_FIXED, SHEET_TOOL, SheetTop } from './sheet'
import { Button } from '@/admin/ui/Button'
import { useAdminT } from './I18nProvider'

type Turn =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string }
  | { kind: 'tool_use'; id: string; name: string; args: Record<string, unknown> }
  | { kind: 'tool_result'; id: string; name: string; text: string }

/** One question and everything that came back for it. */
type Block = { question: string; parts: Turn[] }

const CHIP =
  'inline-flex items-center rounded-full border border-neutral-200 px-2.5 py-0.5 text-[11px] text-neutral-500 dark:border-neutral-700 dark:text-neutral-400'

const AI_SETTINGS = '/admin/settings?tab=ai'

export function AssistantView({ title, configured, model }: {
  title: string; configured: boolean; model: string
}) {
  const t = useAdminT()
  const [turns, setTurns] = useState<Turn[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLTextAreaElement>(null)

  /** One row at rest — the height of the button beside it — growing to six as it fills. */
  function grow(el: HTMLTextAreaElement) {
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }

  // Takes the text rather than reading `draft`, so an example chip can send without
  // waiting a render for the state it just set.
  async function send(text: string) {
    const asked = text.trim()
    if (!asked || busy || !configured) return
    setError('')
    setBusy(true)
    setDraft('')
    if (boxRef.current) boxRef.current.style.height = 'auto'
    // Send a WINDOW, keep the whole transcript: the server caps what it will read, and
    // an old tool result adds cost without adding memory worth paying for.
    const next: Turn[] = [...turns, { kind: 'user', text: asked }]
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
      setTimeout(() => endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }), 30)
    }
  }

  // A question opens a block and everything after it belongs to that block, so the page
  // reads as exchanges rather than as a flat list of forty turns.
  const blocks: Block[] = []
  for (const turn of turns) {
    if (turn.kind === 'user') blocks.push({ question: turn.text, parts: [] })
    else blocks[blocks.length - 1]?.parts.push(turn)
  }

  const examples = [t.assistantEg1, t.assistantEg2, t.assistantEg3]

  return (
    <div>
      <PageHeader title={title} />
      <div className={SHEET_FIXED}>
        <SheetTop>
          {/* WHICH model — the one fact the page cannot be honest without. Not connected is
              not a silent state: it is a link to the screen that fixes it. */}
          {configured
            ? <span className={META}>{t.assistantModelOn} <span className="text-neutral-700 dark:text-neutral-300">{model || t.aiProviderOff}</span></span>
            : <Link href={AI_SETTINGS} className={SHEET_TOOL}>{t.aiNotConfigured}</Link>}
          <button
            type="button"
            className={`${SHEET_TOOL} ml-auto`}
            onClick={() => { setTurns([]); setError(''); setDraft('') }}
            disabled={busy || turns.length === 0}
          >
            {t.assistantNew}
          </button>
        </SheetTop>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
          {blocks.length === 0 ? (
            // Centred in the sheet rather than pinned to its top corner: with the composer
            // fixed to the bottom edge, an empty state at the top leaves the screen looking
            // like a page that failed to load the rest of itself.
            <div className="flex h-full items-center justify-center">
            <EmptyState
              title={configured ? t.assistantEmpty : t.assistantNoModel}
              description={configured ? t.assistantIntro : t.assistantNeedsModel}
              action={configured
                ? (
                  <div className="flex flex-wrap justify-center gap-2">
                    {examples.map((eg) => (
                      <button
                        key={eg}
                        type="button"
                        onClick={() => void send(eg)}
                        className={`${CHIP} transition hover:border-neutral-400 hover:text-neutral-900 dark:hover:border-neutral-500 dark:hover:text-neutral-100`}
                      >
                        {eg}
                      </button>
                    ))}
                  </div>
                )
                : (
                  <Link href={AI_SETTINGS} className={`${CHIP} transition hover:border-neutral-400 hover:text-neutral-900 dark:hover:border-neutral-500 dark:hover:text-neutral-100`}>
                    {t.assistantOpenAi}
                  </Link>
                )}
            />
            </div>
          ) : (
            <ol className="mx-auto max-w-3xl space-y-7">
              {blocks.map((b, i) => {
                const said = b.parts.filter((p) => p.kind === 'assistant')
                const used = b.parts.filter((p) => p.kind === 'tool_use')
                return (
                  <li key={i} className="border-t border-neutral-100 pt-7 first:border-0 first:pt-0 dark:border-neutral-800">
                    <p className="text-sm leading-relaxed font-medium whitespace-pre-wrap text-neutral-900 dark:text-neutral-100">
                      {b.question}
                    </p>
                    {said.map((p, j) => (
                      <p key={j} className="mt-3 text-sm leading-relaxed whitespace-pre-wrap text-neutral-700 dark:text-neutral-300">
                        {p.kind === 'assistant' ? p.text : ''}
                      </p>
                    ))}
                    {/* What it touched, in one quiet row under the answer — tool RESULTS ride
                        in the transcript and stay off the screen. */}
                    {used.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {used.map((p, j) => <span key={j} className={CHIP}>{p.kind === 'tool_use' ? p.name : ''}</span>)}
                      </div>
                    )}
                  </li>
                )
              })}
            </ol>
          )}
          {busy && <p className={`mx-auto mt-6 max-w-3xl animate-pulse ${META}`}>{t.assistantBusy}</p>}
          {error && <p className="mx-auto mt-6 max-w-3xl text-sm text-neutral-900 dark:text-neutral-100">{error}</p>}
          <div ref={endRef} />
        </div>

        <div className="border-t border-neutral-100 p-4 dark:border-neutral-800">
          <div className="mx-auto flex max-w-3xl items-end gap-2">
            <textarea
              ref={boxRef}
              className={`${CONTROL} w-full resize-none`}
              rows={1}
              value={draft}
              onChange={(e) => { setDraft(e.target.value); grow(e.currentTarget) }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(draft) }
              }}
              placeholder={t.assistantPlaceholder}
              disabled={busy || !configured}
            />
            <Button type="button" onClick={() => void send(draft)} disabled={busy || !configured || !draft.trim()}>
              {busy ? t.assistantBusy : t.assistantSend}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
