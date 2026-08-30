// MCP tool definitions: media, files and settings. Same data-layer functions as
// the admin routes. Media/file deletes are soft (move to Trash) and KEEP the blob;
// permanent removal stays owner-only via the Trash UI.
//
// Settings are deliberately split: an agent can READ everything but may only WRITE
// a small, safe allowlist (title / description / showDescription). Sensitive
// settings — theme, fonts, typography, menu, domain (siteUrl), SEO, features,
// language, logos/icons, custom CSS — are simply not exposed here, so they can't
// be changed over MCP at all.

import { z } from 'zod'
import type { ToolHost } from '@/mcp/registry'
import type { SiteSettings } from '@/types'
import { getMedia, addMedia, deleteMedia, restoreMediaBatch, getTrashedMedia } from '@/media/media'
import { getFiles, deleteFile, restoreFilesBatch, getTrashedFiles } from '@/media/files'
import { checkUpload, readCapped, uploadLimits } from '@/media/limits'
import { getSettings, saveSettings } from '@/content/settings'
import { SETTING_PATHS, getAt, isSettingPath, patchAt, typeOfPath } from '@/content/settings-path'
import { clearCache } from '@/server/cache'
import { logActivity } from '@/server/activity'
import { safeFetch, BlockedUrlError } from '@/server/safe-fetch'
import { bringImagesHome, filenameFromUrl } from '@/import/images'
import { asText, asJson, asError } from '@/mcp/result'

export function registerLibraryTools(server: ToolHost): void {
  registerMediaTools(server)
  registerFileTools(server)
  registerSettingsTools(server)
}

function registerMediaTools(server: ToolHost): void {
  server.registerTool(
    'list_media',
    { readOnly: true, description: 'List the live media library (images), newest first.', inputSchema: {} },
    async () => asJson((await getMedia()).map((m) => ({ url: m.url, filename: m.filename, width: m.width, height: m.height, size: m.size }))),
  )

  server.registerTool(
    'add_media_from_url',
    {
      description: 'Fetch an image from a URL and add it to the media library (stored on Blob). Supports JPG, PNG, SVG, GIF, WebP. Returns the new media item — use its url as a post featuredImage or inline image.',
      inputSchema: { url: z.string().url(), filename: z.string().optional() },
    },
    async ({ url, filename }) => {
      let res: Response
      try {
        // SSRF guard: url comes from any MCP bearer token; block internal targets.
        res = await safeFetch(url)
      } catch (e) {
        if (e instanceof BlockedUrlError) return asError(`Blocked URL: ${url}`)
        return asError(`Could not fetch: ${url}`)
      }
      if (!res.ok) return asError(`Fetch failed (${res.status}): ${url}`)
      const contentType = res.headers.get('content-type')?.split(';')[0]?.trim() ?? ''
      // Capped while READING (media/limits.ts). This is the one byte path no reverse proxy
      // can cap, because the bytes arrive on a fetch this server made.
      const { maxFileBytes, storeQuotaBytes } = await uploadLimits()
      const read = await readCapped(res, maxFileBytes)
      if ('tooLarge' in read) return asError(`Image is larger than the ${read.limit}-byte upload limit: ${url}`)
      const body = read.body
      const refusal = await checkUpload([body.byteLength])
      if (refusal !== null) {
        return asError(refusal.reason === 'quota_exceeded'
          ? `Storage quota reached (${storeQuotaBytes} bytes): ${url}`
          : `Image is larger than the ${refusal.limit}-byte upload limit: ${url}`)
      }
      try {
        const item = await addMedia(filename || filenameFromUrl(url), body, contentType)
        await logActivity('media.upload', item.filename)
        return asJson(item)
      } catch (e) {
        return asError((e as Error).message)
      }
    },
  )

  server.registerTool(
    'import_images',
    {
      description: 'Bring remote images home: fetch one batch of images that posts/pages still load from OTHER hosts, store them in the media library, and rewrite every reference. Call repeatedly until `remaining` is 0 — stop early when a call reports `moved: 0`, because what is left only fails.',
      inputSchema: {},
    },
    async () => {
      const report = await bringImagesHome()
      if (report.moved > 0) await logActivity('import.images', `${report.moved} moved, ${report.remaining} left`)
      return asJson(report)
    },
  )

  server.registerTool(
    'delete_media',
    { description: 'Move a media item to the Trash (soft delete — the blob is kept; recoverable).', inputSchema: { url: z.string() } },
    async ({ url }) => {
      await deleteMedia(url)
      await logActivity('media.delete', '1 image')
      return asText(`Moved media to Trash: ${url}`)
    },
  )

  server.registerTool(
    'restore_media',
    { description: 'Restore a trashed media item back to the live library.', inputSchema: { url: z.string() } },
    async ({ url }) => {
      await restoreMediaBatch([url])
      await logActivity('media.restore', '1 image')
      return asText(`Restored media: ${url}`)
    },
  )

  server.registerTool(
    'list_trashed_media',
    { readOnly: true, description: 'List media items currently in the Trash.', inputSchema: {} },
    async () => asJson((await getTrashedMedia()).map((m) => ({ url: m.url, filename: m.filename, deletedAt: m.deletedAt }))),
  )
}

