// The assistant, as HTML the server sends (ADR 0054).
//
// ⚠️ THE CONVERSATION IS IN THE ADDRESS NOW, and it was not in the React face. That face opened
// a chat by id rather than routing to it, on purpose: a route change would have swapped the
// page component and taken the column with it, which is the mistake `WritePane` was hoisted out
// of the routed tree to fix. There is no component to swap any more — the server draws the
// page — so the reason is gone, and what is left is the cost of not having it: a reload lost
// the conversation you were reading, and Back left the screen entirely. `?chat=12` fixes both,
// and an id naming no row simply opens the empty screen.
//
// ⚠️ NOTHING ON THIS SCREEN IS A FORM, and every button says `type="button"`. `ui/Button` emits
// a `<button>` with no type, and HTML's default is `submit`: wrap this composer in a form and
// Enter anywhere inside it posts. What that would post is a question to a paid model, which is
// the same class of mistake as the newsletter's send (`screens/newsletter-send.ts`) — the
// difference being only that it costs money rather than being unrecallable.
//
// ⚠️ DRAWING THIS PAGE NEVER ASKS THE MODEL ANYTHING. It reads two booleans, a list of titles
// and at most one stored conversation; `src/server/assistant.ts` is not reachable from here.
import type { SiteSettings } from '@/types'
import type { AdminStrings } from '@/i18n/admin-i18n'
import { adminT } from '@/i18n/admin-i18n'
import { escapeAttr, escapeHtml } from '@/utils'
import { CONTROL, SHEET_FIXED, SHEET_TOOL, buttonClass } from '@/admin-shared/kit'
import { META } from '@/admin-shared/scale'
import { CONTEXT_WARN, tokens } from '@/admin-shared/assistant'
import { CHIP, blockMarks, type AssistantWords } from '@/admin-shared/assistant-marks'
import { emptyState, pageHeader, sheetTop } from '@/web/admin/kit'
import { htmlOf } from '@/web/admin/mark-html'
import { assistantScreenView } from '@/web/admin/views-ai'
import { chatPane, toolLog } from '@/web/admin/screens/assistant-panes'

const AI_SETTINGS = '/admin/settings?tab=server'

/**
 * The words the island can need to SAY, and only those.
 *
 * Everything the empty state says is absent, deliberately: that block is drawn once and hidden
 * rather than rebuilt, so seven more strings would ride in this attribute to be used never.
 * `{tab}` is already filled here — which tab it names does not depend on anything the browser
 * learns later.
 */
function words(t: AdminStrings): AssistantWords {
  const tabbed = (s: string) => s.replace('{tab}', t.tabServer)
  return {
    busy: t.assistantBusy, send: t.assistantSend,
    failed: tabbed(t.assistantFailed), notConfigured: tabbed(t.aiNotConfigured),
    wants: t.assistantWants, afterReaders: t.assistantAfterReaders,
    allow: t.assistantAllow, deny: t.assistantDeny,
    tokensLabel: t.assistantTokens, context: t.assistantContext,
    showAll: t.assistantShowAll, close: t.close,
    untitled: t.assistantUntitled, noChats: t.assistantNoChats,
    deleteOne: t.assistantDelete, deleteYes: t.assistantDeleteYes,
    didNothing: t.assistantDidNothing,
  }
}

/** WHICH model — the one fact the page cannot be honest without. */
function modelLine(t: AdminStrings, w: AssistantWords, configured: boolean, model: string): string {
  if (!configured) return `<a href="${AI_SETTINGS}" class="${SHEET_TOOL}">${escapeHtml(w.notConfigured)}</a>`
  return `<span class="${META}">${escapeHtml(t.assistantModelOn)} `
    + `<span class="text-neutral-700 dark:text-neutral-300">${escapeHtml(model || t.aiProviderOff)}</span></span>`
}

/**
 * HOW BIG THIS CONVERSATION HAS BECOME, which is the number that decides when to start another
 * one. Not a total of what was spent: every question re-sends the whole conversation, so THIS
 * is what the next one pays again. Amber past 60k, where one more question stops being loose
 * change.
 *
 * ⚠️ ONE INK CLASS, NOT TWO. The React face appended the amber to `META`, which already says
 * `text-neutral-500` — two colour utilities of equal weight, and the winner is decided by which
 * one Tailwind emitted first, not by which is written last in the attribute. Measured on
 * 2026-09-14 at 64,200 tokens: `oklch(0.556 0 none)`, i.e. neutral. The one signal that tells
 * the owner a conversation has got expensive had never once appeared.
 */
function contextMeter(w: AssistantWords, context: number): string {
  const ink = context > CONTEXT_WARN
    ? 'text-amber-700 dark:text-amber-500'
    : 'text-neutral-500 dark:text-neutral-400'
  return `<span class="text-xs tabular-nums ${ink}" data-ai-context${context > 0 ? '' : ' hidden'}>`
    + `${escapeHtml(w.context)} <span data-ai-context-n>${escapeHtml(tokens(context))}</span></span>`
}

/**
 * Centred in the sheet rather than pinned to its top corner: with the composer fixed to the
 * bottom edge, an empty state at the top leaves the screen looking like a page that failed to
 * load the rest of itself.
 *
 * The outer box carries the `hidden`, and it has no display class on it — a `hidden` attribute
 * on an element that also says `flex` loses the tie and shows anyway (`docs/admin-one-dom.md`).
 */
