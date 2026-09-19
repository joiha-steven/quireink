// The glyph and the ink an ACTIVITY FEED row wears.
//
// Moved out of `ActivityFeed.tsx` when the dashboard became a page (ADR 0054).
//
// ⚠️ THIS IS NOT `glyphOf`, AND THE DIFFERENCE IS DELIBERATE ON BOTH SIDES. `log-sentence.ts`
// maps an action to one of seven KINDS and gives each kind a glyph, because on the Log screen
// the glyph and the kind filter beside it are the same seven things: a row's mark tells you
// which filter would keep it. Here the verb is checked FIRST, so `post.delete` is a bin rather
// than a page — what the eye wants from a feed is the shape of what happened, and "something
// was thrown away" is the shape worth finding fastest.
//
// The consequence is real and is left standing on purpose: one event can wear two glyphs on
// two screens. Unifying them would mean deciding which of the two arguments is wrong, and
// neither is, so that is a design question rather than a port.
import type { IconName } from '@/icons'

/**
 * The mark for an action. A DELETE is a delete first and a post second.
 */
export function markFor(action: string): IconName {
  if (action === 'error') return 'help'
  if (action.endsWith('.delete') || action.startsWith('trash.')) return 'trash'
  const subject = action.split('.')[0] ?? ''
  const marks: Record<string, IconName> = {
    post: 'page', page: 'page', file: 'page',
    media: 'image', icon: 'image', font: 'image',
    comment: 'comment',
    newsletter: 'mail', mail: 'mail', subscriber: 'mail', ap: 'mail',
    settings: 'settings', auth: 'settings', mcp: 'settings',
    cache: 'cache',
    backup: 'download', import: 'download',
    redirect: 'link', series: 'link',
  }
  return marks[subject] ?? 'log'
}

/**
 * The one place this feed spends a colour.
 *
 * `--pen-red` is the admin's destructive ink and nothing else uses it, so a bin drawn in it
 * answers "did I throw anything away this week?" from across the room — which is the question
 * a log gets asked most and the one that used to need reading every row to answer.
 */
export const inkFor = (action: string): string =>
  action.endsWith('.delete') || action.startsWith('trash.')
    ? 'text-[var(--pen-red)]'
    : 'text-neutral-500 dark:text-neutral-400'

/** The 28px tile the mark sits in. */
export const FEED_MARK =
  'mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-neutral-100 '
  + 'ring-1 ring-inset ring-black/[.06] '
  + 'dark:bg-neutral-800 dark:ring-white/10'

/**
 * TWO COLUMNS on a wide screen, with a RULE between them, and the emptiness is what forces it
 * rather than a wish for density: rows of ~300px across a 1400px band leave a card
 * three-quarters air, and a gap alone strands each column's text at the left of its own half.
 */
export const FEED_LIST = 'grid xl:grid-cols-2'
export const FEED_ROW =
  'flex min-w-0 items-start gap-3 border-b border-neutral-100 py-2.5 last:border-b-0'
  + ' dark:border-neutral-800 xl:[&:nth-last-child(-n+2)]:border-b-0 xl:[&:nth-child(odd)]:border-r'
  + ' xl:[&:nth-child(odd)]:pr-8 xl:[&:nth-child(even)]:pl-8'
  + ' xl:[&:nth-child(odd)]:border-r-neutral-100 dark:xl:[&:nth-child(odd)]:border-r-neutral-800'
