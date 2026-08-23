// Settings: ONE form, ONE save button, in SEVEN groups.
//
// The frozen tree had five, and the owner's complaint was that they were tangled — which
// they were, because three of them were named after nothing in particular. "Site" held both
// the site's identity AND the page layout; "Content" held reader features, comments and a
// one-time WordPress importer; "Integrations" held a backup destination, an AI protocol
// server, a CDN and an SMTP host. Nothing told you which tab a given setting was behind,
// so finding one meant opening all five.
//
// Each group here answers ONE question, and that question is printed under the tab rather
// than left implicit. Two extra tabs is a cheap price for never having to guess:
//
//   Site         what is this site
//   Layout       where does everything sit
//   Reading      what does a reader get on a post
//   Appearance   how does it look
//   Search       how do machines see it, and where do old addresses lead
//   Connections  what else does it talk to
//   System       moving content in and out, and the state of the install
//
// All settings still live in one state object and save together via PUT /api/settings,
// which merges — regrouping the UI changed no stored shape.

import { useRef, useState, type ReactNode } from 'react'
import { useRouter, useSearchParams } from '@/admin/router'
import type { SiteSettings, ApiResponse } from '@/types'
import type { ThemePreset } from '@/content/themes'
import type { CommentEnv } from '@/comments/comment-env'
import type { IntegrationStatus } from '@/store/integration-keys'
import { Button } from '@/admin/ui/Button'
import { useToast } from '@/admin/ui/Toast'
import { formatTime } from '@/utils'
import { Card, NOTE_TEXT, PageHeader, ResetButton, Tabs, type TabItem } from './kit'
import { SHEET, SheetTop } from './sheet'
import { SettingsSearch } from './SettingsSearch'
import { useSettingJump } from './useSettingJump'
import { useAdminT } from './I18nProvider'
import { SiteFields } from './SiteFields'
import { BrandFields } from './BrandFields'
import { ThemeFields } from './ThemeFields'
import { TypographyFields } from './TypographyFields'
import { FontUpload } from './FontUpload'
import { FontFields } from './FontFields'
import { AdvancedFields } from './AdvancedFields'
import { LayoutMenuFields } from './LayoutMenuFields'
import { FrontFields } from './FrontFields'
import { FooterField } from './FooterField'
import { GalleryFields } from './GalleryFields'
import { ActivityLogField, ListingFeatureFields, PostFeatureFields } from './FeatureFields'
import { CommentFields } from './CommentFields'
import { CommentIntegrations } from './CommentIntegrations'
import { CloudflareFields } from './CloudflareFields'
import { SettingsAiTab } from './SettingsAiTab'
import { SettingsSystemTab } from './SettingsSystemTab'
import type { UpdateStatus } from './UpdateFields'
import { SeoFields } from './SeoFields'
import { RedirectsManager } from './RedirectsManager'
import { NewsletterFields } from './NewsletterFields'

