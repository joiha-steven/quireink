// THE LIST BESIDE THE PAPER — the left half of the Writing Desk mock's write screen, as HTML
// the server sends (ADR 0054).
//
// A slim column of everything written, most recently touched first: search that reaches the
// body, the scope tabs, and one dark key for a new piece. Rows show the WRITING — title, then
// the matched line while searching or the standing first line otherwise.
//
// ⚠️ IT IS DRAWN ON ALL FOUR WRITING ROUTES, by the server, once. It was a React component the
// shell mounted outside the router so that clicking a row swapped only the sheet; under this ADR
// a row click is a real navigation, so there is nothing to keep alive across one — and the thing
// that had to be avoided at all costs, `WritePane` written twice (once as HTML for the list,
// once as React beside the editors), is avoided by the editors being drawn here too.
//
// ⚠️ EVERY ROW IS DRAWN AND THE FILTERS HIDE (`docs/admin-one-dom.md`, trap 2). Kind, status and
// what a piece is missing are all facts written onto the row, and the island sets an attribute
// on the column. Nothing is refetched to filter, and the one filter that arrives in the address
// is applied by the SERVER so the narrowed list is right in the first frame.
import type { AdminStrings } from '@/i18n/admin-i18n'
import type { SiteLang } from '@/types'
import { escapeAttr, escapeHtml } from '@/utils'
import { formatCount } from '@/i18n/format'
import { formatDateTimeShort } from '@/admin-shared/when'
import { CONTROL_SM, SHEET_TOOL, SHEET_TOOL_DANGER, buttonClass } from '@/admin-shared/kit'
import { fold } from '@/admin-shared/fold'
import { WRITE_PAGE } from '@/admin-shared/write'
import { icon, lamp, tabs, tick } from '@/web/admin/kit'
import { isQueued, needsOf, type WriteItem, type WriteNeeds } from '@/web/admin/screens/content-items'

/**
 * 1640 is MEASURED, not chosen.
 *
 * It was `xl` (1280), and at 1280 the editor's key row had 630px of sheet to sit in and needed
 * 787: it wrapped to two rows, the action line above it wrapped to two more, and a writer on a
 * 13-inch laptop met THREE tiers of chrome before the first word. The pane is 320px and the
 * shell takes 330, so the sheet is the window less 650; the row needs about 950 with air around
 * it. Below 1640 there is not room for both, and between the two the writing wins — which is
 * what `docs/admin-design.md` says out loud.
 */
const PANE_BESIDE = 'hidden w-80 min-[1640px]:flex'

/** On the write screen itself the pane IS the page: full width, then a column from 1280 up. */
const PANE_ALONE = 'flex w-full xl:w-80'

const PANE = 'shrink-0 flex-col self-start overflow-hidden rounded-[10px] border'
  + ' border-neutral-200/80 bg-neutral-50 xl:sticky xl:top-0 xl:max-h-[calc(100dvh-1.5rem)]'
  + ' dark:border-neutral-800 dark:bg-neutral-950'

/**
 * THE OPEN ROW IS A KEY HELD DOWN — carved in, like every latched control — but on PAPER, not
 * on the pen: a full lime field the height of three lines of text sat beside the writing and
 * pulled the eye on every keystroke, so the ground went quiet again. The carve says "held
 * down"; the pen stays on the small marks (the draft dot, the rail, the tabs).
 */
const ROW = 'write-row relative block border-b border-neutral-100 px-4 py-3 dark:border-neutral-800'

/** The words a row's second line needs, and the third line's two states. */
type RowWords = Pick<AdminStrings,
  'untitled' | 'kindPage' | 'kindNote' | 'statusDraft' | 'statusPublished' | 'scheduled'>

/**
 * One row's inside, which is the same whether the row is a link or a tick target.
 *
 * ⚠️ THE TITLE IS THREE SPANS DEEP and that is load-bearing for the tour, which reads it as
 * `row.querySelector('span span span')`. The nesting is not decoration either: the outer span
 * is the baseline row that holds the lamp, the middle one is the `min-w-0` box that lets a long
 * title truncate instead of shoving the lamp off the row, and the inner one is the clamp.
 */
