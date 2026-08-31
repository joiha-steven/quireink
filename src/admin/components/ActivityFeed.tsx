// The home page's recent-activity card, as a FEED rather than as a sparse table.
//
// It was three columns of plain text — a dotted machine key, a detail, a timestamp — laid on
// a 1400px band, and it read as a spreadsheet with the numbers taken out. Two rounds of
// reports called it empty. The first answer, on 2026-08-15, was to halve its width; the
// second, on 2026-08-31, was to record what a settings save actually changed, because the
// widest column was blank on most rows. Both were true and neither was the layout.
//
// What a feed needs is a way to tell one line from the next WITHOUT reading it. So:
//
//   · a mark per kind of event, from the admin's own icon set — a picture, a page, an
//     envelope, a bin. The eye finds "somebody deleted something" before it reads a word.
//   · what happened on the first line and the machine key demoted under it. The detail is
//     the sentence; the action is the filing.
//   · "2 hours ago" rather than 31/8/26 - 23:31, because a feed is read for recency and an
//     exact stamp is a lookup. The stamp is still there, in the row's title.
//   · the time set with the filing rather than pinned to the far edge. Right-aligning it
//     across a 700px column opened a canyon between two short strings, and on a row whose
//     detail is empty — every entry written before the log started recording one — the row
//     was a word at one end, a date at the other, and nothing in between. A block of text
//     that ends where it ends reads as content; two things pushed apart read as a gap.
//
// `Intl.RelativeTimeFormat` does the words, so this adds no strings to eleven dictionaries
// and says "2 giờ trước" to an owner working in Vietnamese without anyone translating it.
import type { ActivityEntry } from '@/server/activity'
import type { IconName } from '@/icons'
import { formatDateTimeShort } from '@/utils'
import { SharedGlyph } from './navIcons'

/**
 * The mark for an action.
 *
 * A DELETE is a delete first and a post second: what the eye wants from a log is the shape of
 * what happened, and "something was thrown away" is the shape worth finding fastest. So the
 * verb is checked before the subject.
 */
function markFor(action: string): IconName {
  if (action === 'error') return 'help'
  if (action.endsWith('.delete') || action.startsWith('trash.')) return 'trash'
  const subject = action.split('.')[0] ?? ''
  const marks: Record<string, IconName> = {
    post: 'page', page: 'page', file: 'page',
    media: 'image', icon: 'image', font: 'image',
    comment: 'comment',
    newsletter: 'mail', mail: 'mail', subscriber: 'mail',
    settings: 'settings', auth: 'settings', mcp: 'settings',
    cache: 'cache',
    backup: 'download', import: 'download',
    redirect: 'link', series: 'link',
  }
  return marks[subject] ?? 'log'
}

/**
 * "2 hours ago", in the admin's language, with no dictionary entry to keep in step.
 *
 * Falls back to the short stamp rather than to nothing: an engine without
 * `RelativeTimeFormat` should still be told when something happened.
 */
function ago(at: string, now: number): string {
  const then = Date.parse(at)
  if (Number.isNaN(then)) return ''
  const minutes = Math.round((then - now) / 60_000)
  const lang = typeof document !== 'undefined' ? document.documentElement.lang || 'en' : 'en'
  try {
    const fmt = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' })
    if (Math.abs(minutes) < 60) return fmt.format(Math.min(minutes, -1), 'minute')
    if (Math.abs(minutes) < 60 * 48) return fmt.format(Math.round(minutes / 60), 'hour')
    if (Math.abs(minutes) < 60 * 24 * 14) return fmt.format(Math.round(minutes / 1440), 'day')
    return fmt.format(Math.round(minutes / (1440 * 7)), 'week')
  } catch {
    return formatDateTimeShort(at)
  }
}

const MARK =
  'mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-neutral-100 '
  + 'ring-1 ring-inset ring-black/[.06] '
  + 'dark:bg-neutral-800 dark:ring-white/10'

/**
 * The one place this feed spends a colour.
 *
 * `--pen-red` is the admin's destructive ink and nothing else uses it, so a bin drawn in it
 * answers "did I throw anything away this week?" from across the room — which is the question
 * a log gets asked most and the one that used to need reading every row to answer.
 */
const inkFor = (action: string): string =>
  action.endsWith('.delete') || action.startsWith('trash.')
    ? 'text-[var(--pen-red)]'
    : 'text-neutral-500 dark:text-neutral-400'

export function ActivityFeed({ entries, limit = 10 }: { entries: ActivityEntry[]; limit?: number }) {
  // ONE clock for the whole list, read at render: eight rows each calling `Date.now()` can
  // straddle a minute boundary and print two different answers for the same instant.
  const now = Date.now()
  return (
    // TWO COLUMNS on a wide screen, and it is the emptiness that forces it rather than a
    // wish for density: rows of ~300px across a 1400px band leave a card three-quarters air.
    //
    // The RULE between them is the other half of that. A gap alone leaves each column's text
    // stranded at the left of its own half and the card reads as one wide box with the
    // writing pushed into a corner; a hairline down the middle says the empty half is a
    // column, which is how every ruled page in this product handles the same problem. The
    // grid fills row-major, so the odd children are the left column and their right edges
    // line up into one continuous line.
    <ul className="grid xl:grid-cols-2">
      {entries.slice(0, limit).map((entry) => (
        <li
          key={entry.id}
          className="flex items-start gap-3 border-b border-neutral-100 py-2.5 last:border-b-0 dark:border-neutral-800 xl:[&:nth-last-child(-n+2)]:border-b-0 xl:[&:nth-child(odd)]:border-r xl:[&:nth-child(odd)]:pr-8 xl:[&:nth-child(even)]:pl-8 xl:[&:nth-child(odd)]:border-r-neutral-100 dark:xl:[&:nth-child(odd)]:border-r-neutral-800"
          title={formatDateTimeShort(entry.at)}
        >
          <span className={`${MARK} ${inkFor(entry.action)}`}>
            <svg
              viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor"
              strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden
            >
              <SharedGlyph name={markFor(entry.action)} />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            {/* The detail is the sentence. An action with none — `cache.clear` says
                everything in its own name, and so does every row written before the log
                began recording one — takes the top line itself rather than leaving it
                blank above its own filing. */}
            <p
              className={`truncate text-sm ${
                entry.action === 'error'
                  ? 'font-medium text-neutral-900 dark:text-white'
                  : 'text-neutral-800 dark:text-neutral-200'
              }`}
            >
              {entry.detail || entry.action}
            </p>
            <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
              {entry.detail && <>{entry.action} <span className="text-neutral-300 dark:text-neutral-600">·</span> </>}
              {ago(entry.at, now)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}
