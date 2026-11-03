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
import { registerNoteTools } from '@/mcp/tools-notes'

// Shared input shape for create/update of a post (all optional; savePost normalizes).
const postFields = {
  title: z.string().optional(),
  content: z.string().optional().describe('Markdown body of the post'),
  status: z.enum(['draft', 'published']).optional().describe("Defaults to 'draft'"),
  slug: z.string().optional().describe('URL slug; auto-derived from the title when omitted'),
  excerpt: z.string().optional(),
  categories: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  featuredImage: z.string().optional().describe('Image URL used only for SEO/social cards, never shown on the page. The visible picture at the top of the post is coverImage'),
  date: z.string().optional().describe('ISO 8601 publish date; defaults to now'),
  // These five were missing until 2026-11-03, and because `update_post` REPLACES, a field this
  // shape does not carry was erased by every update: zod strips it, the saver sees undefined.
  series: z.string().optional().describe('Name of the series this post belongs to; an empty string takes it out'),
  seriesOrder: z.number().int().min(0).optional().describe('Its place in the series, ascending'),
  metaTitle: z.string().optional().describe('SEO <title> override; the post title when empty'),
  metaDescription: z.string().optional().describe('SEO description override; the excerpt when empty'),
  coverImage: z.string().optional().describe('The visible picture at the top of the post (a media URL from list_media); an empty string removes it'),
  // ADR 0056. An agent that cannot set these is an agent that ERASES them: `update_post` is a
  // REPLACE, so a field missing from this shape comes back undefined and overwrites what was
  // there. The same is already true of `series` and `coverImage`, which is the argument for
  // adding rather than for leaving well alone.
  lang: z.string().optional().describe(
    "Language this piece is written in (a site language code such as 'en' or 'vi'). Omit for the blog's own language."),
  translationGroup: z.string().optional().describe(
    'A name shared by every translation of this piece. Two pieces with the same group are each other\'s translations.'),
}

/** The post fields `update_post` keeps when they are not sent; see the handler for why. */
const KEPT_ON_UPDATE = ['series', 'seriesOrder', 'metaTitle', 'metaDescription', 'coverImage'] as const

const pageFields = {
  title: z.string().optional(),
  content: z.string().optional().describe('Markdown body of the page'),
  status: z.enum(['draft', 'published']).optional().describe("Defaults to 'draft'"),
  slug: z.string().optional(),
  featuredImage: z.string().optional(),
  // ADR 0056. An agent that cannot set these is an agent that ERASES them: `update_post` is a
  // REPLACE, so a field missing from this shape comes back undefined and overwrites what was
  // there. The same is already true of `series` and `coverImage`, which is the argument for
  // adding rather than for leaving well alone.
  lang: z.string().optional().describe(
    "Language this piece is written in (a site language code such as 'en' or 'vi'). Omit for the blog's own language."),
  translationGroup: z.string().optional().describe(
    'A name shared by every translation of this piece. Two pieces with the same group are each other\'s translations.'),
}

export function registerTools(server: ToolHost): void {
  registerPostTools(server)
  registerPageTools(server)
  registerNoteTools(server)
  registerTaxonomyTools(server)
  registerLibraryTools(server)
  registerInsightTools(server)
  registerStewardTools(server)
}

