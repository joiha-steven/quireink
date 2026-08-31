// The list beside the paper — the left half of the Writing Desk mock's write screen.
//
// A slim column of everything written, most recently touched first: search that reaches
// the body, the scope tabs, and one dark button for a new piece. Rows show the WRITING —
// title, then the matched line while searching or the standing first line otherwise.
//
// It fetches the content view itself so the editor pages can drop it in beside any sheet
// without threading list props through their own views. Beside an editor it appears from
// 1640px up — on a narrower window the sheet takes the room and the list is one "← Viết"
// away; on the Write screen itself (`always`) it is the page at every width.
//
// ⚠️ 1640 is MEASURED, not chosen. It was `xl` (1280), and at 1280 the editor's button row
// had 630px of sheet to sit in and needed 787: it wrapped to two rows, the action line above
// it wrapped to two more, and a writer on a 13-inch laptop met THREE tiers of chrome before
// the first word. The pane is 320px and the shell takes 330, so the sheet is the window less
// 650; the row needs ~950 with air around it. Below 1640 there is not room for both, and
// between the two the writing wins — which is what `docs/admin-design.md` says out loud.
// Focus mode (`useFocusMode.ts`) puts the pane away at ANY width, on purpose.
import { useState } from 'react'
import Link, { useRouter } from '@/admin/router'
import { useView } from '@/admin/useView'
import type { Post, Page } from '@/types'
import { useToast } from '@/admin/ui/Toast'
import { formatDateTimeShort } from '@/utils'
import { Button } from '@/admin/ui/Button'
import { CONTROL_CHROME, Tabs } from './kit'
import { SlideOver } from './SlideOver'
import { TaxonomyManager } from './TaxonomyManager'
import { SeriesManager } from './SeriesManager'
import { Tick } from '@/admin/ui/Tick'
import { useAdminT } from './I18nProvider'
import { useWritingItems, type WriteScope, type WriteSort } from './useWritingItems'
import { Marked } from './Marked'
import { SHEET_TOOL, SHEET_TOOL_DANGER } from './sheet'

type ContentView = {
  posts: Post[]
  pages: Page[]
  views: Record<string, number>
}

