// WHAT ONE EXCHANGE, ONE LOG ENTRY AND ONE CHAT ROW LOOK LIKE — written once, for both faces.
//
// The shape of an exchange, and why: the QUESTION is framed and the ANSWER is not. A
// transcript is read by scanning for where each exchange begins, and marking both sides makes
// the eye read two marks to find one boundary. So one side gets an edge and the other gets the
// page — and the reply needs no name, because on this screen nothing else could have written
// it. Not a bubble chat: rounded fills on alternating sides is the costume
// `docs/admin-design.md` rejects on sight.
//
// ⚠️ EVERY STATE IS ALWAYS DRAWN (`docs/admin-one-dom.md`). The pause, the waiting line, the
// streaming line and the cost are in the markup whether or not they apply, hidden when they do
// not, because the island has to be able to show one without building it — a delta arrives
// forty times a second and must not construct an element each time.
import { el, leaf, txt, type Mark } from '@/admin-shared/markup'
import { META } from '@/admin-shared/scale'
import { buttonClass, SHEET_TOOL } from '@/admin-shared/kit'
import { richMarks } from '@/admin-shared/rich-text'
import { formatDateTimeShort } from '@/admin-shared/when'
import {
  argsJson, blocksOf, clock, entriesOf, foldMarks, jsonMarks, tokens,
  type Block, type Entry, type Pending, type Turn,
} from '@/admin-shared/assistant'

/** Everything the island can have to SAY after the first paint, and nothing it cannot. */
export type AssistantWords = {
  busy: string; send: string; failed: string; notConfigured: string
  wants: string; afterReaders: string; allow: string; deny: string
  tokensLabel: string; context: string
  showAll: string; close: string
  untitled: string; noChats: string; deleteOne: string; deleteYes: string
  didNothing: string
}

const ASKED = 'rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm leading-relaxed'
  + ' font-medium whitespace-pre-wrap text-neutral-900 dark:border-neutral-800 dark:bg-neutral-900'
  + ' dark:text-neutral-100'

const ANSWER = 'mt-4 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300'

export const CHIP = 'inline-flex items-center rounded-full border border-neutral-200 px-2.5 py-0.5'
  + ' text-xs text-neutral-500 dark:border-neutral-700 dark:text-neutral-400'

const ASK_BOX = 'mt-4 rounded-lg border border-amber-300 bg-amber-50/60 p-3'
  + ' dark:border-amber-800/60 dark:bg-amber-950/20'

const PENDING_ROW = 'font-mono text-xs break-all text-neutral-800 dark:text-neutral-200'

const DOT = 'inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-400 dark:bg-neutral-500'
const CARET = 'ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-neutral-400 align-text-bottom'
  + ' dark:bg-neutral-500'

const off = (on: boolean): Record<string, string> => (on ? {} : { hidden: '' })

/**
 * THE PAUSE, drawn where the answer would be.
 *
 * Not a modal: a dialog over the transcript hides the sentence that explains what is about to
 * happen, and the arguments below are the whole basis for saying yes. Nothing runs until one of
 * these is pressed. Amber, because this is the admin's one "look at this" ink and nothing has
 * been destroyed yet — red is reserved for what does the destroying.
 */
function askMark(awaiting: Pending[], w: AssistantWords): Mark {
  const rows = awaiting.map((a) => el('li', PENDING_ROW, [
    txt(`${a.name} `),
    leaf('span', 'text-neutral-500 dark:text-neutral-400', argsJson(a.args)),
  ]))
  return el('div', ASK_BOX, [
    leaf('p', META, w.wants),
    // Said only when the pause is the second kind: an ordinary edit stopped because readers'
    // words are in the conversation. The listed kind needs no explanation beyond the call.
    leaf('p', `${META} mt-1`, w.afterReaders, off(awaiting.some((a) => a.reason === 'untrusted'))),
    el('ul', 'mt-1.5 space-y-1', rows, { 'data-ai-pending': '' }),
    el('div', 'mt-3 flex items-center gap-2', [
      leaf('button', buttonClass('secondary'), w.allow, { type: 'button', 'data-ai-allow': '' }),
      leaf('button', buttonClass('secondary'), w.deny, { type: 'button', 'data-ai-deny': '' }),
    ]),
  ], { 'data-ai-ask': '', ...off(awaiting.length > 0) })
}

export type ExchangeState = {
  cost?: { input: number; output: number }
  awaiting?: Pending[]
  live?: string
  waiting?: boolean
}

/** One question and everything that came back for it. */
export function exchangeMark(block: Block, w: AssistantWords, state: ExchangeState = {}): Mark {
  const said = block.parts.filter((p) => p.kind === 'assistant')
  const used = block.parts.filter((p) => p.kind === 'tool_use')
  const awaiting = state.awaiting ?? []
  const live = state.live ?? ''
  const cost = state.cost

  const kids: Mark[] = [leaf('p', ASKED, block.question)]
  for (const p of said) kids.push(el('div', ANSWER, richMarks(p.kind === 'assistant' ? p.text : '')))
  kids.push(askMark(awaiting, w))

  // Waiting, in the place the answer will appear rather than on the button: the eye is already
  // here, and a composer that says "working" while the page says nothing looks broken.
  const waiting = Boolean(state.waiting) && live === '' && said.length === 0 && awaiting.length === 0
  kids.push(el('p', `${ANSWER} flex items-center gap-2`, [
    el('span', DOT, []),
    leaf('span', META, w.busy),
  ], { 'data-ai-wait': '', ...off(waiting) }))

  // The answer still arriving, drawn by the same renderer: a mark that has not closed yet
  // stays literal, so nothing flickers as it lands.
  kids.push(el('div', ANSWER, [
    el('span', '', richMarks(live), { 'data-ai-live-text': '' }),
    el('span', CARET, []),
  ], { 'data-ai-live': '', ...off(live !== '') }))

  // What it touched and what it cost, on one quiet row. The cost is known only for an exchange
  // this tab watched happen: a transcript reopened from the database shows the chips and no
  // number, which is honest where a figure reconstructed from the total would not be.
  kids.push(el('div', 'mt-3 flex flex-wrap items-center gap-1.5', [
    ...used.map((p) => leaf('span', CHIP, p.kind === 'tool_use' ? p.name : '')),
    leaf('span', `${META} tabular-nums`,
      cost ? `${tokens(cost.input + cost.output)} ${w.tokensLabel}` : '',
      { 'data-ai-cost': '', ...off(Boolean(cost)) }),
  ], { 'data-ai-foot': '', ...off(used.length > 0 || Boolean(cost)) }))

  return el('li', 'pt-9 first:pt-0', kids, { 'data-ai-block': '' })
}

