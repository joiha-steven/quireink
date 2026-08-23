// The comment gate: every comment that lands through the PUBLIC route is shown to the
// plugged model, and one that reads as spam moves to the Trash — held, never destroyed.
//
// Deliberately AFTER the insert and in the background: commenting stays instant, and the
// admin's own Trash is the review queue (restore = approve), so no new state machine and
// no new screen. The window where a spam comment is publicly visible is the seconds the
// classification takes; the alternative — making every honest commenter wait on a model
// round-trip — taxes the wrong person.
//
// The owner's replies over MCP call `addComment` directly and never pass this gate: the
// gate guards the public door, not the house.

import { softDeleteComment } from '@/comments/comments'
import { getSettings } from '@/content/settings'
import { getIntegrationKeys } from '@/store/integration-keys'
import { ask } from '@/server/ai-provider'
import { logActivity } from '@/server/activity'

export async function guardComment(id: number, name: string, content: string, website?: string): Promise<void> {
  try {
    const keys = await getIntegrationKeys()
    if (!keys.aiProvider || !keys.aiApiKey) return
    const { ai } = await getSettings()
    if (!ai.commentGuard) return

    const answer = await ask([{
      text: 'You are a blog comment spam filter. Given one comment, answer with exactly one word: SPAM if it is unsolicited advertising, link-bait, scam or abuse; OK otherwise. When unsure, answer OK — a false hold costs a real reader their voice.\n\n'
        + `Name: ${name.slice(0, 100)}\nWebsite: ${(website ?? '').slice(0, 200)}\nComment:\n${content.slice(0, 2_000)}`,
    }], 20)
    if (answer === null) return
    if (!/^\s*spam\b/i.test(answer)) return

    await softDeleteComment(id)
    void logActivity('comment.delete', `spam-guard #${id}`)
  } catch (error) {
    console.error(`[ERROR] comment-guard: ${(error as Error).message}`)
  }
}