function Rows({
  posts,
  pages,
  views,
  activeSlug,
  tools,
}: ContentView & { activeSlug?: string; tools?: React.ReactNode }) {
  const t = useAdminT()
  const router = useRouter()
  const { notify } = useToast()
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<WriteScope>('all')
  const [sort, setSort] = useState<WriteSort>('updated')
  const { shown, bodyHits } = useWritingItems(posts, pages, query, scope, sort)
  // Selection is a MODE, not a permanent control on every row. A trash icon that lives on
  // the row sits a few pixels from the title you click dozens of times a day, and it has to
  // appear on hover to stay out of the way — which on a touch screen means it never appears
  // at all. Behind a mode the row stays a plain link until you ask for something else.
  const [picking, setPicking] = useState(false)
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  const leave = () => { setPicking(false); setChosen(new Set()) }
  const toggle = (key: string) =>
    setChosen((prev) => {
      const next = new Set(prev)
      if (!next.delete(key)) next.add(key)
      return next
    })

  // There is no bulk endpoint: `POST /api/trash` only restores, purges and empties things
  // ALREADY trashed, and moving a live piece is `DELETE /api/{posts,pages}/:slug`, one call
  // each. So a batch can half-succeed, and it reports what landed rather than failing whole —
  // refusing the batch would mean re-doing the part that already worked.
  async function trashChosen() {
    if (chosen.size === 0 || !confirm(t.confirmTrashMany)) return
    setBusy(true)
    const keys = [...chosen]
    const done = await Promise.all(
      keys.map(async (key) => {
        const kind = key.slice(0, key.indexOf(':'))
        const slug = key.slice(key.indexOf(':') + 1)
        try {
          const res = await fetch(`/api/${kind === 'post' ? 'posts' : 'pages'}/${encodeURIComponent(slug)}`, {
            method: 'DELETE',
          })
          return res.ok ? slug : null
        } catch {
          return null
        }
      }),
    )
    const gone = done.filter((s): s is string => s !== null)
    setBusy(false)
    leave()
    notify(
      gone.length === keys.length ? t.movedToTrash : `${t.trashPartial} (${gone.length}/${keys.length})`,
      gone.length === keys.length ? undefined : 'error',
    )
    // Refreshing beside the editor of a piece that was just trashed refetches a slug the
    // server no longer serves and swaps the sheet for a red "Not found". Leave instead.
    if (activeSlug && gone.includes(activeSlug)) router.push('/admin/content')
    else router.refresh()
  }

  // The scope* keys, not tabPages/statusPublished: five words must share ONE line in a
  // 320px column in every language, so this row carries its own deliberately short set.
  const scopeTabs: { key: WriteScope; label: string }[] = [
    { key: 'all', label: t.filterAll },
    { key: 'page', label: t.scopePages },
    { key: 'post', label: t.scopePosts },
    { key: 'published', label: t.scopePublished },
    { key: 'draft', label: t.scopeDrafts },
  ]

  return (
    <>
      <div className="space-y-3 px-4 pb-2 pt-4">
        <div className="flex items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.filterPlaceholder}
            aria-label={t.filterPlaceholder}
            // `h-8`, matching the `size="sm"` button beside it. This pane is deliberately dense —
            // its tabs are `sm dense` too — and the field was 36px against the button's 32, which
            // is the one thing a two-item row cannot hide. The target stays easy: it is the full
            // width of the pane.
            //
            // The SIZE is the only thing this field gets to decide for itself, which is what
            // `CONTROL_CHROME` was split out to allow. Drawn by hand it had drifted on four
            // other things and one of them was not cosmetic: 8px of radius against the
            // admin's 6, a neutral-200 border against the control shade of neutral-300, no
            // inset carve on a box that holds a value — and NO FOCUS STATE AT ALL. A field
            // reached by keyboard gave back nothing to say it had been reached.
            className={`${CONTROL_CHROME} h-8 w-full min-w-0 px-3 text-sm`}
          />
          <Link href="/admin/editor" className="shrink-0">
            <Button size="sm">{t.newPost}</Button>
          </Link>
        </div>
        <Tabs tabs={scopeTabs} value={scope} onChange={setScope} size="sm" dense role="choice" />
        {/* One thin line of small print: the pane's tools on the left (the Write screen
            hangs Taxonomy and Series here — they lived below the fold, where nobody would
            find them), the sort cycle on the right.
            Selecting SWAPS this line rather than adding one. The pane already stacks four
            bands above the list in a 320px column, and a fifth would push the first row of
            writing further down on every screen for the sake of a mode that is off almost
            always. The line it swaps to carries the same two ends: what leaves the mode on
            the left, what the mode is FOR on the right. */}
        <div className="flex items-center justify-between gap-3">
          {picking ? (
            <>
              <button type="button" onClick={leave} disabled={busy} className={SHEET_TOOL}>
                {t.selectDone}
              </button>
              <button
                type="button"
                onClick={() => void trashChosen()}
                disabled={busy || chosen.size === 0}
                className={SHEET_TOOL_DANGER}
              >
                {t.moveToTrash} ({chosen.size})
              </button>
            </>
          ) : (
            <>
              <span className="flex gap-3">
                <button type="button" onClick={() => setPicking(true)} className={SHEET_TOOL}>
                  {t.selectPieces}
                </button>
                {tools}
              </span>
              <button
                type="button"
                onClick={() => setSort(sort === 'updated' ? 'created' : 'updated')}
                className={SHEET_TOOL}
              >
                ↓ {sort === 'updated' ? t.sortUpdated : t.sortCreated}
              </button>
            </>
          )}
        </div>
      </div>

      {/* "Nothing matches" is only true once the server has answered — saying it while the
          body search is in flight is a lie that corrects itself, which reads as a flicker. */}
      {shown.length === 0 && (query.trim().length < 2 || bodyHits !== null) ? (
        <p className="px-4 py-6 text-sm text-neutral-500 dark:text-neutral-400">{t.filterEmpty}</p>
      ) : (
        <div className="scroll-fade min-h-0 flex-1 overflow-y-auto pb-6">
          {shown.map((it) => {
            const key = `${it.kind}:${it.slug}`
            const found = bodyHits?.get(key)
            const under = found ?? it.standing
            // The open piece is NOT marked while selecting. The lifted background means "this
            // one", and in this mode "this one" is what the checkbox says; two meanings for one
            // background is how a row nobody ticked comes to read as ticked.
            const active = !picking && it.slug === activeSlug
            const ticked = chosen.has(key)
            const drafty = it.status !== 'published'
            // The date beside "Published" is the PUBLICATION date — showing the last save
            // there read as a wrong publish time. A draft's only honest date is its save.
            const when = !drafty && it.kind === 'post' ? it.created : it.touched
            // THE OPEN ROW IS A KEY HELD DOWN — carved in, like every latched control —
            // but on PAPER, not on the pen: a full lime field the height of three lines of
            // text sat beside the writing and pulled the eye on every keystroke, and the
            // owner asked for the quiet ground back. The carve says "held down"; the pen
            // stays on the small marks (the draft dot, the rail, the tabs).
            const rowClass = `relative block border-b border-neutral-100 px-4 py-3 dark:border-neutral-800 ${
              active
                ? 'bg-white shadow-[inset_0_2px_3px_rgba(0,0,0,.14)] dark:bg-neutral-900 dark:shadow-[inset_0_2px_3px_rgba(0,0,0,.5)]'
                : ticked
                  ? 'bg-white dark:bg-neutral-900'
                  : 'hover:bg-white/60 dark:hover:bg-neutral-900/60'
            }`
            const body = (
              <span className="flex items-baseline gap-2">
                  {/* The box takes the DOT'S place rather than standing beside it. Adding a
                      column moved every title 24px right and re-wrapped half the list on the
                      way into the mode, so the rows you were looking at rearranged themselves
                      at the moment you went to pick from them; swapping costs 8px and nothing
                      re-wraps. The dot's reading is still on the row's own third line, and the
                      scope tabs above are the honest way to select by status.
                      The whole row is the target, not the 14px box: the label wraps it, so a
                      tap anywhere ticks. That is also why the row stops being a link here — a
                      row that both navigates and ticks loses the selection to a mis-tap. */}
                  {picking ? (
                    <Tick checked={ticked} onChange={() => toggle(key)} disabled={busy} className="mt-0.5 self-start" />
                  ) : (
                    /* The mock's dot: work still on the desk wears the pen's edge — the one
                       accent the admin has — and published is the quiet neutral. */
                    <span
                      aria-hidden
                      className={`mt-1.5 h-1.5 w-1.5 shrink-0 self-start rounded-full ${
                        drafty ? 'bg-[var(--pen-edge)]' : 'bg-neutral-300 dark:bg-neutral-600'
                      }`}
                    />
                  )}
                  <span className="min-w-0">
                    <span className={`block text-sm ${active ? 'font-semibold' : 'font-medium'} text-neutral-900 dark:text-white ${!it.title ? 'italic text-neutral-500 dark:text-neutral-400' : ''}`}>
                      {it.title ? <Marked text={it.title} needle={query} /> : t.untitled}
                    </span>
                    {under && (
                      <span className="mt-0.5 line-clamp-2 block text-xs text-neutral-500 dark:text-neutral-400">
                        {it.kind === 'page' && <span className="mr-1 text-neutral-500 dark:text-neutral-400">{t.kindPage}</span>}
                        <Marked text={under} needle={query} />
                      </span>
                    )}
                    <span className="mt-1 block text-xs text-neutral-500 dark:text-neutral-400">
                      {(drafty ? t.statusDraft : t.statusPublished)}
                      {when ? ` · ${formatDateTimeShort(new Date(when).toISOString())}` : ''}
                      {!drafty && views[`/${it.slug}`] ? ` · ${views[`/${it.slug}`].toLocaleString()}` : ''}
                    </span>
                  </span>
              </span>
            )
            // `data-write-row` stays on the LINK only: the tour reads `href` off it, and a
            // label wearing the same mark would answer that query with nothing.
            return picking ? (
              <label key={key} data-write-pick={key} className={`${rowClass} cursor-pointer`}>
                {body}
              </label>
            ) : (
              <Link
                key={key}
                href={it.editHref}
                data-write-row
                aria-current={active ? 'page' : undefined}
                className={rowClass}
              >
                {body}
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}

/**
 * The pane, self-fetching. `activeSlug` marks the open piece's row. The column keeps its
 * own scroll so a long list never scrolls the sheet, and the fade says where it clips.
 */
export function WritePane({ activeSlug, always = false }: { activeSlug?: string; always?: boolean }) {
  const t = useAdminT()
  const { data } = useView('content')
  // THE DRAWERS ARE THE PANE'S OWN. They hung off the Write SCREEN, handed down as a `tools`
  // prop — which was fine while only that screen drew the pane, and became the one thing
  // stopping the pane from being hoisted out of the routed tree. They manage the categories
  // and the series of the list standing right there; this is where they belong.
  const [drawer, setDrawer] = useState<'none' | 'taxonomy' | 'series'>('none')
  const close = () => setDrawer('none')
  return (
    <aside
      className={`${
        always ? 'flex w-full xl:w-80' : 'hidden w-80 min-[1640px]:flex'
      } shrink-0 flex-col self-start overflow-hidden rounded-[10px] border border-neutral-200/80 bg-neutral-50 xl:sticky xl:top-0 xl:max-h-[calc(100dvh-1.5rem)] dark:border-neutral-800 dark:bg-neutral-950`}
    >
      {data ? (
        <Rows
          {...data}
          activeSlug={activeSlug}
          tools={
            <>
              <button type="button" className={SHEET_TOOL} onClick={() => setDrawer('taxonomy')}>{t.tabTaxonomy}</button>
              <button type="button" className={SHEET_TOOL} onClick={() => setDrawer('series')}>{t.tabSeries}</button>
            </>
          }
        />
      ) : (
        <div className="p-4">
          <div className="h-9 animate-pulse rounded-lg bg-neutral-200/60 dark:bg-neutral-800" />
        </div>
      )}
      {drawer !== 'none' && data && (
        <SlideOver
          label={drawer === 'taxonomy' ? t.tabTaxonomy : t.tabSeries}
          onClose={close}
          footer={<Button variant="secondary" onClick={close}>{t.close}</Button>}
        >
          {drawer === 'taxonomy' ? <TaxonomyManager posts={data.posts} /> : <SeriesManager posts={data.posts} />}
        </SlideOver>
      )}
    </aside>
  )
}