function rowBody(it: WriteItem, t: RowWords, views: Record<string, number>, lang: SiteLang, now: number): string {
  const drafty = it.status !== 'published'
  const queued = isQueued(it, now)
  // The date beside "Published" is the PUBLICATION date — showing the last save there read as a
  // wrong publish time. A draft's only honest date is its save.
  const when = !drafty && it.kind === 'post' ? it.created : it.touched
  const seen = views[`/${it.slug}`] ?? 0

  // THE ROW'S STATE, in the admin's one lamp rather than in a dot of its own. Three answers,
  // not two: a draft is amber because it is waiting on YOU, a scheduled post is amber BREATHING
  // because it is waiting on the clock, and a published one is green because it is done.
  //
  // ⚠️ THE TICK TAKES THE LAMP'S PLACE rather than standing beside it, and both ship drawn with
  // one hidden. Adding a column moved every title 24px right and re-wrapped half the list on the
  // way into the mode, so the rows you were looking at rearranged themselves at the moment you
  // went to pick from them; swapping costs 8px and nothing re-wraps.
  const mark = `<span class="write-lamp mt-1.5 flex shrink-0 self-start">`
    + lamp({
      state: drafty || queued ? 'attention' : 'good',
      pulse: queued,
      title: drafty ? t.statusDraft : queued ? t.scheduled : t.statusPublished,
    })
    + `</span>`
    + tick({
      label: it.title || `${t.untitled} #${it.untitledNo ?? 1}`,
      className: 'write-tick mt-0.5 self-start',
      attrs: `data-write-tick="${escapeAttr(`${it.kind}:${it.slug}`)}"`,
    })

  // Clamped like the line under it, so a row's height is bounded by its SHAPE rather than by
  // whatever somebody typed: two lines of title, two of summary, one of standing.
  const title = it.title
    ? `<span class="write-title line-clamp-2 text-sm font-medium text-neutral-900 dark:text-white">`
      + `${escapeHtml(it.title)}</span>`
    : `<span class="write-title line-clamp-2 text-sm font-medium italic text-neutral-500 dark:text-neutral-400">`
      + `${escapeHtml(`${t.untitled} #${it.untitledNo ?? 1}`)}</span>`

  const prefix = it.kind === 'page'
    ? `<span class="mr-1 text-neutral-500 dark:text-neutral-400">${escapeHtml(t.kindPage)}</span>`
    : it.kind === 'note'
      ? `<span class="mr-1 text-neutral-500 dark:text-neutral-400">${escapeHtml(t.kindNote)}</span>`
      : ''

  // ⚠️ NO `block` ON THE SUMMARY, and it is not a tidy-up: `line-clamp-2` works by setting
  // `display:-webkit-box`, so a display utility beside it wins the cascade and the clamp goes
  // quietly dead. Measured 2026-09-12 with `block` present: this line ran 112px, which is SEVEN
  // lines and not two, and the rows came out anywhere from 44px to 199px tall — five pieces on a
  // 900px screen out of forty-nine. The clamp is what makes the column a list rather than a
  // stack of paragraphs. `scripts/checks/admin-kit.ts` refuses the pair outright.
  //
  // The standing line ships as the row's own text and the body-search hit replaces it later;
  // `data-write-standing` is what the island puts back when the search is cleared.
  const under = it.standing
    ? `<span data-write-summary class="mt-0.5 line-clamp-2 text-xs text-neutral-500 dark:text-neutral-400">`
      + `${prefix}<span data-write-line>${escapeHtml(it.standing)}</span></span>`
    : `<span data-write-summary hidden class="mt-0.5 line-clamp-2 text-xs text-neutral-500 dark:text-neutral-400">`
      + `${prefix}<span data-write-line></span></span>`

  const meta = `<span class="mt-1 block text-xs text-neutral-500 dark:text-neutral-400">`
    + escapeHtml(drafty ? t.statusDraft : t.statusPublished)
    + (when ? ` · ${escapeHtml(formatDateTimeShort(when))}` : '')
    + (!drafty && seen ? ` · ${escapeHtml(formatCount(seen, lang))}` : '')
    + `</span>`

  return `<span class="flex items-baseline gap-2">${mark}`
    + `<span class="min-w-0">${title}${under}${meta}</span></span>`
}

/**
 * One row.
 *
 * ⚠️ ONE ELEMENT, NOT TWO, and the mode is carried by attributes the island moves. Selection
 * used to swap a `<Link>` for a `<label>`, which under this ADR would mean drawing every row
 * twice — a second copy of this markup on a list that already ships in full. Instead the island
 * takes the `href` away while picking: an `<a>` without one is not a link, is not focusable, and
 * is not announced as a link, so the row stops being a way out of the page for the keyboard and
 * for a screen reader at the same moment it stops being one for the mouse. `data-href` is where
 * the address waits.
 *
 * `data-write-row` goes on the link only, which is the shape the tour reads: it takes `href` off
 * it, and a row that is currently a tick target must not answer that query.
 */
