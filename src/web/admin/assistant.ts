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
  z.object({ kind: z.literal('tool_use'), id: z.string().max(200), name: z.string().max(100), args: z.record(z.string(), z.unknown()) }),
  z.object({ kind: z.literal('tool_result'), id: z.string().max(200), name: z.string().max(100), text: z.string().max(50_000) }),
])

export function assistantRoutes() {
  const router = ownerRouter()

  router.post('/api/assistant', async (c) => {
    const input = await body<{ turns: unknown }>(c)
    const parsed = z.array(turn).min(1).max(60).safeParse(input.turns)
    if (!parsed.success) return fail(c, 'bad_conversation', 400)
    const reply = await runAssistant(parsed.data as Turn[])
    if (!reply.ok) {
      // 400 when the owner has not plugged a model in; 502 when their provider failed —
      // the same split the SMTP test makes, and for the same reason.
      return fail(c, reply.error, reply.error === 'provider_error' ? 502 : 400)
    }
    return json({ turns: reply.turns, text: reply.text })
  })

  return router
}