type Tab = 'site' | 'layout' | 'reading' | 'appearance' | 'seo' | 'connections' | 'ai' | 'system'
const TAB_IDS: Tab[] = ['site', 'layout', 'reading', 'appearance', 'seo', 'connections', 'system']

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
const COL = 'space-y-5'

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
    <div className="pb-24">
      <PageHeader title={t.settingsTitle} />
      <div className={SHEET}>
        <SheetTop>
          <Tabs tabs={TABS} value={tab} onChange={setTab} size="sm" />
          <span className="flex-1" />
          <SettingsSearch
            tabLabel={(k) => String(TAB_LABEL(k))}
            onPick={(entry) => { setTab(entry.tab); jumpToSetting(String(t[entry.label])) }}
          />
        </SheetTop>
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
          <div className={COL}>
            <Card panel title={t.cardFeatures}>
              <PostFeatureFields
                features={s.features}
                onChange={(features) => update({ features })}
                relatedCount={s.relatedCount}
                onRelatedCount={(relatedCount) => update({ relatedCount })}
              />
            </Card>
          </div>
          <div className={COL}>
            <Card panel title={t.cardListing}>
              <ListingFeatureFields features={s.features} onChange={(features) => update({ features })} />
            </Card>
            <Card panel title={t.cardComments}>
              <CommentFields comments={s.comments} onChange={(comments) => update({ comments })} />
            </Card>
            {/* Not a reader feature at all: it records what the OWNER changed. It sat in the
                middle of the reading switches because there was one list to put it in. */}
            <Card panel title={t.cardActivity}>
              <ActivityLogField features={s.features} onChange={(features) => update({ features })} />
            </Card>
          </div>
        </div>
      )}

      {/* APPEARANCE — palette + escape hatch left, the type stack right. */}
      {tab === 'appearance' && (
        <div className={GRID}>
          <div className={COL}>
            <Card panel title={t.navAppearance}>
              <p className={`${NOTE_TEXT} mb-4 rounded-lg bg-neutral-50 px-3 py-2 dark:bg-neutral-800/60`}>
                {t.themeAdminNote}
              </p>
              <ThemeFields
                presets={presets}
                themes={s.themes}
                defaultId={s.themePreset}
                enabled={s.enabledPalettes}
                scheme={s.defaultScheme}
                onChangeThemes={(themes) => update({ themes })}
                onSetDefault={(themePreset) => update({ themePreset })}
                onChangeEnabled={(enabledPalettes) => update({ enabledPalettes })}
                onChangeScheme={(defaultScheme) => update({ defaultScheme })}
              />
            </Card>
            <Card panel title={t.customCss}>
              <div className="space-y-1.5">
                <textarea
                  value={s.customCss}
                  onChange={(e) => update({ customCss: e.target.value })}
                  rows={8}
                  spellCheck={false}
                  placeholder={'.prose h2 { letter-spacing: -0.01em }'}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                />
                <p className={NOTE_TEXT}>{t.customCssHint}</p>
              </div>
            </Card>
          </div>
          <div className={COL}>
            <Card panel title={t.cardFont}>
              <FontFields
                value={s.fontPreset}
                onChange={(fontPreset, typography) => update({ fontPreset, typography })}
                chromeFont={s.chromeFont}
                onChromeFont={(chromeFont) => update({ chromeFont })}
              />
              <div className="mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">
                <FontUpload value={s.customFont} onChange={(customFont) => update({ customFont })} />
              </div>
            </Card>
            <Card panel title={t.cardTypography}
              actions={<ResetButton onClick={() => typographyReset.current?.()} label={t.resetDefault} />}>
              <TypographyFields
                typography={s.typography} fontPreset={s.fontPreset} resetRef={typographyReset}
                onChange={(typography) => update({ typography })}
              />
            </Card>
            <Card panel title={t.cardRendering}>
              <AdvancedFields
                typography={s.typography}
                onTypography={(typography) => update({ typography })}
                ideChrome={s.ideChrome}
                onIdeChrome={(ideChrome) => update({ ideChrome })}
                motion={s.motion}
                onMotion={(motion) => update({ motion })}
                autosaveSeconds={s.autosaveSeconds}
                onAutosaveSeconds={(autosaveSeconds) => update({ autosaveSeconds })}
              />
            </Card>
          </div>
        </div>
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
            <Card panel title={t.cardCloudflare}>
              <CloudflareFields configured={integrations.cloudflareConfigured} zoneId={integrations.cloudflareZoneId} />
            </Card>
          </div>
          <div className={COL}>
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
        <SettingsSystemTab s={s} update={update} updateStatus={updateStatus} grid={GRID} col={COL} />
      )}

      {/* One always-reachable save bar, offset past the sidebar via the --admin-nav-w the
          sidebar publishes, so it follows the rail's collapse state. */}
        </div>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200/80 bg-white/90 shadow-[0_-8px_24px_rgba(0,0,0,0.04)] backdrop-blur-xl md:left-[var(--admin-nav-w,13rem)] dark:border-neutral-800 dark:bg-neutral-900/90">
        <div className="mx-auto flex w-full max-w-[1480px] items-center justify-between px-4 py-3 sm:px-7 lg:px-10 xl:px-12">
          <span className="text-sm text-neutral-400 dark:text-neutral-500">
            {saving ? t.saving : savedAt ? `${t.savedAtPrefix} ${formatTime(savedAt)}` : ''}
          </span>
          <Button onClick={save} disabled={saving}>
            {saving ? t.saving : t.saveSettings}
          </Button>
        </div>
      </div>
    </div>
  )
}