function row(
  it: WriteItem, t: RowWords, views: Record<string, number>, lang: SiteLang, now: number,
  openKey: string, out: boolean, over: boolean,
): string {
  const key = `${it.kind}:${it.slug}`
  const open = key === openKey
  // ⚠️ THE ONE FILTER THE SERVER APPLIES, and it applies it the same way the island does —
  // `hidden` on the row. It arrives in the address from the dashboard's "needs attention" rows,
  // so a page that drew all forty-eight and then hid forty would be a flash of the wrong answer
  // on a screen somebody was sent to for a specific one. Two mechanisms for one question is
  // what the first cut had, and the count went wrong: see `island/lib/write-filter.ts`.
  // `over` is the second reason a row ships hidden: it is past the first page, and the island
  // reveals it when the foot of the list comes into view (`admin-shared/write.ts`). Still ONE
  // mechanism — `hidden` on the row — which is the rule this comment was written for.
  const facts = ` data-piece="${escapeAttr(key)}" data-piece-kind="${escapeAttr(it.kind)}"`
    + ` data-piece-state="${it.status === 'published' ? 'published' : 'draft'}"`
    + ` data-piece-needs="${escapeAttr(needsOf(it))}"`
    // The sort keys travel with the row, because sorting is moving these nodes and not asking
    // the server again. Folded title and terms travel too, so the island's search does not fold
    // forty-eight strings on every keystroke.
    + ` data-piece-touched="${it.touched}" data-piece-created="${it.created}"`
    + ` data-find="${escapeAttr(fold(`${it.title} ${it.terms}`))}"`
    + ` data-find-raw="${escapeAttr(`${it.title} ${it.terms}`)}"`
  return `<a data-write-row href="${escapeAttr(it.editHref)}"`
    + ` data-href="${escapeAttr(it.editHref)}"${facts}`
    + (open ? ' aria-current="page"' : '') + (out || over ? ' hidden' : '')
    + ` class="${ROW}">${rowBody(it, t, views, lang, now)}</a>`
}

/**
 * The header: the search, the new-post key, the two filter rows, and the tools line.
 *
 * Selection SWAPS the tools line rather than adding a band. A fifth band pushes the first row
 * down at the moment somebody goes to pick from the list, so the rows they were looking at move
 * under the pointer.
 */
