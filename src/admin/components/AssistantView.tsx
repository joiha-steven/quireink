// The chat: the owner's side of the second door. Everything it can do is a registry tool
// executed server-side (`server/assistant.ts`); everything it DID is shown as a chip under the
// reply, because a steward that hides its hands is a liability.
//
// The conversation lives in this component and nowhere else. Closing the tab is the archive
// policy, and that is a feature: the blog's DATABASE holds posts, not chats.
//
// ⚠️ The first cut was a bubble chat on a sheet with a 60vh floor, and photographing it on
// 2026-08-24 is the argument for what is here now: the composer sat two thirds down a
// full-height page with 380px of empty paper under it, nothing said which model would answer
// until a question had been sent, and a long transcript would have pushed the composer off the
// bottom for good. So: a sheet the size of the window, a transcript that scrolls INSIDE it, the
// composer fixed to its bottom edge, the model named on the first row.
//
// Not a bubble chat either — rounded fills on alternating sides is the costume
// `docs/admin-design.md` rejects on sight. This admin is paper, hairlines and space, so an
// exchange is a block on the page with a rule between one and the next.
import { useEffect, useRef, useState } from 'react'
import Link from '@/admin/router'
import type { ApiResponse } from '@/types'
import { CONTROL, EmptyState, META, PageHeader } from './kit'
import { SHEET_FIXED, SHEET_TOOL, SheetTop } from './sheet'
import { Button } from '@/admin/ui/Button'
import { useAdminT } from './I18nProvider'
import { ChatPane, tokens, type ChatSummary } from './ChatPane'
import { Exchange, type Block, type Pending, type Turn } from './Exchange'
import { ToolLog, useToolLog } from './ToolLog'

const CHIP =
  'inline-flex items-center rounded-full border border-neutral-200 px-2.5 py-0.5 text-[11px] text-neutral-500 dark:border-neutral-700 dark:text-neutral-400'

const AI_SETTINGS = '/admin/settings?tab=ai'

/**
 * The server's events, one object at a time.
 *
 * A chunk boundary lands wherever the network puts it, so an event routinely arrives in
 * two reads — the buffer is the whole point, and the same reason `assistant-stream.ts`
 * carries one on the other side.
 */
async function* sseEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<Record<string, unknown>> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) return
    buffer += decoder.decode(value, { stream: true })
    let cut = buffer.indexOf('\n\n')
    while (cut !== -1) {
      const frame = buffer.slice(0, cut).trim()
      buffer = buffer.slice(cut + 2)
      cut = buffer.indexOf('\n\n')
      if (!frame.startsWith('data:')) continue
      try { yield JSON.parse(frame.slice(5).trim()) as Record<string, unknown> } catch { /* partial */ }
    }
  }
}

