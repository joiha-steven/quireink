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
    'update_settings',
    {
      description: 'Update SAFE site settings only: title, description, showDescription. Sensitive settings (theme, fonts, typography, menu, domain, SEO, language, logos) cannot be changed over MCP.',
      inputSchema: {
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
      const patch: Partial<SiteSettings> = {}
      if (args.title !== undefined) patch.title = args.title
      if (args.description !== undefined) patch.description = args.description
      if (args.showDescription !== undefined) patch.showDescription = args.showDescription
      if (Object.keys(patch).length === 0) return asError('Nothing to update')
      const next = await saveSettings(patch)
      clearCache()
      await logActivity('settings.save')
      return asJson({ title: next.title, description: next.description, showDescription: next.showDescription })
    },
  )
}