function head(t: AdminStrings, needs: WriteNeeds): string {
  const search = `<input type="search" data-write-search class="${CONTROL_SM} w-full"`
    + ` placeholder="${escapeAttr(t.filterPlaceholder)}" aria-label="${escapeAttr(t.filterPlaceholder)}">`

  const kinds = tabs({
    items: [
      { key: 'all', label: t.filterAll },
      { key: 'post', label: t.scopePosts },
      { key: 'page', label: t.scopePages },
      { key: 'note', label: t.scopeNotes },
    ],
    value: 'all',
    role: 'choice',
    // `lg dense`: the underlined strip at 13px with a 16px gap. The segmented track was the
    // first cut and it read as a different control — a strip of keys in a sunken well where the
    // column has always had a marker stroke under one word. Four words 24px apart do not fit a
    // 288px column, which is what `dense` is for; the six-segment predecessor broke its labels
    // over two lines in every language once Notes joined it (2026-09-09).
    size: 'lg',
    dense: true,
    attrs: 'data-write-kinds',
  })

  // Two lamps and a sort key on one line, which is what the six-segment strip became: four
  // words 24px apart do not fit a 288px column, and "drafts" and "of posts" are two questions.
  // ⚠️ BOTH LAMPS SHIP GREY, and lighting one is what "pressed" looks like. A lamp is a state
  // and these two are QUESTIONS — amber beside "Drafts" on arrival reads as a warning about
  // drafts rather than as a filter waiting to be asked for. Both hues ship drawn and the island
  // shows one, because a lamp's colour is a class and nothing in an island builds markup.
  // ⚠️ THE ATTRIBUTE GOES ON THE LAMP, not on a wrapper around it. A lamp is an inline-block,
  // so a plain span holding one takes a LINE BOX — 16px of it at this type size, for an 8px
  // mark — and the row grew by 8. The same fault cost every settings card 7px of header height
  // in the step before this one; there the fix was `flex` on the wrapper, here it is not having
  // a wrapper at all.
  const statusLamp = (state: 'attention' | 'good'): string =>
    lamp({ state: 'off', attrs: 'data-lamp-off' })
    + lamp({ state, attrs: 'data-lamp-on hidden' })
  const statusLine = `<div class="flex items-center justify-between gap-3 text-xs">`
    + `<span class="flex gap-3">`
    + ([['draft', t.scopeDrafts, 'attention'], ['published', t.scopePublished, 'good']] as const)
      .map(([value, label, state]) =>
        `<button type="button" data-write-status="${escapeAttr(value)}" aria-pressed="false"`
        + ` class="${SHEET_TOOL} inline-flex items-center gap-1.5">`
        + statusLamp(state)
        + `<span>${escapeHtml(label)}</span></button>`).join('')
    + `</span>`
    + `<button type="button" data-write-sort="updated" class="${SHEET_TOOL}"`
    + ` data-word-updated="${escapeAttr(`↓ ${t.sortUpdated}`)}"`
    + ` data-word-created="${escapeAttr(`↓ ${t.sortCreated}`)}">${escapeHtml(`↓ ${t.sortUpdated}`)}</button>`
    + `</div>`

  // THE DASHBOARD'S FILTER, arriving in the ADDRESS — and it has to be dismissable. A filter you
  // cannot take off is a list that has silently stopped being the list of everything, which is
  // the failure mode of every "35 posts need X" link that lands somewhere filtered without
  // saying so. Both sentences ship; the server shows the one the address asked for.
  const band = `<div data-write-needs="${escapeAttr(needs ?? '')}"${needs ? '' : ' hidden'}`
    + ` class="flex items-center justify-between gap-2 rounded-md bg-neutral-100 px-2.5 py-1.5`
    + ` text-xs text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300">`
    + `<span data-write-needs-word="excerpt"${needs === 'excerpt' ? '' : ' hidden'}>`
    + `${escapeHtml(t.dashNoExcerpt)}</span>`
    + `<span data-write-needs-word="image"${needs === 'image' ? '' : ' hidden'}>`
    + `${escapeHtml(t.dashNoImage)}</span>`
    + `<button type="button" data-write-needs-clear aria-label="${escapeAttr(t.close)}"`
    + ` class="${SHEET_TOOL}">${icon('close', 'h-3.5 w-3.5')}</button></div>`

  const tools = `<div class="flex items-center justify-between gap-2 text-xs">`
    // Not picking: the three ways into the list's own furniture.
    + `<span data-write-tools class="flex items-center gap-3">`
    + `<button type="button" data-write-select class="${SHEET_TOOL}">${escapeHtml(t.selectPieces)}</button>`
    + `<button type="button" data-write-drawer="taxonomy" class="${SHEET_TOOL}">${escapeHtml(t.tabTaxonomy)}</button>`
    + `<button type="button" data-write-drawer="series" class="${SHEET_TOOL}">${escapeHtml(t.tabSeries)}</button>`
    + `</span>`
    // Picking: two rows, because five controls do not fit on one 320px line in any language
    // that is not English. Leaving and selecting on top, the three verbs under them, wrapping
    // rather than scrolling — the same rule the editor's toolbar is held to.
    + `<span data-write-picking-tools hidden class="flex w-full flex-col gap-2">`
    + `<span class="flex items-center justify-between gap-2">`
    + `<button type="button" data-write-done class="${SHEET_TOOL}">${escapeHtml(t.selectDone)}</button>`
    // ONE KEY, TWO WORDS, chosen by what is already ticked — the `data-on`/`data-off` shape
    // the CSS reference toggle uses. A toggle whose label never changes is a control that
    // cannot say which way it is about to go.
    + `<button type="button" data-write-all class="${SHEET_TOOL}"`
    + ` data-on="${escapeAttr(t.selectAll)}" data-off="${escapeAttr(t.selectNone)}">`
    + `${escapeHtml(t.selectAll)}</button>`
    + `</span>`
    + `<span class="flex flex-wrap items-center gap-2">`
    // ⚠️ NO `data-word-*` ON ANY OF THESE. The label each key rebuilds on every pick comes
    // from `data-write-words`, which the pane already carries and `write-pick.ts` already
    // reads; a second copy of the same sentence on the same element is two mechanisms
    // deciding one thing, and the one nothing read sat there unnoticed until a wiring sweep
    // found it.
    + `<button type="button" data-write-publish class="${SHEET_TOOL}" disabled>`
    + `${escapeHtml(t.publish)} (0)</button>`
    + `<button type="button" data-write-draft class="${SHEET_TOOL}" disabled>`
    + `${escapeHtml(t.backToDraft)} (0)</button>`
    + `<button type="button" data-write-trash class="${SHEET_TOOL_DANGER}" disabled>`
    + `${escapeHtml(t.moveToTrash)} (0)</button>`
    + `</span></span></div>`

  return `<div class="space-y-3 px-4 pb-2 pt-4">`
    + `<div class="flex items-center gap-2">${search}`
    + `<a href="/admin/editor" class="${buttonClass('primary', 'sm')} shrink-0">`
    + `${escapeHtml(t.newPost)}</a></div>`
    + kinds + statusLine + band + tools + `</div>`
}

