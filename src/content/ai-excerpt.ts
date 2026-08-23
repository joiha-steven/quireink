// The excerpt job: when a post is published with its excerpt left blank, ask the plugged
// model for a real one — in the site's language — instead of settling for the first
// fifty words.
//
// The hook fires from `savePost` ONLY when the AUTHOR'S field was blank (normalize()
// fills a mechanical fallback before the row is written, so blankness is a fact only
// the save path ever sees). The write-back is guarded by "excerpt is still exactly that
// mechanical fallback": if the owner typed anything in the meantime, the machine lost
// the race on purpose. Same posture as alt text — fill absences, never overrule people.

import { run } from '@/store/query'
import { getSettings } from '@/content/settings'
import { getIntegrationKeys } from '@/store/integration-keys'
import { ask } from '@/server/ai-provider'
import { languageName } from '@/media/alt-text'
import { clearCache } from '@/server/cache'
import { logActivity } from '@/server/activity'

// Enough body for a faithful summary; whole books are not.
const BODY_CAP = 8_000

export async function writeExcerpt(slug: string, mechanical: string, content: string): Promise<void> {
  try {
    const keys = await getIntegrationKeys()
    if (!keys.aiProvider || !keys.aiApiKey) return
    const { language, ai, excerptLength } = await getSettings()
    if (!ai.excerpt) return

    const answer = await ask([{
      text: `Write the excerpt for this blog post in ${languageName(language)}: one or two plain sentences, at most ${Math.max(30, excerptLength)} words, in the author's tone, no quotation marks, no "this post". Answer with the excerpt only.\n\n---\n\n${content.slice(0, BODY_CAP)}`,
    }], 500)
    if (!answer) return

    // Only while the row still carries the mechanical fallback — the author winning any
    // race here is the point of the guard, not an inconvenience.
    run(
      `update posts set excerpt = $answer where slug = $slug and excerpt = $mechanical and deleted_at is null`,
      { answer, slug, mechanical },
    )
    clearCache()
    void logActivity('post.update', `excerpt: ${slug}`)
  } catch (error) {
    console.error(`[ERROR] ai-excerpt: ${(error as Error).message}`)
  }
}
