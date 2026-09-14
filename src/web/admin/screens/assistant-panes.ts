// The two columns beside the conversation: the chats on the left, the raw record on the right.
//
// Both ship drawn. The left one was fetched on mount in the React face, so the column stood
// empty for one round trip every time the screen opened; it comes with the page now, which is
// the whole point of ADR 0054.
import type { AdminStrings } from '@/i18n/admin-i18n'
import { escapeHtml } from '@/utils'
import { META } from '@/admin-shared/scale'
import { SHEET_TOOL } from '@/admin-shared/kit'
import { chatRowMark, logMarks, type AssistantWords, type ChatRow } from '@/admin-shared/assistant-marks'
import type { Turn } from '@/admin-shared/assistant'
import { htmlOf } from '@/web/admin/mark-html'

const PANE = 'hidden w-72 shrink-0 flex-col self-start overflow-hidden rounded-[10px]'
  + ' border border-neutral-200/80 bg-neutral-50 xl:sticky xl:top-0 xl:flex'
  + ' xl:max-h-[calc(100dvh-1.5rem)] dark:border-neutral-800 dark:bg-neutral-950'

/**
 * The conversations, in the column the writing screen taught this admin to expect.
 *
 * Same frame, same ground, same "you are here" as `WritePane`: a second list idiom on the
 * screen next door is the drift `docs/admin-design.md` calls "one of each", and the owner has
 * already learned to read this one.
 *
 * It draws no transcript. A column of forty chats holding forty transcripts is forty
 * transcripts read to render forty titles, which is why the list query sends none.
 *
 * ⚠️ "New conversation" is a LINK to the bare address, not a button that inserts a row. The
 * React face posted a chat the moment it was pressed, so pressing it three times left three
 * empty conversations in the list and in the database. A question already opens a chat for
 * itself when there is none (`island/assistant.ts`), so the empty row was never needed.
 */
export function chatPane(t: AdminStrings, w: AssistantWords, chats: ChatRow[], activeId: number | null): string {
  const rows = chats.map((c) => htmlOf(chatRowMark(c, activeId, w))).join('')
  return `<aside class="${PANE}" data-ai-pane>`
    + `<div class="flex items-center justify-between gap-2 px-4 pb-2 pt-4">`
    + `<span class="${META}">${escapeHtml(t.assistantChats)}</span>`
    + `<a href="/admin/assistant" class="${SHEET_TOOL}">${escapeHtml(t.assistantNew)}</a>`
    + `</div>`
    + `<div class="min-h-0 flex-1 overflow-y-auto">`
    + `<p class="px-4 py-3 text-sm text-neutral-500 dark:text-neutral-400" data-ai-no-chats`
    + `${chats.length === 0 ? '' : ' hidden'}>${escapeHtml(t.assistantNoChats)}</p>`
    + `<ul data-ai-chats>${rows}</ul>`
    + `</div></aside>`
}

const LOG = 'hidden w-80 shrink-0 flex-col self-stretch overflow-hidden border-l border-neutral-200'
  + ' min-[1600px]:flex dark:border-neutral-800'

/**
 * WHAT IT ACTUALLY DID, unedited.
 *
 * The transcript shows the answer and a chip per tool. That is the right amount for reading,
 * and the wrong amount for trusting: an owner who has just let a model change settings on
 * their live blog is entitled to see the call, the arguments and the result exactly as they
 * went across, not a summary the same model wrote of its own work.
 *
 * DEFAULT OPEN, and it stays how it was left. A record you have to go and find is a record
 * most people never look at, so shutting it is the decision that persists — read back from
 * storage by the island, which is also the only thing that can know what this browser chose.
 */
export function toolLog(t: AdminStrings, w: AssistantWords, turns: Turn[]): string {
  const entries = logMarks(turns, w)
  return `<aside class="${LOG}" data-ai-log>`
    + `<div class="border-b border-neutral-200 px-4 py-2.5 dark:border-neutral-800">`
    + `<span class="${META}">${escapeHtml(t.assistantDidThis)}</span></div>`
    + `<div class="min-h-0 flex-1 overflow-y-auto px-4 py-3">`
    + `<p class="${META}" data-ai-log-empty${entries.length === 0 ? '' : ' hidden'}>`
    + `${escapeHtml(t.assistantDidNothing)}</p>`
    + `<ol class="space-y-4" data-ai-log-list>${htmlOf(entries)}</ol>`
    + `</div></aside>`
}