export function AssistantView({ title, configured, model }: {
  title: string; configured: boolean; model: string
}) {
  const t = useAdminT()
  const [turns, setTurns] = useState<Turn[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // What has arrived so far for the question in flight. Cleared the moment the server's
  // own turns land, so the finished answer is never drawn twice.
  const [live, setLive] = useState('')
  // The conversations (ADR 0040). A chat is opened by id rather than routed to: a route
  // change would swap the page component and take the column with it, which is the mistake
  // `WritePane` was hoisted out of the routed tree to fix.
  const [chats, setChats] = useState<ChatSummary[]>([])
  const [chatId, setChatId] = useState<number | null>(null)
  // What THIS exchange cost, keyed by the block it belongs to. A transcript reopened from
  // the database shows no number rather than one invented for it.
  const [cost, setCost] = useState<Record<number, { input: number; output: number }>>({})
  const [context, setContext] = useState(0)
  // A call the server stopped in front of. It is shown where the answer would be, and
  // nothing moves until the owner says which way.
  const [awaiting, setAwaiting] = useState<Pending[]>([])
  const log = useToolLog()

  const refreshChats = () =>
    void fetch('/api/assistant/chats')
      .then((r) => r.json())
      .then((j: ApiResponse<ChatSummary[]>) => { if (j.success && j.data) setChats(j.data) })
      .catch(() => { /* the column simply stays as it was */ })

  useEffect(refreshChats, [])

  async function openChat(id: number) {
    const res = await fetch(`/api/assistant/chats/${id}`)
    const json = (await res.json()) as ApiResponse<{ turns: Turn[]; context: number }>
    if (!json.success || !json.data) return
    setChatId(id); setTurns(json.data.turns); setContext(json.data.context); setCost({}); setError('')
  }

  /** A row to write into, returned rather than only set: the first question needs the id
   *  in the same tick and state does not arrive that fast. */
  async function startChat(): Promise<number | null> {
    const res = await fetch('/api/assistant/chats', { method: 'POST' })
    const json = (await res.json()) as ApiResponse<{ id: number }>
    const id = json.success && json.data ? json.data.id : null
    setChatId(id)
    return id
  }

  async function newChat() {
    setTurns([]); setCost({}); setContext(0); setError(''); setDraft('')
    await startChat()
    refreshChats()
  }

  async function removeChat(id: number) {
    await fetch(`/api/assistant/chats/${id}`, { method: 'DELETE' })
    if (id === chatId) { setChatId(null); setTurns([]); setCost({}); setContext(0) }
    refreshChats()
  }
  const endRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLTextAreaElement>(null)

  /** One row at rest — the height of the button beside it — growing to six as it fills. */
  function grow(el: HTMLTextAreaElement) {
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }

  // Takes the text rather than reading `draft`, so an example chip can send without
  // waiting a render for the state it just set.
  /**
   * Continue a paused conversation.
   *
   * The turns are already what they were: the answer is two lists of ids, so nothing the
   * screen sends can name an action the model did not ask for.
   */
  async function answer(verdict: { approve?: string[]; decline?: string[] }) {
    setAwaiting([])
    await exchange(turns, verdict)
  }

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
    // Which exchange this answer belongs to, counted before the request so the cost lands
    // on the right block when two questions are asked in quick succession.
    const blockIndex = next.filter((x) => x.kind === 'user').length - 1
    setTurns(next)
    // A question asked on an empty screen opens a conversation for itself. Without this the
    // first exchange of every session was answered, paid for, and stored nowhere.
    const target = chatId ?? await startChat()
    await exchange(next, {}, blockIndex, target)
  }

  /**
   * One request to the model, streamed.
   *
   * Shared by a new question and by the answer to a pause, because both are the same
   * thing on the wire: a conversation, plus at most two lists of ids saying what the
   * owner decided about the calls it stopped in front of.
   */
  async function exchange(
    next: Turn[],
    verdict: { approve?: string[]; decline?: string[] },
    blockIndex = Math.max(0, next.filter((x) => x.kind === 'user').length - 1),
    target = chatId,
  ) {
    setBusy(true)
    setLive('')
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
        body: JSON.stringify({ turns: next.slice(-30), chatId: target, ...verdict }),
      })
      // A stream answers 200 before anything can go wrong, so a refusal arrives as an
      // event. A server that did not stream at all (an old build behind a proxy that
      // strips the header) still answers JSON, and that path is still read.
      if (!res.body || !res.headers.get('content-type')?.includes('text/event-stream')) {
        const json = (await res.json()) as ApiResponse<{ turns: Turn[] }>
        if (!json.success || !json.data) throw new Error(json.error || 'failed')
        setTurns([...next, ...json.data.turns])
        return
      }
      let shown = ''
      for await (const event of sseEvents(res.body)) {
        if (typeof event.delta === 'string') {
          shown += event.delta
          setLive(shown)
        } else if (event.error) {
          throw new Error(String(event.error))
        } else if (event.done) {
          // The SERVER'S turns, not the text assembled here: the deltas are for the eye,
          // and a dropped one must not become the transcript the next question is built on.
          setTurns([...next, ...((event.turns ?? []) as Turn[])])
          setAwaiting((event.awaiting ?? []) as Pending[])
          const spent = event.usage as { input: number; output: number } | undefined
          if (spent) setCost((c) => ({ ...c, [blockIndex]: spent }))
          if (typeof event.context === 'number') setContext(event.context)
          refreshChats()
        }
      }
    } catch (e) {
      const msg = (e as Error).message
      setError(msg === 'ai_not_configured' ? t.aiNotConfigured : t.assistantFailed)
    } finally {
      setLive('')
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
      {/* The two columns the writing screen established. The pane is drawn by this
          component rather than the shell because opening a chat changes STATE and not the
          route, so nothing here is ever unmounted underneath it. */}
      <div className="flex items-start gap-6">
        <ChatPane
          chats={chats}
          activeId={chatId}
          onOpen={(id) => void openChat(id)}
          onNew={() => void newChat()}
          onDelete={(id) => void removeChat(id)}
          busy={busy}
        />
      <div className={`${SHEET_FIXED} min-w-0 flex-1`}>
        <SheetTop>
          {/* WHICH model — the one fact the page cannot be honest without. Not connected is
              not a silent state: it is a link to the screen that fixes it. */}
          {configured
            ? <span className={META}>{t.assistantModelOn} <span className="text-neutral-700 dark:text-neutral-300">{model || t.aiProviderOff}</span></span>
            : <Link href={AI_SETTINGS} className={SHEET_TOOL}>{t.aiNotConfigured}</Link>}
          {/* HOW BIG THIS CONVERSATION HAS BECOME, which is the number that decides when
              to start another one. Not a total of what was spent: every question re-sends
              the whole conversation, so THIS is what the next one pays again. Amber past
              60k, where one more question stops being loose change. */}
          {context > 0 && (
            <span className={`${META} tabular-nums ${context > 60_000 ? 'text-amber-700 dark:text-amber-500' : ''}`}>
              {t.assistantContext} {tokens(context)}
            </span>
          )}
          {/* Only where the column can appear: a control that toggles something invisible
              at this width is a control that does nothing. */}
          <button
            type="button"
            className={`${SHEET_TOOL} ml-auto hidden min-[1600px]:inline-flex`}
            onClick={log.toggle}
            aria-pressed={log.open}
          >
            {t.assistantDidThis}
          </button>
          <button
            type="button"
            className={`${SHEET_TOOL} ml-auto min-[1600px]:ml-0`}
            onClick={() => void newChat()}
            disabled={busy || turns.length === 0}
          >
            {t.assistantNew}
          </button>
        </SheetTop>

        {/* The sheet splits below its top row: the chat keeps the width it had, and the
            raw record of what was done stands beside it. */}
        <div className="flex min-h-0 flex-1">
        {/* A wider gutter than the sheet's usual 20px. The transcript is capped at
            `max-w-3xl` and centres itself when there is room, but the three-column layout
            often leaves less than that, and then the cap does nothing and the padding is
            the only thing between a paragraph and the edge of the paper. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-10">
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
              {blocks.map((b, i) => (
                <Exchange
                  key={i}
                  block={b}
                  last={i === blocks.length - 1}
                  live={live}
                  busy={busy}
                  cost={cost[i]}
                  awaiting={awaiting}
                  onAnswer={(v) => void answer(v)}
                />
              ))}
            </ol>
          )}
          {/* The waiting line lives inside the exchange it belongs to, where the eye
              already is. One here said the same thing a second time, three inches down. */}
          {error && <p className="mx-auto mt-6 max-w-3xl text-sm text-neutral-900 dark:text-neutral-100">{error}</p>}
          <div ref={endRef} />
        </div>
        <ToolLog turns={turns} open={log.open} />
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
    </div>
  )
}