/** The whole transcript, as the list the sheet scrolls. */
export const blockMarks = (turns: Turn[], w: AssistantWords, last: ExchangeState = {}): Mark[] => {
  const blocks = blocksOf(turns)
  return blocks.map((b, i) => exchangeMark(b, w, i === blocks.length - 1 ? last : {}))
}

const LOG_NAME = 'font-mono text-xs text-neutral-900 dark:text-neutral-100'
const PRE = 'mt-1 whitespace-pre-wrap break-all font-mono text-xs leading-relaxed'

/**
 * One call and the answer that came back to it, RAW.
 *
 * Everything else in this admin is edited for reading; this is the one surface where editing
 * would be the bug. An owner who has just let a model change settings on their live blog is
 * entitled to see the call, the arguments and the result exactly as they went across.
 */
export function logEntryMark(e: Entry, w: AssistantWords): Mark {
  const kids: Mark[] = [
    el('p', 'flex items-baseline gap-2', [
      leaf('span', `${META} tabular-nums`, clock(e.at), { 'data-ai-clock': String(e.at ?? '') }),
      leaf('span', LOG_NAME, e.name),
    ]),
    el('pre', PRE, jsonMarks(argsJson(e.args))),
  ]
  if (e.result !== undefined) {
    const { head, tail } = foldMarks(e.result)
    kids.push(el('pre', PRE, [
      ...head,
      leaf('span', 'text-neutral-400 dark:text-neutral-500', '…', { 'data-ai-ell': '', ...off(tail.length > 0) }),
      el('span', '', tail, { 'data-ai-tail': '', hidden: '' }),
    ]))
    if (tail.length > 0) {
      kids.push(leaf('button', `${META} underline`, w.showAll, { type: 'button', 'data-ai-fold': '' }))
    }
  }
  return el('li', '', kids)
}

export const logMarks = (turns: Turn[], w: AssistantWords): Mark[] =>
  entriesOf(turns).map((e) => logEntryMark(e, w))

const ROW_OPEN = 'bg-white shadow-[inset_0_2px_3px_rgba(0,0,0,.14)]'
  + ' dark:bg-neutral-900 dark:shadow-[inset_0_2px_3px_rgba(0,0,0,.5)]'

const ROW_TITLE_ON = 'block truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100'
const ROW_TITLE_OFF = 'block truncate text-sm text-neutral-700 dark:text-neutral-300'

const ROW_X = 'absolute right-2 top-2 rounded p-1 text-neutral-400 opacity-0 transition'
  + ' hover:text-neutral-700 focus:opacity-100 dark:hover:text-neutral-200 [li:hover_&]:opacity-100'

export type ChatRow = { id: number; title: string; updatedAt: string; context: number }

/**
 * One conversation in the left column.
 *
 * A real link, which it was not in the React face: the chat is in the ADDRESS now, so a reload
 * reopens the conversation you were reading and the browser's Back walks the chats you opened.
 * The open one is a key held down — carved on the paper ground, same as the write pane's open
 * piece. An inset shifts no text.
 */
export function chatRowMark(c: ChatRow, activeId: number | null, w: AssistantWords): Mark {
  const active = c.id === activeId
  const meta: Mark[] = [leaf('span', '', formatDateTimeShort(c.updatedAt))]
  if (c.context > 0) meta.push(leaf('span', 'tabular-nums', tokens(c.context)))

  return el('li', 'relative border-b border-neutral-100 dark:border-neutral-800', [
    el('a', `block w-full px-4 py-3 text-left ${active ? ROW_OPEN : ''}`.trim(), [
      leaf('span', active ? ROW_TITLE_ON : ROW_TITLE_OFF, c.title || w.untitled),
      el('span', `mt-0.5 flex items-center gap-2 ${META}`, meta),
    ], { href: `/admin/assistant?chat=${c.id}` }),
    // Confirm in place rather than in a dialog: a chat is small enough that a modal asking
    // about it is heavier than the thing it is protecting.
    el('span', 'flex items-center gap-2 px-4 pb-3', [
      leaf('button', SHEET_TOOL, w.deleteYes, { type: 'button', 'data-ai-del-yes': '' }),
      leaf('button', SHEET_TOOL, w.close, { type: 'button', 'data-ai-del-no': '' }),
    ], { 'data-ai-confirm': '' }),
    el('button', ROW_X, [
      el('svg', '', [leaf('path', '', '', { d: 'M6 6l12 12M18 6L6 18', 'stroke-linecap': 'round' })], {
        width: '14', height: '14', viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', 'stroke-width': '2', 'aria-hidden': 'true',
      }),
    ], { type: 'button', 'aria-label': w.deleteOne, 'data-ai-del': '' }),
  ], { 'data-ai-chat': String(c.id) })
}
