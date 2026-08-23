// MCP tool definitions: posts, pages and taxonomy. Each tool is a thin wrapper
// over the SAME data-layer functions the admin API routes use, so behaviour
// (slug rules, revisions, soft-delete to Trash, revalidation, activity log) is
// identical whether a human uses the admin UI or an agent uses MCP.
//
// Content is Markdown everywhere (the blog is 100% Markdown), so tools take/return
// the body verbatim — no conversion. Deletes go to Trash (soft delete), matching
// the rest of the app; permanent removal is owner-only via the Trash UI.

import { z } from 'zod'
import type { ToolHost } from '@/mcp/registry'
import type { PostWithContent, PageWithContent } from '@/types'
import { getIndex, getPost, savePost, deletePost, restorePost, getTrashedPosts, getCategories, getTags } from '@/content/posts'
import { getPageIndex, getPage, savePage, deletePage, restorePage, getTrashedPages } from '@/content/pages'
import { clearCache } from '@/server/cache'
import { logActivity } from '@/server/activity'
import { SlugConflictError } from '@/content/slugs'
import { asText, asJson, asError } from '@/mcp/result'
import { registerLibraryTools } from '@/mcp/tools-library'
import { registerInsightTools } from '@/mcp/tools-insight'
import { registerStewardTools } from '@/mcp/tools-steward'

// Shared input shape for create/update of a post (all optional; savePost normalizes).
const postFields = {
  title: z.string().optional(),
  content: z.string().optional().describe('Markdown body of the post'),
  status: z.enum(['draft', 'published']).optional().describe("Defaults to 'draft'"),
  slug: z.string().optional().describe('URL slug; auto-derived from the title when omitted'),
  excerpt: z.string().optional(),
  categories: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  featuredImage: z.string().optional().describe('Image URL used only for SEO/social cards'),
  date: z.string().optional().describe('ISO 8601 publish date; defaults to now'),
}

const pageFields = {
  title: z.string().optional(),
  content: z.string().optional().describe('Markdown body of the page'),
  status: z.enum(['draft', 'published']).optional().describe("Defaults to 'draft'"),
  slug: z.string().optional(),
  featuredImage: z.string().optional(),
}

export function registerTools(server: ToolHost): void {
  registerPostTools(server)
  registerPageTools(server)
  registerTaxonomyTools(server)
  registerLibraryTools(server)
  registerInsightTools(server)
  registerStewardTools(server)
}

function registerPostTools(server: ToolHost): void {
  server.registerTool(
    'list_posts',
    { description: 'List all posts (drafts included) with metadata, newest first.', inputSchema: { status: z.enum(['draft', 'published']).optional() } },
    async ({ status }) => {
      const posts = await getIndex()
      const filtered = status ? posts.filter((p) => p.status === status) : posts
      return asJson(filtered.map((p) => ({ slug: p.slug, title: p.title, status: p.status, date: p.date, categories: p.categories, tags: p.tags })))
    },
  )

  server.registerTool(
    'get_post',
    { description: 'Get one post by slug, including its Markdown body.', inputSchema: { slug: z.string() } },
    async ({ slug }) => {
      const post = await getPost(slug)
      return post ? asJson(post) : asError(`Post not found: ${slug}`)
    },
  )

  server.registerTool(
    'create_post',
    { description: 'Create a post. Returns the saved metadata. Status defaults to draft.', inputSchema: postFields },
    async (args) => {
      if (!args.title?.trim() && !args.slug?.trim()) return asError('Title or slug is required')
      try {
        const meta = await savePost(args as Partial<PostWithContent>)
        clearCache() // Invariant 1: one total flush, not a per-path superset
        await logActivity('post.create', meta.title || meta.slug)
        return asJson(meta)
      } catch (e) {
        if (e instanceof SlugConflictError) return asError('slug_taken: that slug is already used by a post or page')
        throw e
      }
    },
  )

  server.registerTool(
    'update_post',
    { description: 'Overwrite an existing post by slug. This REPLACES the post, so pass the complete post (title, content, status, categories, tags…); omitted fields reset to defaults. To change only a few fields (title, tags, categories…) without touching the body, use patch_post instead. Returns the saved metadata.', inputSchema: { ...postFields, slug: z.string() } },
    async ({ slug, ...rest }) => {
      try {
        const meta = await savePost(rest as Partial<PostWithContent>, slug)
        clearCache()
        await logActivity('post.update', meta.title || meta.slug)
        return asJson(meta)
      } catch (e) {
        if (e instanceof SlugConflictError) return asError('slug_taken: that slug is already used by a post or page')
        throw e
      }
    },
  )

  // slug identifies the post; the body cannot rename it (that is update_post's job).
  const { slug: _slug, ...patchFields } = postFields
  server.registerTool(
    'patch_post',
    { description: 'Partially update ONE post by slug: only the fields you pass change, everything else — INCLUDING the body — is left as-is. Use this to tweak the title, categories, tags, excerpt, status, featured image or date without resending the whole post. (update_post, by contrast, replaces the entire post.) Returns the saved metadata.', inputSchema: { slug: z.string(), ...patchFields } },
    async ({ slug, ...patch }) => {
      const existing = await getPost(slug)
      if (!existing) return asError(`Post not found: ${slug}`)
      // Merge only the provided keys over the current post, then save the whole thing.
      const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined))
      try {
        const meta = await savePost({ ...existing, ...defined } as Partial<PostWithContent>, slug)
        clearCache()
        await logActivity('post.update', meta.title || meta.slug)
        return asJson(meta)
      } catch (e) {
        if (e instanceof SlugConflictError) return asError('slug_taken: that slug is already used by a post or page')
        throw e
      }
    },
  )

  server.registerTool(
    'delete_post',
    { description: 'Move a post to the Trash (soft delete — recoverable). Does not remove it permanently.', inputSchema: { slug: z.string() } },
    async ({ slug }) => {
      await deletePost(slug)
      clearCache()
      await logActivity('post.delete', slug)
      return asText(`Moved post to Trash: ${slug}`)
    },
  )

  server.registerTool(
    'restore_post',
    { description: 'Restore a trashed post back to live.', inputSchema: { slug: z.string() } },
    async ({ slug }) => {
      await restorePost(slug)
      clearCache()
      await logActivity('post.restore', slug)
      return asText(`Restored post: ${slug}`)
    },
  )

  server.registerTool(
    'list_trashed_posts',
    { description: 'List posts currently in the Trash.', inputSchema: {} },
    async () => asJson((await getTrashedPosts()).map((p) => ({ slug: p.slug, title: p.title, deletedAt: p.deletedAt }))),
  )
}