function registerFileTools(server: ToolHost): void {
  server.registerTool(
    'list_files',
    { readOnly: true, description: 'List the live file attachment library (non-image files), newest first.', inputSchema: {} },
    async () => asJson((await getFiles()).map((f) => ({ url: f.url, filename: f.filename, contentType: f.contentType, size: f.size }))),
  )

  server.registerTool(
    'delete_file',
    { description: 'Move a file attachment to the Trash (soft delete — the blob is kept; recoverable).', inputSchema: { url: z.string() } },
    async ({ url }) => {
      await deleteFile(url)
      await logActivity('file.delete', '1 file')
      return asText(`Moved file to Trash: ${url}`)
    },
  )

  server.registerTool(
    'restore_file',
    { description: 'Restore a trashed file attachment back to the live library.', inputSchema: { url: z.string() } },
    async ({ url }) => {
      await restoreFilesBatch([url])
      await logActivity('file.restore', '1 file')
      return asText(`Restored file: ${url}`)
    },
  )

  server.registerTool(
    'list_trashed_files',
    { readOnly: true, description: 'List file attachments currently in the Trash.', inputSchema: {} },
    async () => asJson((await getTrashedFiles()).map((f) => ({ url: f.url, filename: f.filename, deletedAt: f.deletedAt }))),
  )
}

function registerSettingsTools(server: ToolHost): void {
  server.registerTool(
    'get_settings',
    { readOnly: true, description: 'Read the full site settings (read-only).', inputSchema: {} },
    async () => asJson(await getSettings()),
  )

  server.registerTool(
    'list_settings',
    {
      readOnly: true,
      description:
        'Every setting that can be changed by name: its path, what kind of answer it takes, '
        + 'and what it is set to now. Use this to find the path for update_settings rather '
        + 'than guessing one. Optional `contains` narrows the list to paths matching a word.',
      inputSchema: { contains: z.string().optional().describe('e.g. "font", "comment", "backup"') },
    },
    async ({ contains }) => {
      const current = await getSettings()
      const needle = (contains ?? '').toLowerCase()
      const rows = SETTING_PATHS
        .filter((path) => !needle || path.toLowerCase().includes(needle))
        .map((path) => ({ path, type: typeOfPath(path), value: getAt(current, path) }))
      return asJson({ count: rows.length, settings: rows })
    },
  )

  server.registerTool(
    'update_settings',
    {
      // WHAT CHANGED, AND WHY IT IS SAFE NOW. This tool wrote three fields — title,
      // description, showDescription — and its own description said the rest "cannot be
      // changed over MCP". That restriction was written when every token was all-powerful and
      // when nothing had proved that a partial save leaves the rest of the tree alone.
      //
      // Both have moved. Tokens carry a scope since 2026-08-2x, and a `read` token's door
      // never registers a write tool at all (`mcp-transport.ts`). And the deep merge is now
      // asserted for EVERY path, one at a time, with the other 154 watched
      // (`content/settings-path.test.ts`) — so a patch built from one path can no more damage
      // a neighbour than the admin's own Save button can.
      //
      // The route to disk is unchanged and deliberately so: `saveSettings`, which sanitises,
      // clamps and refuses exactly as it does for the form. NOTHING reachable here is
      // anything the owner's own screens could not already do.
      description:
        'Change any site setting by path — call list_settings first to find the path. The value '
        + 'is sanitised exactly as the admin\'s own Save does, and everything not named is left '
        + 'alone. Two are worth naming before you change them because they affect every page a '
        + 'reader loads: `customCss` and `siteUrl`. The three named arguments are the older '
        + 'shorthand and still work.',
      inputSchema: {
        path: z.string().optional().describe('Dotted path, e.g. features.search or typography.roles.body.size'),
        value: z.union([z.string(), z.number(), z.boolean()]).optional(),
        title: z.string().optional(),
        description: z.string().optional(),
        showDescription: z.boolean().optional(),
      },
    },
    async (args) => {
      // Only the allowlisted keys above can reach saveSettings (which merges over
      // current), so nothing sensitive is ever touched.
      //
      // That was not true until 2026-08-02. `saveSettings` merges every field EXCEPT three
      // that hard-coded their default instead of their fallback, so a patch carrying just a
      // title moved `home.mode` back to `list` and turned off a composed front page. Fixed
      // in `settings-sanitize.ts` and pinned by "a partial save leaves everything it did not
      // mention alone" in `content/settings.test.ts`, because this comment is a promise
      // about a function in another file.
      const patch: Record<string, unknown> = {}
      if (args.title !== undefined) patch.title = args.title
      if (args.description !== undefined) patch.description = args.description
      if (args.showDescription !== undefined) patch.showDescription = args.showDescription

      if (args.path !== undefined) {
        // A path that is not one is a MISTAKE, not a no-op: silently ignoring it would report
        // success for a setting that never moved, which is the worst answer available.
        if (!isSettingPath(args.path)) {
          return asError(`No setting at "${args.path}". Call list_settings to see the paths.`)
        }
        if (args.value === undefined) return asError('A path needs a value')
        const wanted = typeOfPath(args.path)
        if (wanted !== 'unknown' && typeof args.value !== wanted) {
          return asError(`${args.path} takes a ${wanted}, not a ${typeof args.value}`)
        }
        Object.assign(patch, patchAt(args.path, args.value))
      }
      if (Object.keys(patch).length === 0) return asError('Nothing to update')

      const before = await getSettings()
      const next = await saveSettings(patch as Partial<SiteSettings>)
      clearCache()
      await logActivity('settings.save', args.path ?? undefined)
      // Report the BEFORE as well: the sanitiser clamps, so what was asked for and what
      // landed are not always the same number, and a tool that only echoes the request hides
      // exactly that.
      return asJson(
        args.path
          ? { path: args.path, was: getAt(before, args.path), now: getAt(next, args.path) }
          : { title: next.title, description: next.description, showDescription: next.showDescription },
      )
    },
  )
}
