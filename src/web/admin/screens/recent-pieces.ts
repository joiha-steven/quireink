// THE PIECES TOUCHED LAST, offered where a screen has nothing of its own to show.
//
// Two screens were dead ends on 2026-09-07. The 404 printed the number and one link back to
// Home; the empty Write sheet printed one grey sentence and two buttons that both start
// something NEW — offered to somebody who, arriving at that screen, most often means to reopen
// what they were writing yesterday. A dead end is the place a link is worth most, and the thing
// worth linking to is already known.
//
// ONE implementation, because there were two: `RecentPieces.tsx` sorted the pieces again in the
// browser while `content.ts` took the top of the list the write column had already sorted. Two
// sorts is two answers to "what did I touch last", and nothing would have reported the day they
// disagreed.
import type { AdminStrings } from '@/i18n/admin-i18n'
import { escapeAttr, escapeHtml } from '@/utils'
import { formatDateTimeShort } from '@/admin-shared/when'
import { UTIL } from '@/admin-shared/scale'
import type { WriteItem } from '@/web/admin/screens/content-items'

export function recentPieces(items: WriteItem[], t: AdminStrings, limit = 3): string {
  const shown = items.filter((it) => it.touched > 0).slice(0, limit)
  // Nothing written yet: draw NOTHING. A heading over an empty list, on a screen whose whole
  // message is "there is nothing here", is a second empty state inside the first one.
  if (shown.length === 0) return ''
  return `<div class="mt-8 w-full max-w-sm text-left">`
    + `<p class="${escapeAttr(UTIL)}">${escapeHtml(t.recentlyEdited)}</p>`
    + `<ul class="mt-1.5">`
    + shown.map((it) =>
      `<li class="border-b border-neutral-100 last:border-0 dark:border-neutral-800">`
      // `py-3` and not `py-2`: 20px of line plus 24px of padding is 44, which is the floor a
      // finger needs. A 36px row here would put new sub-44 targets on the one screen a phone
      // reaches by mistyping an address.
      + `<a href="${escapeAttr(it.editHref)}" class="-mx-2 flex items-baseline justify-between`
      + ` gap-3 rounded px-2 py-3 transition hover:bg-neutral-100/70 dark:hover:bg-neutral-800/50">`
      + `<span class="min-w-0 truncate text-sm text-neutral-800 dark:text-neutral-200">`
      + `${escapeHtml(it.title || `${t.untitled} #${it.untitledNo ?? 1}`)}</span>`
      + `<span class="shrink-0 text-xs tabular-nums text-neutral-500 dark:text-neutral-400">`
      + `${escapeHtml(formatDateTimeShort(it.touched))}</span>`
      + `</a></li>`).join('')
    + `</ul></div>`
}
