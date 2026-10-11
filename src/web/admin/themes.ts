// Themes installed from a zip, for the owner (ADR 0072, T2): install, list, roll back, remove.
// Every route is on the owner-gated router (Invariant 4), and every write empties the cache on
// the way out through the gate (Invariant 1). The admin screen that calls these is the Look card
// on Settings → Appearance (`web/admin/screens/settings-appearance-installed.ts`, T2c).
//
// Each write that changed something goes in the activity log, as the owner's other writes do: an
// install with its version, a rollback with the version left and the one current again, a
// removal. An install that found the same package already there changed nothing and is not logged.
//
// A refused package is `422` with the checker's findings, `{ success: false, error:
// 'theme_refused', violations }`: one `{ rule, file, line, col, subject }` per finding, which the
// admin turns into sentences from `locales/`. Nothing is stored when anything is refused.

import type { Context } from 'hono'
import { THEME_LIMITS } from '@/theme'
import { isThemeId } from '@/content/themes-builtin'
import { installTheme, listInstalledThemes, removeTheme, rollbackTheme } from '@/content/installed-themes'
import { logActivity } from '@/server/activity'
import { fail, json } from '@/web/api'
import { ownerRouter, param } from '@/web/guard'
import { handlePreviewEnter } from '@/web/theme-preview'

/** The `:id` of the path, or null when it cannot be a theme id. */
const idOf = (c: Context): string | null => {
  const id = param(c, 'id')
  return isThemeId(id) ? id : null
}

export function themeRoutes() {
  const router = ownerRouter()

  // The zip as the `file` field of a multipart form, as every other upload here. The body is
  // capped before this runs (`web/body-cap.ts`, `capThemeUploads`).
  router.post('/api/themes', async (c) => {
    const form = await c.req.formData().catch(() => null)
    const file = form?.get('file')
    if (!(file instanceof File)) return fail(c, 'no_file', 400)
    if (file.size > THEME_LIMITS.zipBytes) return fail(c, 'file_too_large', 413)
    const result = await installTheme(new Uint8Array(await file.arrayBuffer()))
    if (!result.ok) {
      console.log(`theme refused: ${result.violations.length} finding(s), first ${result.violations[0]?.rule ?? '-'}`)
      return c.json({ success: false, error: 'theme_refused', violations: result.violations }, 422)
    }
    console.log(`theme ${result.id} ${result.version} ${result.changed ? 'installed' : 'already installed'} as ${result.hash}`)
    if (result.changed) void logActivity('theme.install', `${result.id} ${result.version}`)
    return json({ id: result.id, version: result.version, hash: result.hash, changed: result.changed })
  })

  router.get('/api/themes', async () => json(await listInstalledThemes()))

  // Preview, from a tile: a GET, so it writes nothing, flushes nothing and logs no activity. It
  // sets the preview cookie and sends the new tab to the home page (`web/theme-preview.ts`).
  router.get('/api/themes/:id/preview', (c) => handlePreviewEnter(param(c, 'id')))

  router.delete('/api/themes/:id', async (c) => {
    const id = idOf(c)
    const removed = id === null ? 0 : await removeTheme(id)
    if (removed === 0) return fail(c, 'not_found', 404)
    void logActivity('theme.remove', `${id}`)
    return json({ id, removed })
  })

  router.post('/api/themes/:id/rollback', async (c) => {
    const id = idOf(c)
    if (id === null) return fail(c, 'not_found', 404)
    const result = rollbackTheme(id)
    if (!result.ok) return fail(c, result.error, result.error === 'not_found' ? 404 : 409)
    void logActivity('theme.rollback', `${result.id} ${result.removed.version} → ${result.current.version}`)
    return json({ id: result.id, current: result.current, removed: result.removed })
  })

  return router
}
