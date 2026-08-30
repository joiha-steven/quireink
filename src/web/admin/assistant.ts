// The assistant's one route. Owner-only, no state: the conversation lives in the open
// admin tab, the server just runs the loop and hands the new turns back.

import { z } from 'zod'
import { runAssistant, type Turn } from '@/server/assistant'
import type { Context } from 'hono'
import { fail, json } from '@/web/api'
import { ownerRouter } from '@/web/guard'

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
  }),
  z.object({ kind: z.literal('tool_result'), id: z.string().max(200), name: z.string().max(100), text: z.string().max(50_000) }),
])

export function assistantRoutes() {
  const router = ownerRouter()

  router.post('/api/assistant', async (c) => {
    const input = await body<{ turns: unknown }>(c)
    const parsed = z.array(turn).min(1).max(60).safeParse(input.turns)
    if (!parsed.success) return fail(c, 'bad_conversation', 400)
    const asked = parsed.data as Turn[]

    // The client asks for a stream by Accept, so the plain JSON answer stays exactly as it
    // was for anything that does not (a script, curl, the tests). One handler, because two
    // would be two chances for the gated path and the ungated one to drift apart.
    if (!c.req.header('accept')?.includes('text/event-stream')) {
      const reply = await runAssistant(asked)
      if (!reply.ok) {
        // 400 when the owner has not plugged a model in; 502 when their provider failed —
        // the same split the SMTP test makes, and for the same reason.
        return fail(c, reply.error, reply.error === 'provider_error' ? 502 : 400)
      }
      return json({ turns: reply.turns, text: reply.text })
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
          const reply = await runAssistant(asked, (delta) => send({ delta }))
          send(reply.ok ? { done: true, turns: reply.turns, text: reply.text } : { error: reply.error })
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