function registerPageTools(server: ToolHost): void {
  server.registerTool(
    'list_pages',
    { description: 'List all static pages (drafts included).', inputSchema: {} },
    async () => asJson((await getPageIndex()).map((p) => ({ slug: p.slug, title: p.title, status: p.status }))),
  )

  server.registerTool(
    'get_page',
    { description: 'Get one page by slug, including its Markdown body.', inputSchema: { slug: z.string() } },
    async ({ slug }) => {
      const page = await getPage(slug)
      return page ? asJson(page) : asError(`Page not found: ${slug}`)
    },
  )

  server.registerTool(
    'create_page',
    { description: 'Create a static page. Status defaults to draft.', inputSchema: pageFields },
    async (args) => {
      if (!args.title?.trim() && !args.slug?.trim()) return asError('Title or slug is required')
      try {
        const meta = await savePage(args as Partial<PageWithContent>)
        clearCache()
        await logActivity('page.create', meta.title || meta.slug)
        return asJson(meta)
      } catch (e) {
        if (e instanceof SlugConflictError) return asError('slug_taken: that slug is already used by a post or page')
        throw e
      }
    },
  )

  server.registerTool(
    'update_page',
    { description: 'Update a page by slug (savePage overwrites — pass the full page).', inputSchema: { ...pageFields, slug: z.string() } },
    async ({ slug, ...rest }) => {
      try {
        const meta = await savePage(rest as Partial<PageWithContent>, slug)
        clearCache()
        await logActivity('page.update', meta.title || meta.slug)
        return asJson(meta)
      } catch (e) {
        if (e instanceof SlugConflictError) return asError('slug_taken: that slug is already used by a post or page')
        throw e
      }
    },
  )

  server.registerTool(
    'delete_page',
    { description: 'Move a page to the Trash (soft delete — recoverable).', inputSchema: { slug: z.string() } },
    async ({ slug }) => {
      await deletePage(slug)
      clearCache()
      await logActivity('page.delete', slug)
      return asText(`Moved page to Trash: ${slug}`)
    },
  )

  server.registerTool(
    'restore_page',
    { description: 'Restore a trashed page back to live.', inputSchema: { slug: z.string() } },
    async ({ slug }) => {
      await restorePage(slug)
      clearCache()
      await logActivity('page.restore', slug)
      return asText(`Restored page: ${slug}`)
    },
  )

  server.registerTool(
    'list_trashed_pages',
    { description: 'List pages currently in the Trash.', inputSchema: {} },
    async () => asJson((await getTrashedPages()).map((p) => ({ slug: p.slug, title: p.title, deletedAt: p.deletedAt }))),
  )
}

function registerTaxonomyTools(server: ToolHost): void {
  server.registerTool(
    'list_categories',
    { description: 'List all distinct post categories.', inputSchema: {} },
    async () => asJson(await getCategories()),
  )
  server.registerTool(
    'list_tags',
    { description: 'List all distinct post tags.', inputSchema: {} },
    async () => asJson(await getTags()),
  )
}
