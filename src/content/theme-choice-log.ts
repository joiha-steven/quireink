// The activity line for choosing a theme (ADR 0072, T2c), written by every door that can choose
// one: the settings save (`web/admin/site.ts`) and the MCP tool `update_appearance`
// (`mcp/tools-steward.ts`). One helper, so the two cannot drift into two spellings of one event.
//
// THE DETAIL IS THE ID, AND THE NAME WHEN ONLY THE ROW KNOWS IT. A built-in theme is logged as its
// id and named at display time in the reader's language (`admin-shared/log-sentence.ts`); an
// installed one as `Name (id)`, its manifest's name as it was when chosen, since the row may be
// gone by the time the log is read.

import { isBuiltinThemeId } from '@/content/themes-builtin'
import { installedThemeName } from '@/content/installed-themes'
import { logActivity } from '@/server/activity'

/** What `theme.choose` records for `themeId`. */
export function themeChoiceDetail(themeId: string): string {
  if (isBuiltinThemeId(themeId)) return themeId
  const name = installedThemeName(themeId)
  return name && name !== themeId ? `${name} (${themeId})` : themeId
}

/** Log `theme.choose` when a save moved the theme; nothing when it did not. */
export async function logThemeChoice(before: { theme: string }, after: { theme: string }): Promise<void> {
  if (before.theme !== after.theme) await logActivity('theme.choose', themeChoiceDetail(after.theme))
}