function registerPostTools(server: ToolHost): void {
  server.registerTool(
    'list_posts',
    { readOnly: true, description: 'List all posts (drafts included) with metadata, newest first.', inputSchema: { status: z.enum(['draft', 'published']).optional() } },
    async ({ status }) => {
      const posts = await getIndex()
      const filtered = status ? posts.filter((p) => p.status === status) : posts
      return asJson(filtered.map((p) => ({ slug: p.slug, title: p.title, status: p.status, date: p.date, categories: p.categories, tags: p.tags })))
    },
  )

  server.registerTool(
    'get_post',
    { readOnly: true, description: 'Get one post by slug, including its Markdown body.', inputSchema: { slug: z.string() } },
    async ({ slug }) => {
      const post = await getPost(slug)
      return post ? asJson(post) : asError(`Post not found: ${slug}`)
    },
  )

  server.registerTool(
    'create_post',
    { description: 'Create a post. Returns the saved metadata. Status defaults to draft. The title may be left empty for a short post; it is then addressed and listed by its first words.', inputSchema: postFields },
    async (args) => {
      // A post may be only words (ADR 0064): a short post has no title and is still a post.
      if (!args.title?.trim() && !args.slug?.trim() && !args.content?.trim()) return asError('Title, slug or content is required')
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
    { description: 'Overwrite an existing post by slug. This REPLACES the post, so pass the complete post (title, content, status, categories, tags…); omitted fields reset to defaults — except series, seriesOrder, metaTitle, metaDescription and coverImage, which keep their value when omitted (send an empty string to clear one). To change only a few fields (title, tags, categories…) without touching the body, use patch_post instead. Returns the saved metadata.', inputSchema: { ...postFields, slug: z.string(), newSlug: z.string().optional().describe('Rename it: the new slug. Omit to keep the current one — the slug is never derived from the title here.') } },
    // ⚠️ THE SLUG GOES THROUGH. It was stripped from the arguments, so the saver built one from
    // the title and every update of a post whose slug was not its title's renamed it, with a
    // 301 left behind. The slug stays unless `newSlug` asks otherwise.
    async ({ slug, newSlug, ...rest }) => {
      // ⚠️ KEPT WHEN OMITTED, unlike the rest of a replace. Until 2026-11-03 this tool could not
      // send these five at all, so every client written against it omits them, and for those
      // clients "omitted resets" only ever meant "erased". Keeping them breaks no caller; making
      // them reset would have kept erasing a series or a cover on every ordinary update.
      const existing = await getPost(slug)
      const kept = existing
        ? Object.fromEntries(KEPT_ON_UPDATE.filter((k) => rest[k] === undefined).map((k) => [k, existing[k]]))
        : {}
      // An excerpt the saver DERIVED, sent back unchanged (as `get_post` handed it over), is still a
      // derived one: written as the author's, it would stop following the body. `patch_post` draws
      // the same line.
      const fields = existing?.excerptAuto && rest.excerpt === existing.excerpt ? { ...rest, excerpt: undefined } : rest
      try {
        const meta = await savePost({ ...kept, ...fields, slug: newSlug?.trim() || slug } as Partial<PostWithContent>, slug)
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
      const defined: Record<string, unknown> = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined))
      // An excerpt passed here is written. One left out on a post whose excerpt was DERIVED is
      // derived again, from the body as patched, rather than carried over from the old one.
      if ('excerpt' in defined) defined.excerptAuto = false
      else if (existing.excerptAuto) defined.excerpt = undefined
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
    { readOnly: true, description: 'List posts currently in the Trash.', inputSchema: {} },
    async () => asJson((await getTrashedPosts()).map((p) => ({ slug: p.slug, title: p.title, deletedAt: p.deletedAt }))),
  )
}

function registerPageTools(server: ToolHost): void {
  server.registerTool(
    'list_pages',
    { readOnly: true, description: 'List all static pages (drafts included).', inputSchema: {} },
    async () => asJson((await getPageIndex()).map((p) => ({ slug: p.slug, title: p.title, status: p.status }))),
  )

  server.registerTool(
    'get_page',
    { readOnly: true, description: 'Get one page by slug, including its Markdown body.', inputSchema: { slug: z.string() } },
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
    { description: 'Update a page by slug (savePage overwrites — pass the full page).', inputSchema: { ...pageFields, slug: z.string(), newSlug: z.string().optional().describe('Rename it: the new slug. Omit to keep the current one — the slug is never derived from the title here.') } },
    // ⚠️ THE SLUG GOES THROUGH. It was stripped from the arguments, so the saver built one from
    // the title and every update of a page whose slug was not its title's renamed it, with a
    // 301 left behind. The slug stays unless `newSlug` asks otherwise.
    async ({ slug, newSlug, ...rest }) => {
      try {
        const meta = await savePage({ ...rest, slug: newSlug?.trim() || slug } as Partial<PageWithContent>, slug)
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
    { readOnly: true, description: 'List pages currently in the Trash.', inputSchema: {} },
    async () => asJson((await getTrashedPages()).map((p) => ({ slug: p.slug, title: p.title, deletedAt: p.deletedAt }))),
  )
}

function registerTaxonomyTools(server: ToolHost): void {
  server.registerTool(
    'list_categories',
    { readOnly: true, description: 'List all distinct post categories.', inputSchema: {} },
    async () => asJson(await getCategories()),
  )
  server.registerTool(
    'list_tags',
    { readOnly: true, description: 'List all distinct post tags.', inputSchema: {} },
    async () => asJson(await getTags()),
  )
}
