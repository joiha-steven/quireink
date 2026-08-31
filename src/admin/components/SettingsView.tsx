// Settings: ONE form, ONE save button, in eight groups (ADR 0011 named seven; `ai` joined
// 2026-08-23).
//
// The frozen tree had five and they were tangled, because three were named after nothing in
// particular: "Site" held the site's identity AND the page layout; "Content" held reader
// features, comments and a one-time WordPress importer; "Integrations" held a backup
// destination, an AI protocol server, a CDN and an SMTP host. Nothing told you which tab a
// setting was behind, so finding one meant opening all five.
//
// Each group answers ONE question, and that question is printed under the tab rather than left
// implicit — what the site IS, where things SIT, what a reader GETS, how it LOOKS, how machines
// SEE it, what it TALKS TO, what the AI door does, and the state of the INSTALL.
//
// All settings still live in one state object and save together via PUT /api/settings, which
// merges — regrouping the UI changed no stored shape.

import { useRef, useState, type ReactNode } from 'react'
import { useRouter, useSearchParams } from '@/admin/router'
import type { SiteSettings, ApiResponse } from '@/types'
import type { ThemePreset } from '@/content/themes'
import type { CommentEnv } from '@/comments/comment-env'
import type { IntegrationStatus } from '@/store/integration-keys'
import { Button } from '@/admin/ui/Button'
import { useToast } from '@/admin/ui/Toast'
import { formatTime } from '@/utils'
import { Card, NOTE_TEXT, PageHeader, Tabs, type TabItem } from './kit'
import { SHEET, SheetTop } from './sheet'
import { SettingsSearch } from './SettingsSearch'
import { useSettingJump } from './useSettingJump'
import { useAdminT } from './I18nProvider'
import { SiteFields } from './SiteFields'
import { BrandFields } from './BrandFields'
import { LayoutMenuFields } from './LayoutMenuFields'
import { FrontFields } from './FrontFields'
import { FooterField } from './FooterField'
import { FigureFields } from './FigureFields'
import { GalleryFields } from './GalleryFields'
import { PostImageFields } from './PostImageFields'
import { AuthorFields } from './AuthorFields'
import { ListingFeatureFields, PageFeatureFields, PostFeatureFields } from './FeatureFields'
import { CommentFields } from './CommentFields'
import { CommentIntegrations } from './CommentIntegrations'
import { CloudflareFields } from './CloudflareFields'
import { SettingsAiTab } from './SettingsAiTab'
import { SettingsSystemTab } from './SettingsSystemTab'
import type { UpdateStatus } from './UpdateFields'
import { SeoFields } from './SeoFields'
import { SettingsAppearanceTab } from './SettingsAppearanceTab'
import { RedirectsManager } from './RedirectsManager'
import { NewsletterFields } from './NewsletterFields'

