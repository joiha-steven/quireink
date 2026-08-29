// The steward's tools: the front page, the site's look, replies, the test send, and a
// snapshot before anything big.
//
// The design constraint on every tool here is that AN AGENT HAS NO EYES. It never sees
// the rendered page, so nothing in this file accepts free-form design input — no hex
// colors, no CSS, no pixel values. What it gets instead are the owner's own curated
// menus: the six palettes and the font presets are choices a blind steward can make
// well ("warm, serif"), because every option in the menu is already a good one.
//
// Two more lines, drawn on purpose:
//  - `send_test_newsletter` can only mail THE OWNER. The recipient is not a parameter.
//    The real broadcast is not here at all: an email cannot be unsent, so pressing that
//    button stays a human act.
//  - `reply_comment` posts under the owner's own name and notifies the parent commenter,
//    exactly like a reply typed into the page — same data path, same activity line.

import { z } from 'zod'
import type { ToolHost } from '@/mcp/registry'
import type { FrontSettings } from '@/types'
import { getSettings, saveSettings } from '@/content/settings'
import { THEME_PRESETS } from '@/content/palettes'
import { FONT_PRESETS, CHROME_FONTS } from '@/content/fonts'
import { getCategories } from '@/content/posts'
import { getPageAnalytics } from '@/analytics/page'
import { addComment } from '@/comments/comments'
import { one } from '@/store/query'
import { notifyReply } from '@/comments/comment-notify'
import { previewBroadcast } from '@/news/broadcast'
import { sendMail } from '@/news/mail'
import { getPublicPosts } from '@/content/posts'
import { runBackup } from '@/server/backup'
import { ownerEmail } from '@/auth/users'
import { clearCache } from '@/server/cache'
import { logActivity } from '@/server/activity'
import { asJson, asError } from '@/mcp/result'

const paletteIds = THEME_PRESETS.map((p) => p.id) as [string, ...string[]]
const fontIds = FONT_PRESETS.map((f) => f.id) as [string, ...string[]]
const chromeIds = CHROME_FONTS.map((f) => f.id) as [string, ...string[]]

