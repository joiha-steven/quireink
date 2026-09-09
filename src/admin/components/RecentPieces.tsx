// The three pieces touched last, offered where a screen has nothing of its own to show.
//
// Two screens were dead ends on 2026-09-07. The 404 printed the number and one link back to
// Home; the empty Write sheet printed one grey sentence and two buttons that both start
// something NEW — offered to somebody who, arriving at that screen, most often means to
// reopen what they were writing yesterday. A dead end is the place a link is worth most, and
// the thing worth linking to is already known: the pane beside it sorts everything written
// by last touch, and this takes the top of that same list.
//
// It reads `useWritingItems` rather than sorting again, so the row at the top here is the row
// at the top there — a second sort would be a second answer to "what did I touch last".
import Link from '@/admin/router'
import { useView } from '@/admin/useView'
import { formatDateTimeShort } from '@/utils'
import { useAdminT } from './I18nProvider'
import { UTIL } from './scale'
import { useWritingItems } from './useWritingItems'

export function RecentPieces({ limit = 3 }: { limit?: number }) {
  const t = useAdminT()
  const { data } = useView('content')
  const { items } = useWritingItems(data?.posts ?? [], data?.pages ?? [], data?.notes ?? [], '', 'all', 'updated')
  const shown = items.slice(0, limit)
  // Nothing written yet, or the list has not arrived: draw NOTHING. A heading over an empty
  // list on a screen whose whole message is "there is nothing here" is a second empty state
  // inside the first one.
  if (shown.length === 0) return null
  return (
    <div className="mt-8 w-full max-w-sm text-left">
      <p className={UTIL}>{t.recentlyEdited}</p>
      <ul className="mt-1.5">
        {shown.map((it) => (
          <li key={`${it.kind}:${it.slug}`} className="border-b border-neutral-100 last:border-0 dark:border-neutral-800">
            <Link
              href={it.editHref}
              // py-3 and not py-2: 20px of line plus 24px of padding is 44, which is the
              // floor a finger needs. A 36px row here would put new sub-44 targets on the
              // one screen a phone reaches by mistyping an address.
              className="-mx-2 flex items-baseline justify-between gap-3 rounded px-2 py-3 transition hover:bg-neutral-100/70 dark:hover:bg-neutral-800/50"
            >
              <span className="min-w-0 truncate text-sm text-neutral-800 dark:text-neutral-200">
                {it.title || `${t.untitled} #${it.untitledNo ?? 1}`}
              </span>
              {/* Guarded: `touched` is 0 for a piece carrying no date at all, and an
                  unguarded format prints 1/1/70 beside its title. */}
              {it.touched > 0 && (
                <span className="shrink-0 text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
                  {formatDateTimeShort(new Date(it.touched).toISOString())}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
