// The one request a theme preview is drawn for, and nothing else (ADR 0072, T2c).
//
// The owner may look at a theme before choosing it (`web/theme-preview.ts`). The page is drawn
// exactly as a reader's is, by the same renderers, which ask `resolveTheme` for the theme
// several times per page from settings they already hold. So the previewed id is not threaded
// through them: it rides on the request's async context here, and `resolveTheme` reads it.
//
// ⚠️ A SCOPE AND NOT A MODULE VARIABLE, and that is the whole safety of it. A variable set for
// the length of one render would be read by every other request rendering at the same moment,
// and a reader would be drawn in a theme the owner was only looking at. An async context is
// one request's own: a request that did not start inside `withThemePreview` reads null.
//
// WHAT A PREVIEW MUST NEVER REACH: the page cache (`server/cache.ts` refuses to read or store
// while one is open) and the warm (`server/warm.ts` renders outside it). Work a previewed
// request starts and leaves running, a timer or a background fetch, inherits the context; those
// two refusals are what keep such work from writing a previewed page where readers are served.
import { AsyncLocalStorage } from 'node:async_hooks'

/** What is being previewed, and the path the request asked for (where Leave goes back to). */
export type ThemePreview = { themeId: string; path: string }

const scope = new AsyncLocalStorage<ThemePreview | null>()

/** Run `fn` as a preview of `preview.themeId`. Only `web/theme-preview.ts` opens one. */
export function withThemePreview<T>(preview: ThemePreview, fn: () => T): T {
  return scope.run(preview, fn)
}

/** Run `fn` with no preview open, whatever the caller's context holds. */
export function outsidePreview<T>(fn: () => T): T {
  return scope.run(null, fn)
}

/** The preview this request is drawing, or null for every reader and every background job. */
export function currentThemePreview(): ThemePreview | null {
  return scope.getStore() ?? null
}
