// Writing the settings row: merge a partial update over what is stored, and persist it.
//
// Split from `settings.ts` when that file reached its ceiling. The seam is by direction: that
// file READS the row and answers with it, this one is the only thing that writes it.

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { SiteSettings } from '@/types'
import { DEFAULT_SETTINGS, getSettings } from '@/content/settings'
import { collapseBlob, deleteByPathname } from '@/media/blob'
import { renderLogo } from '@/media/files'
import { one, run } from '@/store/query'
import { db } from '@/store/db'
import { isSiteLang } from '@/locales/langs'
import { sanitizeNavOrder } from '@/content/nav-order'
import { isPresetId, isFontPresetId, isChromeFontId, isScheme } from '@/content/themes'
import {
  sanitizeMenu, sanitizeThemes, sanitizeEnabledPalettes, sanitizeSeo, sanitizeFeatures,
  sanitizeHome, sanitizeGallery, sanitizeFigure, sanitizeMcp, sanitizeMotion, sanitizeCache,
  sanitizeDashboard, sanitizeBackups, sanitizeComments, sanitizeCss, sanitizeSnippet,
  sanitizeUrl, clampNumber, sanitizeFeatured, sanitizeTimezone, sanitizeAi, sanitizeInks,
} from '@/content/settings-sanitize'
import { sanitizeTypography, sanitizeFont } from '@/content/settings-type'
import { sanitizePostImage, sanitizeShape, sanitizeAuthor } from '@/content/settings-shape'
import { sanitizeTable } from '@/content/settings-table'

/**
 * WHAT THE ROUTE HANDS OVER IS JSON, AND JSON HAS NO TYPES WORTH TRUSTING.
 *
 * The merge read a dozen free-text fields straight off the payload with `??`, which keeps
 * anything that is not null. `{"title": 5}` threw inside `.trim()` and came back a 500 where
 * it should have been a refusal; `{"description": 5}` was STORED, and then every public page
 * threw at `escapeHtml` until somebody put a string back through the API — which could not be
 * done from the settings screen, because that screen loads the same block.
 *
 * Only the owner can reach the route, so this was never a way in. It was a way to break a
 * blog with one mistyped field, from the tool built to configure it.
 */
const text = (value: unknown, fallback: string): string =>
  typeof value === 'string' ? value : fallback

const yesNo = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback

/**
 * A settings blob that will not parse is READ as the defaults, and this is what writes over
 * it. Without the rescue below, one corrupt byte in that row turned the next press of Save
 * into a factory reset with nothing to go back to: the defaults plus whatever that one save
 * carried, written over everything the owner had ever chosen.
 *
 * Kept beside the database rather than in the row, which is a single row by schema. Nothing
 * reads it back automatically; it exists so the answer is recoverable by hand.
 */
function rescueUnreadable(): void {
  const row = one<{ data: string }>(`select data from settings where id = 1`)
  if (!row) return
  try {
    JSON.parse(row.data)
    return
  } catch {
    /* falls through to the rescue */
  }
  try {
    const at = new Date().toISOString().replace(/[:.]/g, '-')
    const file = join(dirname(db().filename), `settings-unreadable-${at}.json`)
    writeFileSync(file, row.data)
    console.error(`[ERROR] settings.saveSettings: the stored settings would not parse; kept a copy at ${file}`)
  } catch (error) {
    console.error(`[ERROR] settings.saveSettings: could not keep a copy of the unreadable settings: ${(error as Error).message}`)
  }
}

/**
 * ONE SAVE AT A TIME.
 *
 * This is a read-modify-write with several awaits inside it: the whole block is read, then a
 * logo is re-rendered (sharp, hundreds of milliseconds) and derived files are deleted, and
 * only then is the whole block written back from what was read at the start. Two saves that
 * overlap therefore end with the second silently erasing the first, and the activity log
 * records both as successes. It is easy to overlap: the rail writes a save on every drag, the
 * MCP steward tools call this, and the settings screen has eleven tabs.
 *
 * A queue rather than a lock, so a caller never has to handle "busy": saves are rare and
 * short, and the second one simply happens after the first, against what the first wrote.
 */
let queue: Promise<unknown> = Promise.resolve()

export function saveSettings(input: Partial<SiteSettings>): Promise<SiteSettings> {
  const mine = queue.then(() => applySave(input), () => applySave(input))
  // The chain must not break on a rejection, or every later save inherits the failure.
  queue = mine.catch(() => {})
  return mine
}

