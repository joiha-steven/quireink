// THE TIME MACHINE: the last few versions of a post that were overwritten.
//
// Its FRAME is drawn here and hidden, because every word in it is fixed — the title, the
// sentence explaining what restoring does, the two things it can say when there is nothing to
// list. Only the ROWS are built in the browser, and only when somebody opens it: they are
// fetched from `/api/posts/:slug/revisions`, they change with every save, and there is no
// honest way to have them in the markup.
//
// A post's alone. Pages and notes keep no revisions, so neither gets the door.
import type { AdminStrings } from '@/i18n/admin-i18n'
import { escapeHtml } from '@/utils'
import { buttonClass, OVERLAY } from '@/admin-shared/kit'

const QUIET_CENTRE = 'py-10 text-center text-neutral-500 dark:text-neutral-400'

export function historyDialog(t: AdminStrings): string {
  return `<div data-history hidden class="fixed inset-0 z-50 flex items-center justify-center`
    + ` bg-black/40 p-4">`
    + `<div data-history-box role="dialog" aria-modal="true"`
    + ` aria-label="${escapeHtml(t.timeMachine)}"`
    + ` class="flex max-h-[85vh] w-full max-w-2xl flex-col p-5 ${OVERLAY}">`
    + `<div class="mb-1 flex items-center justify-between">`
    + `<h2 class="text-lg font-bold">${escapeHtml(t.timeMachine)}</h2>`
    + `<button type="button" data-history-shut class="${buttonClass('ghost')}">`
    + `${escapeHtml(t.close)}</button>`
    + `</div>`
    + `<p class="mb-4 text-sm text-neutral-500 dark:text-neutral-400">${escapeHtml(t.tmIntro)}</p>`
    + `<div class="overflow-y-auto">`
    // Three states, all three drawn: fetching, nothing to show, and the list.
    + `<p data-history-wait class="${QUIET_CENTRE}">${escapeHtml(t.loading)}</p>`
    + `<p data-history-none hidden class="${QUIET_CENTRE}">${escapeHtml(t.tmEmpty)}</p>`
    + `<ul data-history-list hidden class="space-y-3"></ul>`
    + `</div></div></div>`
}
