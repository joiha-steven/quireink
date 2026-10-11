// Whether the theme the blog has chosen is the theme the public site is drawing (ADR 0072, T2c).
//
// The public side never fails over a theme: an installed theme with no live row, or one whose
// manifest does not read, is drawn as plain with a warning in the log (`content/chosen-theme.ts`),
// and a sheet missing from the store is a `404` the reader never sees. That is right for a reader
// and silent for the owner, whose Look screen would still show the theme as chosen. This answers
// the owner's question instead, so the admin can say the site is drawn as Plain, and why.
//
// Server only: it reads the database and the blob store.

import { isBuiltinThemeId } from '@/content/themes-builtin'
import { installedTheme, isLiveInstalledTheme } from '@/content/chosen-theme'
import { themeBlobPath } from '@/media/theme-blobs'

/**
 * `missing`: no live version of the chosen id (removed outside the admin, or a backup that named
 * a theme it did not carry). `unreadable`: a live row whose manifest the renderer refuses.
 * `sheet_missing`: the row reads, but its `theme.css` is not in the blob store.
 */
export type ThemeTrouble = 'missing' | 'unreadable' | 'sheet_missing'

export type ThemeHealth = { ok: true } | { ok: false; id: string; why: ThemeTrouble }

const HEALTHY: ThemeHealth = { ok: true }

/** Whether the store holds `pathname`. A store that cannot be asked counts as not holding it. */
async function stored(pathname: string): Promise<boolean> {
  try {
    await (await import('@/runtime/impl/blob')).statSize(pathname)
    return true
  } catch {
    return false
  }
}

/** Whether `settings.theme` draws as itself; a built-in theme always does. */
export async function chosenThemeHealth(settings: { theme: string }): Promise<ThemeHealth> {
  const id = settings.theme
  if (isBuiltinThemeId(id)) return HEALTHY
  if (!isLiveInstalledTheme(id)) return { ok: false, id, why: 'missing' }
  const theme = installedTheme(id)
  if (!theme?.package) return { ok: false, id, why: 'unreadable' }
  if (!(await stored(themeBlobPath(theme.package.hash, 'theme.css')))) {
    console.warn(`[WARN] theme ${id}: themes/${theme.package.hash}/theme.css is not in the store; the site is drawn without its sheet`)
    return { ok: false, id, why: 'sheet_missing' }
  }
  return HEALTHY
}
