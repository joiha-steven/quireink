// The slim bar across the top of a page drawn as a theme preview (ADR 0072, T2c), and the two
// head lines that go with it. Drawn by `renderDocument` only while a preview is open for the
// request (`server/theme-preview-scope.ts`), which only `web/theme-preview.ts` opens, for the
// signed-in owner. A reader's page has none of it, and the page cache never holds one.
//
// IN THE FLOW, NOT FIXED. A fixed bar covers the first lines of the page it sits on, and every
// page would need an offset for it; a block before the page's own markup pushes the page down
// by exactly its height and covers nothing.
//
// THE WORDS ARE THE ADMIN'S, in the site's language: the bar is the owner's control, like the
// Look card it came from, and the built-in themes are named there (`nameKey`).
//
// THE COLOURS ARE THE PAGE'S TOKENS, inverted as a selection is (`public.css.ts`): heading ink as
// the ground and the page's own background as the text, so the bar reads on every palette, light
// and dark, of every theme, and a theme's sheet cannot restyle it (it is unlayered, after the
// theme's layer). The gutter is the reading column's (`.wrap`, and 1.5rem under 640px in
// `mobile.css.ts`), so the bar's words start where the site's title does.
import type { SiteSettings } from '@/types'
import { adminT } from '@/i18n/admin-i18n'
import { builtinTheme, isBuiltinThemeId } from '@/content/themes-builtin'
import { installedThemeName } from '@/content/installed-themes'
import { currentThemePreview } from '@/server/theme-preview-scope'
import { escapeAttr, escapeHtml } from '@/utils'
import { leaveHref } from '@/web/theme-preview-paths'

const CSS = '.theme-preview{background:var(--c-heading);color:var(--c-bg);font-size:var(--fs-small);line-height:1.5}'
  + '.theme-preview-in{max-width:var(--shell-w,42rem);margin:0 auto;padding:calc(var(--sp) * .5) 2rem;'
  + 'display:flex;flex-wrap:wrap;align-items:center;column-gap:var(--sp);row-gap:calc(var(--sp) * .25)}'
  + '.theme-preview-what{margin:0;flex:1 1 12rem;min-width:0;overflow-wrap:anywhere}'
  + '.theme-preview-what strong{font-weight:var(--fw-heading,600)}'
  + '.theme-preview a{color:inherit;display:inline-flex;align-items:center;min-height:1.5rem;'
  + 'text-decoration:underline;text-underline-offset:.2em}'
  + '.theme-preview a:focus-visible{outline-color:currentColor}'
  + '@media (max-width:639px){.theme-preview-in{padding-left:max(1.5rem,env(safe-area-inset-left,0px));'
  + 'padding-right:max(1.5rem,env(safe-area-inset-right,0px))}}'
  // A finger's 44px, as the site's own keys get under a coarse pointer (`mobile.css.ts`), and at a
  // phone's width whatever the pointer.
  + '@media (max-width:639px),(pointer:coarse){.theme-preview a{min-height:2.75rem}}'

/** What `renderDocument` adds to a previewed page: a robots line, the bar's rules and the bar. */
export type PreviewBar = { robots: string; style: string; bar: string }

/** The theme's name as the owner knows it: a built-in in the admin's words, an installed one by its manifest. */
function themeName(settings: SiteSettings, themeId: string): string {
  if (isBuiltinThemeId(themeId)) return adminT(settings.language)[builtinTheme(themeId).nameKey]
  return installedThemeName(themeId) ?? themeId
}

/** The bar for the preview open in this request, or null on every page a reader gets. */
export function themePreviewBar(settings: SiteSettings): PreviewBar | null {
  const preview = currentThemePreview()
  if (preview === null) return null
  const t = adminT(settings.language)
  const name = `<strong>${escapeHtml(themeName(settings, preview.themeId))}</strong>`
  // The template is escaped first and the name put in after, so a name can carry no markup and
  // a translation can put it anywhere in the sentence.
  const what = escapeHtml(t.themePreviewing).replace('{theme}', () => name)
  const choose = leaveHref(`/admin/settings?tab=appearance&pick-theme=${encodeURIComponent(preview.themeId)}`)
  return {
    robots: '<meta name="robots" content="noindex, nofollow">',
    style: `<style data-theme-preview-css>${CSS}</style>`,
    bar: `<div class="theme-preview" role="region" aria-labelledby="theme-preview-what"`
      + ` data-theme-preview="${escapeAttr(preview.themeId)}"><div class="theme-preview-in">`
      + `<p class="theme-preview-what" id="theme-preview-what">${what}</p>`
      + `<a href="${escapeAttr(choose)}" data-theme-preview-choose>${escapeHtml(t.themePreviewChoose)}</a>`
      + `<a href="${escapeAttr(leaveHref(preview.path))}" data-theme-preview-leave>${escapeHtml(t.themePreviewLeave)}</a>`
      + `</div></div>\n`,
  }
}
