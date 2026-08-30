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
      // THE VOICE IS THE POINT. This text goes out under the owner's name, on their blog
      // and in their feed, so the one thing it must not sound like is a machine describing
      // an article. The em dash is named because it is the tell: models reach for it two or
      // three times a paragraph, and readers have learned to read it as "written by AI".
      text: `Write the excerpt for this blog post in ${languageName(language)}: one or two plain sentences, at most ${Math.max(30, excerptLength)} words.\n`
        + `Write as the author would, in the voice of the post itself. Plain words, ordinary punctuation.\n`
        + `Do NOT use em dashes or en dashes; use a comma, a full stop or a colon instead.\n`
        + `No quotation marks, no "this post", no "in this article", no summarising phrases at all.\n`
        + `Answer with the excerpt only.\n\n***\n\n${content.slice(0, BODY_CAP)}`,
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