function emptyBlock(t: AdminStrings, configured: boolean, open: boolean): string {
  const tabbed = (s: string) => s.replace('{tab}', t.tabServer)
  const chips = configured
    ? `<div class="flex flex-wrap justify-center gap-2">`
      + [t.assistantEg1, t.assistantEg2, t.assistantEg3].map((eg) =>
        `<button type="button" data-ai-eg class="${CHIP} transition hover:border-neutral-400`
        + ` hover:text-neutral-900 dark:hover:border-neutral-500 dark:hover:text-neutral-100">`
        + `${escapeHtml(eg)}</button>`).join('')
      + `</div>`
    : `<a href="${AI_SETTINGS}" class="${CHIP} transition hover:border-neutral-400`
      + ` hover:text-neutral-900 dark:hover:border-neutral-500 dark:hover:text-neutral-100">`
      + `${escapeHtml(tabbed(t.assistantOpenAi))}</a>`

  return `<div class="h-full" data-ai-empty${open ? ' hidden' : ''}>`
    + `<div class="flex h-full items-center justify-center">`
    + emptyState({
      glyph: 'pen',
      title: configured ? t.assistantEmpty : t.assistantNoModel,
      description: tabbed(configured ? t.assistantIntro : t.assistantNeedsModel),
      actionHtml: chips,
    })
    + `</div></div>`
}

/** One row at rest — the height of the button beside it — growing to six as it fills. */
function composer(t: AdminStrings, configured: boolean): string {
  const off = configured ? '' : ' disabled'
  return `<div class="border-t border-neutral-100 p-4 dark:border-neutral-800">`
    + `<div class="mx-auto flex max-w-3xl items-end gap-2">`
    + `<textarea class="${CONTROL} w-full resize-none" rows="1" data-ai-box`
    + ` placeholder="${escapeAttr(t.assistantPlaceholder)}"${off}></textarea>`
    + `<button type="button" data-ai-send class="${buttonClass('primary')}" disabled>`
    + `${escapeHtml(t.assistantSend)}</button>`
    + `</div></div>`
}

export async function assistantScreen(settings: SiteSettings, query: URLSearchParams): Promise<string> {
  const t = adminT(settings.language)
  const w = words(t)
  const view = await assistantScreenView(query.get('chat'))
  const turns = view.open?.turns ?? []
  const blocks = htmlOf(blockMarks(turns, w))

  const top = sheetTop(
    modelLine(t, w, view.configured, view.model)
    + contextMeter(w, view.open?.context ?? 0)
    // Only where the column can appear: a control that toggles something invisible at this
    // width is a control that does nothing.
    + `<button type="button" data-ai-log-toggle aria-pressed="true"`
    + ` class="${SHEET_TOOL} ml-auto hidden min-[1600px]:inline-flex">`
    + `${escapeHtml(t.assistantDidThis)}</button>`
    + `<a href="/admin/assistant" class="${SHEET_TOOL} ml-auto min-[1600px]:ml-0">`
    + `${escapeHtml(t.assistantNew)}</a>`,
  )

  // A wider gutter than the sheet's usual 20px. The transcript is capped at `max-w-3xl` and
  // centres itself when there is room, but the three-column layout often leaves less than that,
  // and then the cap does nothing and the padding is the only thing between a paragraph and the
  // edge of the paper.
  const thread = `<div class="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-10" data-ai-thread>`
    + emptyBlock(t, view.configured, blocks !== '')
    + `<ol class="mx-auto max-w-3xl space-y-7" data-ai-blocks${blocks ? '' : ' hidden'}>${blocks}</ol>`
    // The waiting line lives inside the exchange it belongs to, where the eye already is. One
    // here said the same thing a second time, three inches down.
    + `<p class="mx-auto mt-6 max-w-3xl text-sm text-neutral-900 dark:text-neutral-100"`
    + ` data-ai-error hidden></p><div data-ai-end></div></div>`

  return `<div data-screen="assistant" data-lang="${escapeAttr(settings.language)}"`
    + ` data-ai-configured="${view.configured ? '1' : '0'}"`
    // `data-ai-open`, and NOT `data-ai-chat`: that name belongs to a ROW in the column, and the
    // rule that shows a row's delete confirm is `[data-ai-chat]:not([data-ai-confirming]) …`.
    // With the same name on the screen, every confirm in the page matched through this ancestor
    // and none of them could ever appear. Measured in a browser on 2026-09-14.
    + (view.open ? ` data-ai-open="${view.open.id}"` : '')
    + ` data-ai-words="${escapeAttr(JSON.stringify(w))}">`
    + pageHeader({ title: t.navAssistant })
    // The two columns the writing screen established.
    + `<div class="flex items-start gap-6">`
    + chatPane(t, w, view.chats, view.open?.id ?? null)
    + `<div class="${SHEET_FIXED} min-w-0 flex-1">`
    + top
    // The sheet splits below its top row: the chat keeps the width it had, and the raw record
    // of what was done stands beside it.
    + `<div class="flex min-h-0 flex-1">${thread}${toolLog(t, w, turns)}</div>`
    + composer(t, view.configured)
    + `</div></div></div>`
}
