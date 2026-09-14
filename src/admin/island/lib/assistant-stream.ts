// The server's events, one object at a time, and the one request that produces them.
//
// ⚠️ `POST /api/assistant` IS THE EXPENSIVE DOOR. It reaches a paid provider, runs registry
// tools against the live blog and writes the conversation to the database. It is issued from
// exactly one line, in this file, and the only thing that calls it is a handler the owner
// started by pressing something. Nothing here runs on load, on a timer, or on a resize.
//
// In `island/lib/` because `scripts/build-admin.ts` globs `island/*.ts` without recursing: a
// file one directory down is a module, not a browser entry of its own.
import type { Pending, Turn } from '@/admin-shared/assistant'
import { WINDOW } from '@/admin-shared/assistant'

export type Usage = { input: number; output: number }

export type Landed = {
  turns: Turn[]
  awaiting: Pending[]
  usage?: Usage
  context?: number
}

export type Verdict = { approve?: string[]; decline?: string[] }

/**
 * A chunk boundary lands wherever the network puts it, so an event routinely arrives in two
 * reads — the buffer is the whole point, and the same reason `assistant-stream.ts` carries one
 * on the other side.
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

/**
 * One request to the model, streamed.
 *
 * Shared by a new question and by the answer to a pause, because both are the same thing on the
 * wire: a conversation, plus at most two lists of ids saying what the owner decided about the
 * calls the server stopped in front of.
 *
 * `onText` is handed everything that has arrived so far rather than each delta, because that is
 * what the screen draws — a renderer that has to accumulate is a renderer that can lose a
 * character. What LANDS is the server's own turns, never the assembled text: the deltas are for
 * the eye, and a dropped one must not become the transcript the next question is built on.
 */
export async function ask(
  turns: Turn[],
  chatId: number | null,
  verdict: Verdict,
  onText: (shown: string) => void,
): Promise<Landed | null> {
  const res = await fetch('/api/assistant', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
    body: JSON.stringify({ turns: turns.slice(-WINDOW), chatId, ...verdict }),
  })
  // A session that died while the page was open answers 401 to every one of these. The React
  // face read them with a bare `fetch` and showed "the model did not answer", which sent the
  // owner to check an API key that was never the problem.
  if (res.status === 401) {
    location.href = `/login?next=${encodeURIComponent(location.pathname + location.search)}`
    return null
  }
  // A stream answers 200 before anything can go wrong, so a refusal arrives as an event. A
  // server that did not stream at all (an old build behind a proxy that strips the header)
  // still answers JSON, and that path is still read.
  if (!res.body || !res.headers.get('content-type')?.includes('text/event-stream')) {
    const json = await res.json() as { success?: boolean; data?: { turns: Turn[] }; error?: string }
    if (!json.success || !json.data) throw new Error(json.error || 'failed')
    return { turns: json.data.turns, awaiting: [] }
  }

  let shown = ''
  let landed: Landed | null = null
  for await (const event of sseEvents(res.body)) {
    if (typeof event.delta === 'string') {
      shown += event.delta
      onText(shown)
    } else if (event.error) {
      throw new Error(String(event.error))
    } else if (event.done) {
      landed = {
        turns: (event.turns ?? []) as Turn[],
        awaiting: (event.awaiting ?? []) as Pending[],
        usage: event.usage as Usage | undefined,
        context: typeof event.context === 'number' ? event.context : undefined,
      }
    }
  }
  // A stream that ended without saying `done` said nothing this screen can store, and answers
  // so. Handing back the assembled text as a transcript would let a connection dropped
  // mid-sentence become the conversation the next question is built on.
  return landed
}
