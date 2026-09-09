// MCP tools for the notebook (ADR 0044): the same five verbs the page tools have, over the
// same data-layer functions the admin API uses. A clip's three fields are ordinary inputs
// here, which is what lets an agent keep a passage for the owner with where it came from.

import { z } from 'zod'
import type { ToolHost } from '@/mcp/registry'
import type { NoteWithContent } from '@/types'
import { getNoteIndex, getNote, saveNote, deleteNote, restoreNote, getTrashedNotes } from '@/content/notes'
import { clearCache } from '@/server/cache'
import { logActivity } from '@/server/activity'
import { SlugConflictError } from '@/content/slugs'
import { asText, asJson, asError } from '@/mcp/result'
import { afterNoteSaved, listMentions, mostKept } from '@/server/webmention'
import { getSettings, resolveSiteUrl } from '@/content/settings'

const noteFields = {
  title: z.string().optional(),
  slug: z.string().optional(),
  content: z.string().optional().describe('Markdown body'),
  date: z.string().optional().describe('ISO 8601; defaults to now'),
  status: z.enum(['draft', 'published']).optional(),
  sourceUrl: z.string().optional().describe('For a clip: the http(s) address the passage came from'),
  sourceTitle: z.string().optional().describe('For a clip: the title of that page'),
  quote: z.string().optional().describe('For a clip: the passage itself, verbatim'),
}

export function registerNoteTools(server: ToolHost): void {
  server.registerTool(
    'list_notes',
    { readOnly: true, description: 'List the notebook: every note, drafts included, newest first. A note with a sourceUrl is a clip.', inputSchema: {} },
    async () => asJson((await getNoteIndex()).map((n) => ({
      slug: n.slug, title: n.title, status: n.status, date: n.date, sourceUrl: n.sourceUrl, sourceTitle: n.sourceTitle,
    }))),
  )

  server.registerTool(
    'get_note',
    { readOnly: true, description: 'Get one note by slug, including its Markdown body and, for a clip, the passage and its source.', inputSchema: { slug: z.string() } },
    async ({ slug }) => {
      const note = await getNote(slug)
      return note ? asJson(note) : asError(`Note not found: ${slug}`)
    },
  )

  server.registerTool(
    'create_note',
    { description: 'Write a note, or keep a clip (pass sourceUrl, sourceTitle and quote). Status defaults to draft; a draft is private to the owner.', inputSchema: noteFields },
    async (args) => {
      if (!args.title?.trim() && !args.slug?.trim() && !args.sourceTitle?.trim()) return asError('Title, slug or sourceTitle is required')
      try {
        const meta = await saveNote(args as Partial<NoteWithContent>)
        clearCache()
        await logActivity('note.create', meta.title || meta.slug)
        afterNoteSaved(meta, resolveSiteUrl(await getSettings()))
        return asJson(meta)
      } catch (e) {
        if (e instanceof SlugConflictError) return asError('slug_taken: another note already has that slug')
        throw e
      }
    },
  )

  server.registerTool(
    'update_note',
    { description: 'Update a note by slug (saveNote overwrites — pass the full note).', inputSchema: { ...noteFields, slug: z.string() } },
    async ({ slug, ...rest }) => {
      try {
        const meta = await saveNote(rest as Partial<NoteWithContent>, slug)
        clearCache()
        await logActivity('note.update', meta.title || meta.slug)
        afterNoteSaved(meta, resolveSiteUrl(await getSettings()))
        return asJson(meta)
      } catch (e) {
        if (e instanceof SlugConflictError) return asError('slug_taken: another note already has that slug')
        throw e
      }
    },
  )

  server.registerTool(
    'delete_note',
    { description: 'Move a note to the Trash (soft delete — recoverable with restore_note).', inputSchema: { slug: z.string() } },
    async ({ slug }) => {
      await deleteNote(slug)
      clearCache()
      await logActivity('note.delete', slug)
      return asText(`Moved note to Trash: ${slug}`)
    },
  )

  server.registerTool(
    'list_mentions',
    { readOnly: true, description: 'Webmentions this site has received (other pages that link here), newest first, and which passages readers keep most — from clips sent by other Quire Ink notebooks.', inputSchema: {} },
    async () => asJson({ mentions: listMentions(), mostKept: mostKept() }),
  )

  server.registerTool(
    'restore_note',
    { description: 'Bring a trashed note back.', inputSchema: { slug: z.string() } },
    async ({ slug }) => {
      const trashed = (await getTrashedNotes()).some((n) => n.slug === slug)
      if (!trashed) return asError(`No trashed note: ${slug}`)
      await restoreNote(slug)
      clearCache()
      return asText(`Restored note: ${slug}`)
    },
  )
}
