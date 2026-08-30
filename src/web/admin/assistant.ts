// The assistant's routes: one to ask, and four for the conversations it keeps (ADR 0040).
//
// The ask route stores what it produced rather than the caller storing it: an exchange that
// reached the provider was paid for, and a browser that closed between the answer and a
// follow-up write would lose it after the money was spent.

import { z } from 'zod'
import { runAssistant, type Turn } from '@/server/assistant'
import { createChat, deleteChat, getChat, listChats, renameChat, saveChat } from '@/server/assistant-chats'
import type { Context } from 'hono'
import { fail, json } from '@/web/api'
import { ownerRouter, param } from '@/web/guard'

// The same local helper the other admin route files carry.
const body = async <T>(c: Context): Promise<Partial<T>> =>
  (await c.req.json().catch(() => ({}))) as Partial<T>

const turn = z.union([
  z.object({ kind: z.literal('user'), text: z.string().max(20_000) }),
  z.object({ kind: z.literal('assistant'), text: z.string().max(50_000) }),
  // `reasoning` must be declared, not merely tolerated: zod STRIPS unknown keys rather
  // than refusing them, so leaving it out would drop the field silently on the way back
  // in — and the next round would be the 400 this whole field exists to prevent.
  z.object({
    kind: z.literal('tool_use'), id: z.string().max(200), name: z.string().max(100),
    args: z.record(z.string(), z.unknown()), reasoning: z.string().max(50_000).optional(),
    at: z.number().optional(),
  }),
  z.object({ kind: z.literal('tool_result'), id: z.string().max(200), name: z.string().max(100), text: z.string().max(50_000) }),
])

export function assistantRoutes() {
  const router = ownerRouter()

  // ----- the conversations (ADR 0040) -------------------------------------------------

  router.get('/api/assistant/chats', async () => json(listChats()))

  router.get('/api/assistant/chats/:id', async (c) => {
    const chat = getChat(Number(param(c, 'id')))
    return chat ? json(chat) : fail(c, 'not_found', 404)
  })

  router.post('/api/assistant/chats', async () => json({ id: createChat() }, 201))

  router.patch('/api/assistant/chats/:id', async (c) => {
    const id = Number(param(c, 'id'))
    if (!getChat(id)) return fail(c, 'not_found', 404)
    const title = String((await body<{ title: unknown }>(c)).title ?? '').trim()
    if (!title) return fail(c, 'bad_title', 400)
    renameChat(id, title)
    return json({ ok: true })
  })

  router.delete('/api/assistant/chats/:id', async (c) => {
    if (!deleteChat(Number(param(c, 'id')))) return fail(c, 'not_found', 404)
    return json({ ok: true })
  })

  router.post('/api/assistant', async (c) => {
    const input = await body<{ turns: unknown }>(c)
    const parsed = z.array(turn).min(1).max(60).safeParse(input.turns)
    if (!parsed.success) return fail(c, 'bad_conversation', 400)
    const asked = parsed.data as Turn[]
    // The chat this belongs to. Absent is allowed and means "answer but store nothing",
    // which is what a script or a test wants; the screen always sends one.
    // The owner's answer to a pause, if this request is one. Ids only: the calls
    // themselves are already in the turns, so nothing here can invent an action.
    const ids = (v: unknown): string[] =>
      (Array.isArray(v) ? v : []).filter((x): x is string => typeof x === 'string').slice(0, 20)
    const verdict = {
      approve: ids((input as { approve?: unknown }).approve),
      decline: ids((input as { decline?: unknown }).decline),
    }
    const chatId = Number((input as { chatId?: unknown }).chatId)
    const store = Number.isInteger(chatId) && chatId > 0 && getChat(chatId) !== null
    const keep = (reply: { turns: Turn[]; usage: { input: number; output: number }; context: number }) => {
      if (store) saveChat(chatId, [...asked, ...reply.turns], reply.usage, reply.context)
    }

    // The client asks for a stream by Accept, so the plain JSON answer stays exactly as it
    // was for anything that does not (a script, curl, the tests). One handler, because two
    // would be two chances for the gated path and the ungated one to drift apart.
    if (!c.req.header('accept')?.includes('text/event-stream')) {
      const reply = await runAssistant(asked, undefined, verdict)
      if (reply.ok) keep(reply)
      if (!reply.ok) {
        // 400 when the owner has not plugged a model in; 502 when their provider failed —
        // the same split the SMTP test makes, and for the same reason.
        return fail(c, reply.error, reply.error === 'provider_error' ? 502 : 400)
      }
      return json({ turns: reply.turns, text: reply.text, usage: reply.usage, context: reply.context, awaiting: reply.awaiting })
    }

    // SSE. THE STATUS IS ALREADY 200 by the time anything can fail, which is the price of
    // streaming: a refusal has to travel as an event in the body, and the client reads it
    // from there. Everything the non-streaming answer carries still arrives — the finished
    // `turns` land in the last event, so the transcript the browser stores is the server's,
    // not something reassembled from deltas that may have been dropped.
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: unknown) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        }
        try {
          const reply = await runAssistant(asked, (delta) => send({ delta }), verdict)
          if (reply.ok) keep(reply)
          send(reply.ok
            ? { done: true, turns: reply.turns, text: reply.text, usage: reply.usage, context: reply.context, awaiting: reply.awaiting }
            : { error: reply.error })
        } catch (error) {
          console.error(`[ERROR] assistant stream: ${(error as Error).message}`)
          send({ error: 'provider_error' })
        } finally {
          controller.close()
        }
      },
    })
    return new Response(stream, {
      headers: {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-store',
        // Nginx buffers a proxied response by default, which would hold every delta until
        // the answer was finished — streaming that arrives all at once is not streaming.
        'x-accel-buffering': 'no',
      },
    })
  })

  return router
}