export function registerStewardTools(server: ToolHost): void {
  server.registerTool(
    'update_appearance',
    {
      description:
        'Change the site\'s look from the curated menus: palette '
        + `(${paletteIds.join(', ')}), reading font (${fontIds.join(', ')}), chrome font, `
        + 'and what a first-time visitor opens in. Free-form colors are not accepted — '
        + 'every option here is one the owner\'s own screens offer.',
      inputSchema: {
        palette: z.enum(paletteIds).optional().describe('Default palette for visitors'),
        readingFont: z.enum(fontIds).optional(),
        chromeFont: z.enum(chromeIds).optional().describe('Header/rail/meta font'),
        defaultScheme: z.enum(['system', 'light', 'dark']).optional(),
      },
    },
    async ({ palette, readingFont, chromeFont, defaultScheme }) => {
      const current = await getSettings()
      const partial: Record<string, unknown> = {}
      if (palette !== undefined) {
        partial.themePreset = palette
        // The sanitizer enforces "enabledPalettes always includes themePreset"; adding it
        // here as well keeps the visitor's switcher offering what the agent just chose.
        if (!current.enabledPalettes.includes(palette)) {
          partial.enabledPalettes = [...current.enabledPalettes, palette]
        }
      }
      if (readingFont !== undefined) partial.fontPreset = readingFont
      if (chromeFont !== undefined) partial.chromeFont = chromeFont
      if (defaultScheme !== undefined) partial.defaultScheme = defaultScheme
      if (Object.keys(partial).length === 0) return asError('Nothing to change')
      const saved = await saveSettings(partial)
      clearCache()
      await logActivity('settings.save', 'appearance (MCP)')
      return asJson({
        palette: saved.themePreset,
        readingFont: saved.fontPreset,
        chromeFont: saved.chromeFont,
        defaultScheme: saved.defaultScheme,
      })
    },
  )

  const strip = z.object({
    category: z.string().describe('Category NAME as stored on posts'),
    count: z.number().int().min(1).max(12).optional(),
    columns: z.number().int().min(1).max(4).optional(),
  })

  server.registerTool(
    'compose_homepage',
    {
      description:
        'Curate the composed front page: the lead story (latest or pinned), the row of '
        + 'category strips and their order, the popular and latest rows. Passing `strips` '
        + 'REPLACES the strip list, in the given order. Sizes and sources only — the row '
        + 'layout itself is the product\'s prepared design, not a block composer.',
      inputSchema: {
        mode: z.enum(['list', 'page', 'front']).optional().describe("What '/' serves; 'front' is the composed page"),
        kind: z.enum(['image', 'text']).optional().describe('Lead with a picture, or with type'),
        lead: z.object({
          on: z.boolean().optional(),
          source: z.enum(['latest', 'pinned']).optional(),
          slug: z.string().optional().describe('The pinned post (source: pinned)'),
          secondary: z.number().int().min(0).max(3).optional(),
        }).optional(),
        strips: z.array(strip).optional(),
        popular: z.object({ on: z.boolean().optional(), count: z.number().int().min(1).max(12).optional(), days: z.union([z.literal(7), z.literal(30), z.literal(0)]).optional() }).optional(),
        latest: z.object({ on: z.boolean().optional(), count: z.number().int().min(1).max(12).optional(), columns: z.number().int().min(1).max(4).optional() }).optional(),
      },
    },
    async ({ mode, kind, lead, strips, popular, latest }) => {
      const current = await getSettings()
      const front: FrontSettings = {
        ...current.home.front,
        ...(kind !== undefined ? { kind } : {}),
        lead: { ...current.home.front.lead, ...(lead ?? {}) },
        popular: { ...current.home.front.popular, ...(popular ?? {}) },
        latest: { ...current.home.front.latest, ...(latest ?? {}) },
        strips: strips !== undefined
          ? strips.map((s) => ({ category: s.category, count: s.count ?? 4, columns: s.columns ?? 4 }))
          : current.home.front.strips,
      }
      const saved = await saveSettings({
        home: { ...current.home, ...(mode !== undefined ? { mode } : {}), front },
      })
      clearCache()
      await logActivity('settings.save', 'homepage (MCP)')

      // A strip naming a category that holds nothing renders as an empty row. That is a
      // mistake worth flagging and not worth refusing: the owner may be about to file
      // posts under it. So the save stands and the answer says what looks off.
      const known = new Set(await getCategories())
      const unknown = saved.home.front.strips.map((s) => s.category).filter((c) => !known.has(c))
      return asJson({ home: saved.home, ...(unknown.length ? { warning: `No posts in: ${unknown.join(', ')}` } : {}) })
    },
  )

  server.registerTool(
    'get_post_traffic',
    {
      readOnly: true,
      description: 'Traffic for ONE post or page over the last N days: views, visitors, read depth, dwell, referrers — the per-page view of the dashboard.',
      inputSchema: {
        slug: z.string().min(1),
        days: z.number().int().min(1).max(365).optional().describe('Defaults to 30'),
      },
    },
    async ({ slug, days }) => asJson(await getPageAnalytics(`/${slug.replace(/^\//, '')}`, days ?? 30)),
  )

  server.registerTool(
    'reply_comment',
    {
      description:
        'Reply to a comment under the owner\'s name. The parent\'s author is emailed, '
        + 'exactly as if the reply had been typed on the page.',
      inputSchema: {
        id: z.number().int().describe('Parent comment id from list_comments'),
        content: z.string().min(1),
        name: z.string().optional().describe('Display name; defaults to the site title'),
      },
    },
    async ({ id, content, name }) => {
      const settings = await getSettings()
      const who = (name ?? '').trim() || settings.title || 'Author'
      // The same lookup `comment-notify.ts` does: the reply's post is the parent's post,
      // and the notification email wants that slug for its link.
      const parent = one<{ post_slug: string }>(`select post_slug from comments where id = ?`, id)
      if (!parent) return asError('Comment not found')
      try {
        const created = await addComment({
          postSlug: parent.post_slug, parentId: id, provider: 'manual',
          name: who, email: ownerEmail() ?? '', content,
        })
        await logActivity('comment.create', `reply via MCP (#${id})`)
        await notifyReply({ parentId: id, postSlug: parent.post_slug, replierName: who, replierEmail: '', contentHtml: created.contentHtml })
        return asJson({ id: created.id, parentId: id })
      } catch (e) {
        return asError((e as Error).message)
      }
    },
  )

  server.registerTool(
    'send_test_newsletter',
    {
      description:
        'Send the next issue as a TEST to the owner\'s own address — rendered exactly like '
        + 'the real thing, inert to click. The recipient is not a parameter, and the real '
        + 'broadcast is not available over MCP: an email cannot be unsent.',
      inputSchema: {
        slugs: z.array(z.string()).optional().describe('Posts to include; defaults to the newest published post'),
      },
    },
    async ({ slugs }) => {
      const to = ownerEmail()
      if (!to) return asError('No owner account yet')
      const chosen = slugs && slugs.length > 0 ? slugs : (await getPublicPosts()).slice(0, 1).map((p) => p.slug)
      if (chosen.length === 0) return asError('Nothing published to preview')
      try {
        const { subject, html } = await previewBroadcast(chosen)
        const res = await sendMail({ to, subject, html, kind: 'test' })
        if (!res.sent) return asError(res.error || 'send_failed')
        await logActivity('mail.test', 'broadcast (MCP)')
        return asJson({ to, subject })
      } catch (e) {
        return asError((e as Error).message)
      }
    },
  )

  server.registerTool(
    'create_snapshot',
    {
      description:
        'Build a backup snapshot on the server, into the same retained set the scheduler '
        + 'writes. Good manners before a big change.',
      inputSchema: {},
    },
    async () => {
      try {
        const snapshot = await runBackup()
        await logActivity('backup.run', `${snapshot.name} (MCP)`)
        return asJson({ name: snapshot.name, size: snapshot.size })
      } catch (e) {
        return asError((e as Error).message)
      }
    },
  )
}
