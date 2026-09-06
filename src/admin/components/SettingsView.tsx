// Settings: SEVEN tabs, grouped by the question the owner is holding when they open this
// screen, with that question printed under the tab (ADR 0041, which supersedes 0011's
// grouping and keeps its one-question-per-tab rule).
//
// The eight tabs it replaces were grouped by which part of the CODE a key belonged to, and
// the count measured on 2026-09-07 says what that cost: Appearance carried 137 controls over
// 2,825px while five other tabs sat within 31px of 1,236, and the answer to "how do readers
// sign in to comment" lived three tabs from "should there be comments".
//
// ⚠️ A TAB SAVES ONE WAY, and the sheet's Save key renders on the first four only. Tabs 5-7
// are made of cards that each own their keys and each say whether the far end answered; a
// page-level Save beside them would be a button that silently did nothing for most of the
// screen, which is the arrangement being replaced.
//
// The stored shape is untouched. `SiteSettings` keeps every key and every name; this file
// decides which tab renders which key, and `?tab=` still answers to the eight old ids.

import { useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from '@/admin/router'
import type { SiteSettings } from '@/types'
import type { ThemePreset } from '@/content/themes'
import type { CommentEnv } from '@/comments/comment-env'
import type { IntegrationStatus } from '@/store/integration-keys'
import { Button } from '@/admin/ui/Button'
import { formatTime } from '@/utils'
import { PageHeader, Tabs, type TabItem } from './kit'
import { SHEET, SheetTop } from './sheet'
import { SettingsSearch } from './SettingsSearch'
import { SettingsNotesRow, useSettingsNotes } from './SettingsNotes'
import { useSettingJump } from './useSettingJump'
import { useSettingsSave } from './useSettingsSave'
import { useAdminT } from './I18nProvider'
import { SettingsBlogTab } from './SettingsBlogTab'
import { SettingsHomeTab } from './SettingsHomeTab'
import { SettingsPostTab } from './SettingsPostTab'
import { SettingsAppearanceTab } from './SettingsAppearanceTab'
import { SettingsPeopleTab } from './SettingsPeopleTab'
import { SettingsServerTab } from './SettingsServerTab'
import { SettingsAccountTab } from './SettingsAccountTab'
import type { UpdateStatus } from './UpdateFields'

export type Tab = 'blog' | 'home' | 'post' | 'appearance' | 'people' | 'server' | 'account'

/**
 * Every member of `Tab`, and the list `?tab=` is validated against — so a tab missing here is
 * a tab no link can reach. That happened once: `ai` was left out when its tab was added on
 * 2026-08-23, which made the assistant's own settings link land silently on Site — the address
 * its error message hands the owner, and the one the guide on quireink.com prints.
 */
const TAB_IDS: Tab[] = ['blog', 'home', 'post', 'appearance', 'people', 'server', 'account']

/**
 * The eight old ids, pointed at the tab that now holds their keys.
 *
 * Help, the home screen's setup band, the newsletter's SMTP link, the assistant's error
 * message and the command palette all address settings by these URLs, and a decision about
 * GROUPING is not a licence to break five screens that had no part in it. `?setting=` still
 * works alongside, because it names a key rather than a tab.
 *
 * `connections` lands on Comments & mail rather than on Server, and that is a judgement about
 * what people were looking for when they followed the link: SMTP is the reason that tab was
 * opened. `seo`, `ai` and `system` all land on Server, which absorbed all three.
 */
const OLD_TABS: Record<string, Tab> = {
  site: 'blog', layout: 'home', reading: 'post', appearance: 'appearance',
  seo: 'server', connections: 'people', ai: 'server', system: 'server',
}

const resolveTab = (param: string | null): Tab =>
  (TAB_IDS as string[]).includes(param ?? '') ? (param as Tab) : (OLD_TABS[param ?? ''] ?? 'blog')

/** The four that save through the sheet's own key. The other three save card by card. */
const SAVES_AS_ONE: Tab[] = ['blog', 'home', 'post', 'appearance']

/**
 * Two columns on a wide screen, one on a narrow one.
 *
 * The cards go in EXPLICIT column stacks (`COL`), never straight into the grid. A grid lays
 * its children out in rows, and a row is as tall as its tallest cell — so a short card beside
 * a tall one left a void underneath it, and the next card started below BOTH. The System tab
 * showed it plainly: Import, then Backups twice its height, then Cache stranded at the bottom
 * of the left column with a hole above it. Two stacks pack each side independently and there
 * is no row to align to.
 *
 * `items-start` stays for the same reason it was there: a column must not stretch to match
 * its neighbour.
 */
const GRID = 'grid items-start gap-5 xl:grid-cols-2'
// `min-w-0`, and it is load-bearing. A grid item defaults to `min-width: auto`, which
// refuses to shrink below its content's own intrinsic minimum — so on a narrow screen these
// columns did not narrow, they pushed the page sideways: measured 2026-08-28, the Layout tab
// overflowed by 160px at 344px and 114px at 390px, taking the fixed Save bar off the edge
// with it. One declaration takes every tab to exactly 0.
const COL = 'space-y-5 min-w-0'

export function SettingsView({ settings, presets, commentEnv, integrations, posts, pages, categories, update: updateStatus }: {
  settings: SiteSettings
  presets: ThemePreset[]
  commentEnv: CommentEnv
  integrations: IntegrationStatus
  posts: { slug: string; title: string }[]
  pages: { slug: string; title: string }[]
  categories: string[]
  // Not a setting: what the DEPLOYMENT permits, and what the last check was told. The switch
  // beside it is `settings.updateCheck` like every other field on this screen.
  update: UpdateStatus
}) {
  const t = useAdminT()
  const [s, setS] = useState<SiteSettings>(settings)
  const tabParam = useSearchParams().get('tab')
  const [tab, setTab] = useState<Tab>(() => resolveTab(tabParam))
  // Filled by TypographyFields; called by the Reset in that card's header row.
  const typographyReset = useRef<(() => void) | null>(null)

  const jumpToSetting = useSettingJump()
  const [notes, toggleNotes] = useSettingsNotes()

  const update = (partial: Partial<SiteSettings>) => setS((prev) => ({ ...prev, ...partial }))

  // The whole form's unsaved state, the question it asks when somebody leaves, and the
  // partial save the card-by-card tabs hand to each of their cards.
  const form = useSettingsSave(settings, s)
  const { changed, saving, savedAt, save } = form
  const savesAsOne = SAVES_AS_ONE.includes(tab)

  const TABS: TabItem<Tab>[] = [
    { key: 'blog', label: t.tabBlog },
    { key: 'home', label: t.tabHome },
    { key: 'post', label: t.tabPost },
    { key: 'appearance', label: t.tabAppearance },
    { key: 'people', label: t.tabPeople },
    { key: 'server', label: t.tabServer },
    { key: 'account', label: t.tabAccount },
  ]
  /** A result says WHICH tab, or it has only told you the thing exists. */
  const TAB_LABEL = (k: Tab): ReactNode => TABS.find((x) => x.key === k)?.label ?? k
  const HINTS: Record<Tab, string> = {
    blog: t.tabBlogHint,
    home: t.tabHomeHint,
    post: t.tabPostHint,
    appearance: t.tabAppearanceHint,
    people: t.tabPeopleHint,
    server: t.tabServerHint,
    account: t.tabAccountHint,
  }

  return (
    // ONE SHEET (mock page 7): tabs + the search (the way PAST them, ADR 0011) on the
    // sheet's first row; every card a hairline PANEL inside.
    <div>
      <PageHeader title={t.settingsTitle} />
      <div className={SHEET}>
        {/* Save sits on the sheet's own first row, LEFT of the search — the sheet-top is
            where a page's tools live, and this row is sticky, so the button is on screen
            wherever the reader is in a long tab. It replaces a bar fixed to the bottom of
            the window: that bar was reported as missing entirely, and it is the kind of
            chrome that goes missing — it lived outside the sheet, it was the one control
            not on the tools row, and anything that eats the bottom of the viewport (a
            phone toolbar, an iPad's) takes it with no trace. */}
        <div className="sticky top-0 z-20 rounded-t-[10px] bg-white/95 backdrop-blur-xl dark:bg-neutral-900/95">
        <SheetTop>
          <Tabs tabs={TABS} value={tab} onChange={setTab} size="sm" />
          {/* The save, its receipt and the way past the tabs travel as ONE group, and the
              group is what takes the free space rather than a spacer between the parts.
              With a `flex-1` spacer they were three loose items on a wrapping row, and at
              375px the row broke into three lines with the save key alone at the right edge
              and the field alone at the left of the next one. As a group they wrap together
              and stay a group: at 375 the field gives up its width (`flex-1`, the same
              answer the library's tool band takes) so the two share one line. */}
          <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
          {/* The receipt. It says WHEN, not "saved!", because the useful fact a minute later is
              the time — a screen that has been open all afternoon and one saved thirty seconds
              ago read identically otherwise. It clears itself the moment the form is dirty
              again: a stale "Saved at 14:02" beside three unsaved changes is a lie. */}
          {savesAsOne && (
          <span className="shrink-0 text-xs text-neutral-500 dark:text-neutral-400">
            {saving ? t.saving : savedAt && changed === 0 ? `${t.savedAtPrefix} ${formatTime(savedAt)}` : ''}
          </span>
          )}
          {/* `sm`, and the field beside it is sized to match, because on THIS row the height
              is set by the tab strip: it is the widest object on the band and the first one
              read, so it is the thing the other two answer to. The three measured 33.5, 32
              and 40 — a strip, a key and a field, no two alike — and the pair at the right
              end took the blame because they touch. All three are 32 now. */}
          {/* ⚠️ FOUR TABS ONLY (ADR 0041). On Comments & mail, Server and Account every card
              owns its keys and carries its own key, so a page-level Save beside them would be
              a button that silently did nothing for most of the screen.
              Disabled with nothing to save, and that is not tidiness either: a Save key that
              is always pressable answers "did I change anything?" with a shrug, and pressing
              it wrote the same record back and printed a success toast for work nobody did. */}
          {savesAsOne && (
          <Button size="sm" onClick={() => { void save() }} disabled={saving || changed === 0}>
            {saving ? t.saving : changed === 0 ? t.saveSettings : t.saveSettingsCount.replace('{n}', String(changed))}
          </Button>
          )}
          <SettingsSearch
            tabLabel={(k) => String(TAB_LABEL(k))}
            onPick={(entry) => { setTab(entry.tab); jumpToSetting(String(t[entry.label])) }}
          />
          </div>
        </SheetTop>
        </div>
        <div className="p-5" data-explanations={notes ? 'on' : 'off'}>
      {/* The definition, in the open — a guessed-at tab is a tab you open five of. It shares its line with the switch that quiets every OTHER explanation; this one stays. See `SettingsNotes`. */}
      <SettingsNotesRow hint={HINTS[tab]} on={notes} onToggle={toggleNotes} />

      {tab === 'blog' && <SettingsBlogTab s={s} update={update} grid={GRID} col={COL} />}

      {tab === 'home' && (
        <SettingsHomeTab
          s={s} update={update} posts={posts} pages={pages} categories={categories}
          grid={GRID} col={COL}
        />
      )}

      {tab === 'post' && (
        <SettingsPostTab
          s={s} update={update} onCommentSignIn={() => setTab('people')} grid={GRID} col={COL}
        />
      )}

      {tab === 'appearance' && (
        <SettingsAppearanceTab
          s={s} update={update} presets={presets}
          typographyReset={typographyReset} grid={GRID} col={COL}
        />
      )}

      {tab === 'people' && (
        <SettingsPeopleTab
          s={s} update={update} commentEnv={commentEnv} form={form} grid={GRID} col={COL}
        />
      )}

      {tab === 'server' && (
        <SettingsServerTab
          s={s} update={update} integrations={integrations} updateStatus={updateStatus}
          updateStatusValue={s.updateCheck} form={form} grid={GRID} col={COL}
        />
      )}

      {tab === 'account' && (
        <SettingsAccountTab s={s} update={update} form={form} grid={GRID} col={COL} />
      )}

        </div>
      </div>
    </div>
  )
}
