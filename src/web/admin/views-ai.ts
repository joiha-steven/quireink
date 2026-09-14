// What the assistant screen reads, and the boundary it must not cross.
//
// EVERYTHING HERE IS A READ. `src/server/assistant.ts` is what spends money and runs tools; it
// is deliberately not imported by this file or by the screen that calls it, so drawing the page
// can never become asking the model a question. The only writes on this screen go out from the
// island, as explicit requests the owner started.
import { getIntegrationStatus } from '@/store/integration-keys'
import { getChat, listChats } from '@/server/assistant-chats'
import type { ChatSummary } from '@/server/assistant-chats'
import type { Turn } from '@/admin-shared/assistant'

export type AssistantScreenView = {
  configured: boolean
  model: string
  chats: ChatSummary[]
  /** The conversation named in the address, or null — a bad id draws the empty screen. */
  open: { id: number; turns: Turn[]; context: number } | null
}

/**
 * The screen in one read.
 *
 * `?chat=` is trusted no further than a number: an id that names no row answers `null` and the
 * page opens as if nothing had been asked for, which is what a stale bookmark deserves.
 */
export async function assistantScreenView(asked: string | null): Promise<AssistantScreenView> {
  const ai = await getIntegrationStatus()
  const chats = listChats()
  const id = Number(asked)
  const chat = asked && Number.isInteger(id) && id > 0 ? getChat(id) : null
  return {
    configured: ai.aiConfigured,
    model: ai.aiModel,
    chats,
    open: chat ? { id: chat.id, turns: chat.turns, context: chat.context } : null,
  }
}
