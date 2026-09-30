// What a migration cannot decide in SQL, decided once at boot: each function reads only the rows
// its migration marked, so a boot with nothing left to settle reads no post body at all.
import { all, run, tx } from '@/store/query'
import { readingMinutes } from '@/utils'
import { isDerivedExcerpt } from '@/content/posts'

/**
 * Decide, once, whether each post from before migration 020 has a WRITTEN excerpt or a derived
 * one. The migration marks them `-1` because SQL cannot run `deriveExcerpt`; this compares the
 * stored excerpt with what the body derives, under today's and the older rule and at the length
 * set now or the default, and marks a match `1`. Anything else was typed and is marked `0`,
 * which is the safe way to be wrong: a written excerpt is never thrown away. Returns how many it
 * settled; a boot with nothing left to settle reads no body at all.
 */
export function settleExcerptKinds(excerptWords: number): number {
  const rows = all<{ slug: string; excerpt: string | null; content: string }>(
    `select slug, excerpt, content from posts where excerpt_auto = -1`,
  )
  if (rows.length === 0) return 0
  tx(() => {
    for (const row of rows) {
      const excerpt = row.excerpt?.trim() ?? ''
      const auto = excerpt === '' || isDerivedExcerpt(excerpt, row.content, excerptWords)
      run(`update posts set excerpt_auto = ? where slug = ?`, auto ? 1 : 0, row.slug)
    }
  })
  return rows.length
}

/**
 * Reading time for every post from before migration 021, which counted Chinese and Japanese by
 * spaces they do not write: a 775-character post read "1 min" (2026-09-30). The migration marks
 * every row `-1`; this counts each body once under today's rule.
 */
export function settleReadingMinutes(): number {
  const rows = all<{ slug: string; content: string }>(`select slug, content from posts where reading_minutes = -1`)
  if (rows.length === 0) return 0
  tx(() => {
    for (const row of rows) run(`update posts set reading_minutes = ? where slug = ?`, readingMinutes(row.content), row.slug)
  })
  return rows.length
}
