// What a recorded action SAYS, and which glyph opens the line.
//
// The log printed its machine codes: `post.create`, `newsletter.send`, `mcp.token.delete`,
// forty of them, each in a grey chip beside a raw detail string. That is the database's own
// vocabulary shown to the person the log is for — and the one screen in this admin whose
// entire job is to be read was the one written in a language nobody speaks.
//
// The sentence comes from the dictionary (`logActions`), so it is translated with everything
// else; the code stays reachable in the row's `title`, because somebody debugging an install
// needs it and it costs nothing to keep.
import type { AdminStrings } from '@/locales/types'
import type { IconName } from '@/icons'

/**
 * The KIND an action belongs to, which is what the filter offers.
 *
 * Seven, from forty codes, and the grouping is by what the owner would go looking for rather
 * than by which module wrote the row: "what happened to my writing" is one question whether
 * the row says `post.update` or `page.delete`.
 */
export type LogKind = 'writing' | 'media' | 'people' | 'settings' | 'system' | 'security' | 'error'

const KIND_OF: Record<string, LogKind> = {
  post: 'writing', page: 'writing', series: 'writing',
  media: 'media', file: 'media', font: 'media', icon: 'media', import: 'media',
  comment: 'people', subscriber: 'people', newsletter: 'people', mail: 'people',
  settings: 'settings', redirect: 'settings',
  cache: 'system', backup: 'system', mcp: 'system',
  security: 'security',
  error: 'error',
}

const GLYPH: Record<LogKind, IconName> = {
  writing: 'page',
  media: 'image',
  people: 'comment',
  settings: 'settings',
  system: 'cache',
  security: 'check',
  error: 'close',
}

/** The family an action belongs to — its code up to the first dot. */
export const kindOf = (action: string): LogKind => KIND_OF[action.split('.')[0] ?? ''] ?? 'system'

export const glyphOf = (action: string): IconName => GLYPH[kindOf(action)]

/**
 * The sentence for one entry.
 *
 * Falls back to `code — detail` for an action the dictionary has not been told about, which
 * is visible and honest rather than blank: a release that adds a logged action and forgets
 * this file should print something a person can still read.
 */
export function logSentence(t: AdminStrings, action: string, detail: string): string {
  const pattern = t.logActions[action]
  if (!pattern) return detail ? `${action} — ${detail}` : action
  // A detail can be long (a settings diff, an error message); the row truncates, and the
  // full text stays in the row's `title`.
  if (detail) return pattern.replace('{t}', detail)
  /**
   * ⚠️ NO OBJECT MEANS NO PUNCTUATION FOR ONE. Rows written before the log recorded a detail
   * — and `settings.save` when nothing named itself — reached this with an empty string, and
   * the first cut substituted an em-dash: "Changed settings: —", "Wrote “—”". A sentence with
   * a hole in it reads worse than a shorter sentence.
   *
   * The quotes and the separator go with the placeholder, in every language's own marks, and
   * a trailing colon or dash goes with them. What is left is the verb, which is the part that
   * was always doing the work.
   */
  return pattern
    .replace(/\s*[“"«„「(]?\{t\}[”"»「)』]?/u, '')
    .replace(/[\s:—·-]+$/u, '')
    .trim()
}