/**
 * The whole column.
 *
 * `alone` is the write screen itself, where the pane is the page at every width; beside an
 * editor it appears from 1640px up and the sheet takes the room below that.
 */
export function writePane(opts: {
  t: AdminStrings
  lang: SiteLang
  items: WriteItem[]
  views: Record<string, number>
  needs: WriteNeeds
  /** `kind:slug` of the piece the sheet beside this column is showing, or '' on the list. */
  openKey: string
  alone: boolean
  now: number
}): string {
  const { t, lang, items, views, needs, openKey, alone, now } = opts
  // BOTH FACES IN ONE BOX (trap 4): the sentence and the scroller are mutually exclusive, and a
  // stack that hides one of a pair hands the other a margin it never had.
  const none = needs !== null && !items.some((it) => needsOf(it).split(' ').includes(needs))
  // The `needs` rule lives HERE now rather than inside `row`, because the count of rows that
  // survive it is what decides where the first page ends. One rule, read once, used twice.
  let shown = 0
  const rows = items.map((it) => {
    const out = needs !== null && !needsOf(it).split(' ').includes(needs)
    if (!out) shown += 1
    return row(it, t, views, lang, now, openKey, out, !out && shown > WRITE_PAGE)
  }).join('')
  const list = `<div class="flex min-h-0 flex-1 flex-col">`
    + `<p data-write-none${none ? '' : ' hidden'} class="px-4 py-6 text-sm text-neutral-500 dark:text-neutral-400">`
    + `${escapeHtml(t.filterEmpty)}</p>`
    + `<div data-write-list${none ? ' hidden' : ''} class="scroll-fade min-h-0 flex-1 overflow-y-auto pb-6">`
    + rows
    // THE FOOT OF THE LIST, which is what the island watches. Drawn only when there is more to
    // reveal, so a blog with forty pieces has no sentinel and no observer work at all.
    + `<div data-write-more${shown > WRITE_PAGE ? '' : ' hidden'} class="h-8"></div>`
    + `</div></div>`
  return `<aside data-write-pane data-write-showing="${escapeAttr(needs ?? '')}"`
    + ` data-write-open="${escapeAttr(openKey)}"`
    // EVERY WORD THE ISLAND SAYS, written by the server, because the island has no dictionary:
    // the eleven locales live in `locales/` and a string typed into an island is a twelfth one
    // nobody translates. JSON in an attribute rather than eighteen attributes, which is the
    // shape the media and settings screens already use.
    + ` data-write-words="${escapeAttr(JSON.stringify(words(t)))}"`
    + ` class="${alone ? PANE_ALONE : PANE_BESIDE} ${PANE}">`
    + head(t, needs) + list + `</aside>`
}

/** What the island has to be able to say, in whichever language the blog is written in. */
const words = (t: AdminStrings): Record<string, string> => ({
  trash: t.moveToTrash, trashed: t.trashedMany, trashPartial: t.trashPartial, undo: t.undo,
  publish: t.publish, published: t.publishedMany,
  draft: t.backToDraft, drafted: t.draftedMany, bulkPartial: t.bulkPartial,
  restoreFailed: t.restoreFailed,
  saveFailed: t.saveFailed, renamed: t.renamed, deleted: t.deleted,
  renameTermTitle: t.renameTermTitle, renameSeriesTitle: t.renameSeriesTitle,
  renamePrompt: t.renamePrompt, save: t.save, askCancel: t.askCancel, askRemove: t.askRemove,
  askRemoveTermTitle: t.askRemoveTermTitle, askRemoveTermBody: t.askRemoveTermBody,
  askRemoveSeriesTitle: t.askRemoveSeriesTitle, askRemoveSeriesBody: t.askRemoveSeriesBody,
  seriesReordered: t.seriesReordered,
})