async function applySave(input: Partial<SiteSettings>): Promise<SiteSettings> {
  const current = await getSettings()

  // Logo: keep the original untouched; (re)build the small display WebP when the
  // source/width changes or none exists yet. Delete the prior derived file (one
  // ever exists); clear when logo removed/hidden. Vector/animated → null (served as-is).
  const showLogo = yesNo(input.showLogo, current.showLogo)
  const logoUrl = text(input.logoUrl, current.logoUrl)
  const logoWidth = clampNumber(input.logoWidth, 24, 600, current.logoWidth)
  let logoRenderUrl = current.logoRenderUrl
  let logoRenderHeight = current.logoRenderHeight
  let logoEmailUrl = current.logoEmailUrl
  // Both derived files are rebuilt and cleaned up together — the email PNG twin must
  // never outlive the logo it was made from, or a stale mark ships in a newsletter.
  const dropDerived = async () => {
    if (current.logoRenderUrl) await deleteByPathname(collapseBlob(current.logoRenderUrl)).catch(() => {})
    if (current.logoEmailUrl) await deleteByPathname(collapseBlob(current.logoEmailUrl)).catch(() => {})
  }
  if (!showLogo || !logoUrl) {
    await dropDerived()
    logoRenderUrl = ''
    logoRenderHeight = 0
    logoEmailUrl = ''
  } else if (logoUrl !== current.logoUrl || logoWidth !== current.logoWidth || !current.logoRenderUrl) {
    const rendered = await renderLogo(logoUrl, logoWidth)
    await dropDerived()
    logoRenderUrl = rendered?.url ?? ''
    logoRenderHeight = rendered?.height ?? 0
    logoEmailUrl = rendered?.emailUrl ?? ''
  }

  // The dark twin, same pipeline and same width so the two marks are interchangeable in
  // the header. It has no email variant: a newsletter has no dark mode to respond to.
  const logoDarkUrl = text(input.logoDarkUrl, current.logoDarkUrl)
  let logoDarkRenderUrl = current.logoDarkRenderUrl
  let logoDarkRenderHeight = current.logoDarkRenderHeight
  const dropDark = async () => {
    if (current.logoDarkRenderUrl) {
      await deleteByPathname(collapseBlob(current.logoDarkRenderUrl)).catch(() => {})
    }
  }
  if (!showLogo || !logoDarkUrl) {
    await dropDark()
    logoDarkRenderUrl = ''
    logoDarkRenderHeight = 0
  } else if (
    logoDarkUrl !== current.logoDarkUrl
    || logoWidth !== current.logoWidth
    || !current.logoDarkRenderUrl
  ) {
    const rendered = await renderLogo(logoDarkUrl, logoWidth)
    await dropDark()
    logoDarkRenderUrl = rendered?.url ?? ''
    logoDarkRenderHeight = rendered?.height ?? 0
  }

  // The (possibly new) default palette — used both as `themePreset` and as the
  // always-included member of `enabledPalettes`.
  const themePreset = isPresetId(input.themePreset) ? input.themePreset : current.themePreset

  const next: SiteSettings = {
    language: isSiteLang(input.language) ? input.language : current.language,
    title: text(input.title, current.title).trim() || DEFAULT_SETTINGS.title,
    description: text(input.description, current.description),
    siteUrl: input.siteUrl !== undefined ? sanitizeUrl(input.siteUrl) : current.siteUrl,
    logoUrl,
    logoWidth,
    logoRenderUrl,
    logoRenderHeight,
    logoEmailUrl,
    logoDarkUrl,
    logoDarkRenderUrl,
    logoDarkRenderHeight,
    showLogo,
    showDescription: yesNo(input.showDescription, current.showDescription),
    faviconUrl: text(input.faviconUrl, current.faviconUrl),
    appIconUrl: text(input.appIconUrl, current.appIconUrl),
    // Never unset by a merge: an owner who dismissed the steps has dismissed them, and a
    // PUT that omits the flag is every other settings save on the screen.
    firstRunDone: yesNo(input.firstRunDone, current.firstRunDone),
    setupDone: yesNo(input.setupDone, current.setupDone),
    contentWidth: clampNumber(input.contentWidth, 360, 1600, current.contentWidth),
    postsPerPage: clampNumber(input.postsPerPage, 1, 100, current.postsPerPage),
    relatedCount: clampNumber(input.relatedCount, 0, 12, current.relatedCount),
    excerptLength: clampNumber(input.excerptLength, 10, 100, current.excerptLength),
    autosaveSeconds: clampNumber(input.autosaveSeconds, 15, 600, current.autosaveSeconds),
    maxUploadMb: clampNumber(input.maxUploadMb, 0, 4096, current.maxUploadMb),
    storageQuotaGb: clampNumber(input.storageQuotaGb, 0, 4096, current.storageQuotaGb),
    customCss: input.customCss !== undefined ? sanitizeCss(input.customCss) : current.customCss,
    navOrder: input.navOrder !== undefined ? sanitizeNavOrder(input.navOrder, current.navOrder) : current.navOrder,
    customHead: input.customHead !== undefined ? sanitizeSnippet(input.customHead) : current.customHead,
    customBodyEnd: input.customBodyEnd !== undefined
      ? sanitizeSnippet(input.customBodyEnd) : current.customBodyEnd,
    // Footer is rendered through renderInlineMarkdown (escape-first), so here we only
    // trim + cap length; markup safety is the renderer's job.
    footer: typeof input.footer === 'string' ? input.footer.slice(0, 600) : current.footer,
    menu: sanitizeMenu(input.menu, current.menu),
    featured: sanitizeFeatured(input.featured, current.featured),
    mostViewedCount: clampNumber(input.mostViewedCount, 0, 10, current.mostViewedCount),
    sidebarLayout: input.sidebarLayout === 'two' || input.sidebarLayout === 'single' ? input.sidebarLayout : current.sidebarLayout,
    defaultScheme: isScheme(input.defaultScheme) ? input.defaultScheme : current.defaultScheme,
    themePreset,
    fontPreset: isFontPresetId(input.fontPreset) ? input.fontPreset : current.fontPreset,
    chromeFont: isChromeFontId(input.chromeFont) ? input.chromeFont : current.chromeFont,
    ideChrome: typeof input.ideChrome === 'boolean' ? input.ideChrome : current.ideChrome,
    enabledPalettes: sanitizeEnabledPalettes(input.enabledPalettes ?? current.enabledPalettes, themePreset),
    themes: sanitizeThemes(input.themes, current.themes),
    typography: sanitizeTypography(input.typography, current.typography),
    customFont: sanitizeFont(input.customFont, current.customFont),
    seo: sanitizeSeo(input.seo, current.seo),
    features: sanitizeFeatures(input.features, current.features),
    home: sanitizeHome(input.home, current.home),
    figure: sanitizeFigure(input.figure, current.figure),
    gallery: sanitizeGallery(input.gallery, current.gallery),
    postImage: sanitizePostImage(input.postImage, current.postImage),
    shape: sanitizeShape(input.shape, current.shape),
    table: sanitizeTable(input.table, current.table),
    author: sanitizeAuthor(input.author, current.author),
    comments: sanitizeComments(input.comments, current.comments),
    mcp: sanitizeMcp(input.mcp, current.mcp),
    ai: sanitizeAi(input.ai, current.ai),
    inks: sanitizeInks(input.inks, current.inks),
    motion: sanitizeMotion(input.motion, current.motion),
    cache: sanitizeCache(input.cache, current.cache),
    dashboard: sanitizeDashboard(input.dashboard, current.dashboard),
    backups: sanitizeBackups(input.backups, current.backups),
    timezone: input.timezone !== undefined ? sanitizeTimezone(input.timezone, current.timezone) : current.timezone,
    updateCheck: typeof input.updateCheck === 'boolean' ? input.updateCheck : current.updateCheck,
  }
  // Persist image refs store-relative (collapse); keep `next` absolute for the client.
  const stored: SiteSettings = {
    ...next,
    logoUrl: collapseBlob(next.logoUrl),
    logoRenderUrl: collapseBlob(next.logoRenderUrl),
    logoEmailUrl: collapseBlob(next.logoEmailUrl),
    logoDarkUrl: collapseBlob(next.logoDarkUrl),
    logoDarkRenderUrl: collapseBlob(next.logoDarkRenderUrl),
    faviconUrl: collapseBlob(next.faviconUrl),
    appIconUrl: collapseBlob(next.appIconUrl),
    customFont: { ...next.customFont, faces: next.customFont.faces.map((x) => ({ ...x, url: collapseBlob(x.url) })) },
    seo: { ...next.seo, ogFallbackImage: collapseBlob(next.seo.ogFallbackImage) },
  }
  rescueUnreadable()
  run(
    `insert into settings (id, data) values (1, $data)
     on conflict(id) do update set data = excluded.data`,
    { data: JSON.stringify(stored) },
  )
  return next
}