type Tab = 'site' | 'layout' | 'reading' | 'appearance' | 'seo' | 'connections' | 'ai' | 'system'
// Every member of `Tab`, and the list is what `?tab=` is validated against — so a tab
// missing here is a tab no link can reach. 'ai' was left out when the tab was added on
// 2026-08-23, which made `/admin/settings?tab=ai` land silently on Site: the address the
// assistant's own error message hands the owner, and the one the guide on quireink.com
// prints. Derived from the type so the next tab cannot repeat it.
const TAB_IDS: Tab[] = [
  'site', 'layout', 'reading', 'appearance', 'seo', 'connections', 'ai', 'system',
]

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
  const router = useRouter()
  const { notify } = useToast()
  const [s, setS] = useState<SiteSettings>(settings)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const tabParam = useSearchParams().get('tab')
  const [tab, setTab] = useState<Tab>(
    (TAB_IDS as string[]).includes(tabParam ?? '') ? (tabParam as Tab) : 'site')
  // Filled by TypographyFields; called by the Reset in that card's header row.
  const typographyReset = useRef<(() => void) | null>(null)

  const jumpToSetting = useSettingJump()

  const update = (partial: Partial<SiteSettings>) => setS((prev) => ({ ...prev, ...partial }))

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(s),
      })
      const json = (await res.json()) as ApiResponse<SiteSettings>
      if (!json.success) throw new Error(json.error)
      setSavedAt(new Date().toISOString())
      notify(t.savedSettings)
      // Refetch the shell so a language change reaches the whole admin at once.
      router.refresh()
    } catch {
      notify(t.saveFailed, 'error')
    } finally {
      setSaving(false)
    }
  }

  const TABS: TabItem<Tab>[] = [
    { key: 'site', label: t.tabSite },
    { key: 'layout', label: t.tabLayout },
    { key: 'reading', label: t.tabReading },
    { key: 'appearance', label: t.tabAppearance },
    { key: 'seo', label: t.tabSeo },
    { key: 'connections', label: t.tabConnections },
    { key: 'ai', label: t.tabAi },
    { key: 'system', label: t.tabSystem },
  ]
  /** A result says WHICH tab, or it has only told you the thing exists. */
  const TAB_LABEL = (k: Tab): ReactNode => TABS.find((x) => x.key === k)?.label ?? k
  const HINTS: Record<Tab, string> = {
    site: t.tabSiteHint,
    layout: t.tabLayoutHint,
    reading: t.tabReadingHint,
    appearance: t.tabAppearanceHint,
    seo: t.tabSeoHint,
    connections: t.tabConnectionsHint,
    ai: t.tabAiHint,
    system: t.tabSystemHint,
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
          <span className="shrink-0 text-xs text-neutral-500 dark:text-neutral-400">
            {saving ? t.saving : savedAt ? `${t.savedAtPrefix} ${formatTime(savedAt)}` : ''}
          </span>
          {/* `sm`, and the field beside it is sized to match, because on THIS row the height
              is set by the tab strip: it is the widest object on the band and the first one
              read, so it is the thing the other two answer to. The three measured 33.5, 32
              and 40 — a strip, a key and a field, no two alike — and the pair at the right
              end took the blame because they touch. All three are 32 now. */}
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? t.saving : t.saveSettings}
          </Button>
          <SettingsSearch
            tabLabel={(k) => String(TAB_LABEL(k))}
            onPick={(entry) => { setTab(entry.tab); jumpToSetting(String(t[entry.label])) }}
          />
          </div>
        </SheetTop>
        </div>
        <div className="p-5">
      {/* The definition, in the open — a guessed-at tab is a tab you open five of. */}
      <p className={`${NOTE_TEXT} mb-5 max-w-2xl`}>{HINTS[tab]}</p>

      {/* SITE — what this site IS. Identity only: nothing here moves a pixel. */}
      {tab === 'site' && (
        <div className={GRID}>
          <div className={COL}>
            <Card panel title={t.cardGeneral}>
              <SiteFields s={s} update={update} />
            </Card>
          </div>
          <div className={COL}>
            <Card panel title={t.cardBranding}>
              <BrandFields s={s} update={update} />
            </Card>
            {/* Whose blog this is — filed with the marks, because both answer "who is this",
                and the words above answer "what is this".
                ⚠️ It was in the LEFT stack, on the stated grounds that Branding was the taller
                card. It is not, and had not been for some time: measured at 1440px, Branding
                351 against Author 710, which left the two stacks at 1,461 and 351 — the right
                column of this tab was empty for 1,110px, the worst hole in the eight. Now 731
                against 1,085. Re-measure before moving it back. */}
            <Card panel title={t.cardAuthor}>
              <AuthorFields author={s.author} onChange={(author) => update({ author })} />
            </Card>
          </div>
        </div>
      )}

      {/* LAYOUT — where things sit; split out of "Site", which had no reason to hold both. */}
      {tab === 'layout' && (
        <div className={GRID}>
          <div className={COL}>
            <Card panel title={t.cardLayout}>
              <LayoutMenuFields s={s} update={update} posts={posts} pages={pages} />
            </Card>
          </div>
          <div className={COL}>
            {/* Only when the site actually serves one. Twenty questions about a front page
                nobody is showing is how a settings screen becomes something people scroll
                past. */}
            {s.home.mode === 'front' && (
              <Card panel title={t.cardFront}>
                <FrontFields
                  front={s.home.front}
                  onChange={(front) => update({ home: { ...s.home, front } })}
                  posts={posts}
                  categories={categories}
                />
              </Card>
            )}
            {/* Directly above the frame card, because both answer a question about pictures
                and somebody hunting for "how do I show my cover" scans the picture cards.
                It started in the left stack on the grounds that the right one was longer;
                looking at the rendered tab said otherwise — in list mode (the default) the
                right column ended halfway up the page while the left ran on. */}
            <Card panel title={t.cardPostImage}>
              <PostImageFields postImage={s.postImage} onChange={(postImage) => update({ postImage })} />
            </Card>
            <Card panel title={t.cardFigure}>
              <FigureFields figure={s.figure} onChange={(figure) => update({ figure })} />
            </Card>
            <Card panel title={t.cardGallery}>
              <GalleryFields gallery={s.gallery} onChange={(gallery) => update({ gallery })} />
            </Card>
            <Card panel title={t.footerContent}>
              <FooterField value={s.footer} onChange={(footer) => update({ footer })} />
            </Card>
          </div>
        </div>
      )}

      {/* READING — what a reader gets on a post, and whether they can reply. */}
      {tab === 'reading' && (
        <div className={GRID}>
          {/* WHAT A READER CAN DO, then WHAT THEY SEE — and the thirteen-switch card that
              used to be the whole left column is the first half of it.
              Measured at 1440px: one card of 1,360 against a stack of 901. Now 1,168 against
              1,176. Re-measure before moving a card across. */}
          <div className={COL}>
            <Card panel title={t.cardFeatures}>
              <PostFeatureFields
                features={s.features}
                onChange={(features) => update({ features })}
                relatedCount={s.relatedCount}
                onRelatedCount={(relatedCount) => update({ relatedCount })}
              />
            </Card>
            <Card panel title={t.cardComments}>
              <CommentFields comments={s.comments} onChange={(comments) => update({ comments })} />
            </Card>
          </div>
          <div className={COL}>
            <Card panel title={t.cardOnPage}>
              <PageFeatureFields features={s.features} onChange={(features) => update({ features })} />
            </Card>
            <Card panel title={t.cardListing}>
              <ListingFeatureFields features={s.features} onChange={(features) => update({ features })} />
            </Card>
          </div>
        </div>
      )}

      {/* APPEARANCE — palette + escape hatch left, the type stack right. */}
      {tab === 'appearance' && (
        <SettingsAppearanceTab
          s={s} update={update} presets={presets}
          typographyReset={typographyReset} grid={GRID} col={COL}
        />
      )}

      {/* SEARCH & URLS — the machine-facing surface. Redirects belong with it: an old
          address is a search-engine concern before it is anything else. */}
      {tab === 'seo' && (
        <div className={GRID}>
          <div className={COL}>
            <Card panel title={t.tabSeo}>
              <SeoFields s={s} update={update} />
            </Card>
          </div>
          <div className={COL}>
            <Card panel title={t.redirectsTitle}>
              <RedirectsManager />
            </Card>
          </div>
        </div>
      )}

      {/* CONNECTIONS — other services. Every credential here is written to the server and
          never read back, which is why these cards show status rather than values. */}
      {tab === 'connections' && (
        <div className={GRID}>
          <div className={COL}>
            <Card panel title={t.cardNewsletter}>
              <NewsletterFields />
            </Card>
          </div>
          <div className={COL}>
            {/* The two services that sit in FRONT of the site — the CDN that caches it and
                the checks a commenter passes — against the one that sends from it.
                Measured at 1440px: this was Newsletter + Cloudflare against comments alone,
                868 to 357. Now 459 to 770. */}
            <Card panel title={t.cardCloudflare}>
              <CloudflareFields configured={integrations.cloudflareConfigured} zoneId={integrations.cloudflareZoneId} webhookConfigured={integrations.purgeWebhookConfigured} />
            </Card>
            <Card panel title={t.cardCommentIntegrations}>
              <CommentIntegrations
                comments={s.comments}
                env={commentEnv}
                onChange={(comments) => update({ comments })}
              />
            </Card>
          </div>
        </div>
      )}

      {/* AI — its own file; see SettingsAiTab for why it is one subject. */}
      {tab === 'ai' && (
        <SettingsAiTab s={s} update={update} integrations={integrations} grid={GRID} col={COL} />
      )}

      {/* SYSTEM — content in and out, and the state of the install. Its own file since
          2026-08-22, when this one reached its line ceiling. */}
      {tab === 'system' && (
        <SettingsSystemTab s={s} update={update} updateStatus={updateStatus} offsiteConfigured={integrations.offsiteConfigured} s3Bucket={integrations.s3Bucket} grid={GRID} col={COL} />
      )}

        </div>
      </div>
    </div>
  )
}
