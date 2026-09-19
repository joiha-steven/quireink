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

/**
 * EVERY FAMILY, and a family missing from here does not fail — it lands in 'system'.
 *
 * Which is a quiet wrong answer twice over: the row wears the cache glyph, and the screen's
 * own filter files it under the wrong heading, so an owner asking "what happened to my
 * writing" is not shown it. `log-sentence.test.ts` reads the `ActivityAction` union and
 * requires a key here for every family in it.
 *
 * Four were missing when that guard was written on 2026-09-19, and all four had been for a
 * long time: `note` (the whole notebook), `taxonomy`, `trash` — and `auth`, which is every
 * sign-in, every failed sign-in, every wrong authenticator code and every recovery code
 * spent. Those are the rows `activity.ts` says in as many words are the ones an owner most
 * needs to find AFTER the fact, and they were filed under the heading for cache flushes.
 */
export const KIND_OF: Record<string, LogKind> = {
  post: 'writing', page: 'writing', note: 'writing', series: 'writing',
  taxonomy: 'writing',
  // The selection mode acting on several pieces at once, and the bin they land in. Both are
  // answers to "where did my writing go", which is the question this heading is for.
  content: 'writing', trash: 'writing',
  media: 'media', file: 'media', font: 'media', icon: 'media', import: 'media',
  comment: 'people', subscriber: 'people', newsletter: 'people', mail: 'people',
  settings: 'settings', redirect: 'settings',
  // `export` is the Markdown bundle, beside the backup it sits next to in the admin.
  cache: 'system', backup: 'system', mcp: 'system', export: 'system',
  security: 'security', auth: 'security',
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
