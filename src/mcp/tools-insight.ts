// The reading half of the tool surface: what the blog knows about itself.
//
// Every tool before this file WRITES — an agent could draft, tag, publish, and yet
// "how did the blog do this week?" had no answer over MCP, which made the agent a
// typist rather than a steward. These are thin wrappers over the exact functions the
// admin dashboard reads, so the numbers an agent reports are the numbers the owner sees.
//
// Two lines drawn on purpose, both about data an agent does not need:
//  - No subscriber emails. `get_audience` answers with COUNTS; the mailing list itself
//    never crosses this boundary. An agent drafting a newsletter needs to know there are
//    312 readers, not who they are.
//  - No commenter emails or IPs. `list_comments` strips both from the admin shape:
//    moderation needs the words, the name and the post, not the identity trail.

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getAnalytics } from '@/analytics/summary'
import { subscriberCounts } from '@/news/subscribers'
import { getAdminComments, softDeleteComment } from '@/comments/comments'
import { searchEverything } from '@/content/search-owner'
import { updateCheckStatus } from '@/server/update-check'
import { logActivity } from '@/server/activity'
import { asJson, asError } from '@/mcp/result'
import pkg from '../../package.json' with { type: 'json' }

const VERSION = (pkg as { version: string }).version

export function registerInsightTools(server: McpServer): void {
  server.registerTool(
    'get_traffic',
    {
      description:
        'Traffic summary for the last N days, with the window before it for comparison: '
        + 'views, visitors, read depth, dwell time, top pages, referrers, countries, '
        + 'channels, devices and a per-day series. The same numbers the owner\'s dashboard shows.',
      inputSchema: {
        days: z.number().int().min(1).max(365).optional().describe('Window size in days; defaults to 7'),
      },
    },
    async ({ days }) => asJson(await getAnalytics(days ?? 7)),
  )

  server.registerTool(
    'get_audience',
    {
      description:
        'Subscriber counts (confirmed, pending, unsubscribed) and how many live comments '
        + 'the blog holds. Counts only — the addresses themselves are not available over MCP.',
      inputSchema: {},
    },
    async () => {
      const [subscribers, comments] = await Promise.all([subscriberCounts(), getAdminComments(1, 1)])
      return asJson({ subscribers, comments: comments.total })
    },
  )

  server.registerTool(
    'list_comments',
    {
      description: 'Live comments, newest first, 50 per page. Includes each comment\'s id for delete_comment.',
      inputSchema: { page: z.number().int().min(1).optional().describe('Defaults to 1') },
    },
    async ({ page }) => {
      const { rows, total } = await getAdminComments(page ?? 1)
      return asJson({
        total,
        comments: rows.map((r) => ({
          id: r.id,
          postSlug: r.postSlug,
          postTitle: r.postTitle,
          name: r.name,
          website: r.website,
          country: r.country,
          content: r.content,
          createdAt: r.createdAt,
        })),
      })
    },
  )

  server.registerTool(
    'delete_comment',
    {
      description: 'Move a comment to the Trash (soft delete — the owner can restore it in the admin).',
      inputSchema: { id: z.number().int().describe('Comment id from list_comments') },
    },
    async ({ id }) => {
      // The same two calls as the admin route (`web/admin/news.ts`), and nothing more:
      // comments render outside the page cache, so there is no cache to clear.
      await softDeleteComment(id)
      void logActivity('comment.delete', String(id))
      return asJson({ id, deleted: true })
    },
  )

  server.registerTool(
    'search_posts',
    {
      description:
        'Full-text search across every post and page, drafts included — the owner\'s own '
        + 'search box. Each hit carries the passage the words were found in.',
      inputSchema: { query: z.string().min(1) },
    },
    async ({ query }) => {
      try {
        return asJson(await searchEverything(query))
      } catch (error) {
        return asError((error as Error).message)
      }
    },
  )

  server.registerTool(
    'get_update_status',
    {
      description:
        'The version this blog runs, whether a newer release exists (the dot beside the '
        + 'version in the admin), and whether the daily check is blocked by the environment.',
      inputSchema: {},
    },
    async () => asJson({ running: VERSION, ...updateCheckStatus() }),
  )
}
