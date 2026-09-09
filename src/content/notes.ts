// The owner's notebook: notes, written like posts and kept apart from them (ADR 0044).
//
// Mirrors `pages.ts` in shape and `posts.ts` in having a date. What is deliberately NOT
// here: taxonomy, series, excerpts, revisions — a note is a page of a notebook, not a
// publication. And the slug lives in a namespace of its own (`/notes/{slug}`), so a note
// called "about" and a page called "about" can both exist; the only name a note cannot
// take is one another note already holds.
//
// The three `source*` fields are what a CLIP carries — a passage kept from somewhere else,
// with where it came from — and are undefined on a note the owner simply wrote. They are
// columns rather than lines of Markdown because a later tier sends a Webmention to the
// source, and a URL that has to be parsed back out of prose is a URL that will be missed.

import type { Note, NoteWithContent } from '@/types'
import { collapseBlob, expandBlob } from '@/media/blob'
import { clearAutosave } from '@/content/autosave'
import { isPublicallyVisible, slugify } from '@/utils'
import { SlugConflictError } from '@/content/slugs'
import { saveRedirect, clearRedirectForPath } from '@/server/redirects'
import { all, one, run } from '@/store/query'
import { fromIso, liveOnly, nowMs, toIso } from '@/store/db'

const META_COLS = 'slug, title, date, status, source_url, source_title, quote, updated_at'

/** Names under /notes/ that are routes, not notes. */
export const NOTE_RESERVED: ReadonlySet<string> = new Set(['clip', 'feed.xml'])

type NoteRow = {
  slug: string
  title: string
  date: number
  status: string
  source_url: string | null
  source_title: string | null
  quote: string | null
  updated_at?: number | null
  content?: string | null
}

function rowToMeta(row: NoteRow): Note {
  return {
    title: row.title,
    slug: row.slug,
    date: toIso(row.date),
    status: row.status === 'published' ? 'published' : 'draft',
    sourceUrl: row.source_url || undefined,
    sourceTitle: row.source_title || undefined,
    quote: row.quote || undefined,
    updatedAt: row.updated_at ? toIso(row.updated_at) : undefined,
  }
}

function readIndex(): Note[] {
  try {
    return all<NoteRow>(`select ${META_COLS} from notes where ${liveOnly('notes')} order by date desc`)
      .map(rowToMeta)
  } catch (error) {
    console.error(`[ERROR] notes.readIndex: ${(error as Error).message}`)
    return []
  }
}

/** Every live note, newest first, drafts included — the admin's list. */
export async function getNoteIndex(): Promise<Note[]> {
  return readIndex()
}

/** What a reader may see: published, and dated no later than now. Same gate as posts. */
export async function getPublicNotes(): Promise<Note[]> {
  return readIndex().filter((n) => isPublicallyVisible(n.status, n.date))
}

export async function getNote(slug: string): Promise<NoteWithContent | null> {
  try {
    const row = one<NoteRow>(`select * from notes where ${liveOnly('notes')} and slug = ?`, slug)
    if (!row) return null
    return { ...rowToMeta(row), content: expandBlob(row.content ?? '') }
  } catch (error) {
    console.error(`[ERROR] notes.getNote(${slug}): ${(error as Error).message}`)
    return null
  }
}

/** A URL a clip may point back to: http(s) only, or nothing. */
const cleanUrl = (raw: string | undefined): string | undefined => {
  const v = (raw ?? '').trim()
  return /^https?:\/\/\S+$/i.test(v) ? v : undefined
}

function normalize(input: Partial<NoteWithContent>): NoteWithContent {
  const content = (input.content ?? '').trim()
  const title = (input.title ?? '').trim()
  const sourceTitle = (input.sourceTitle ?? '').trim() || undefined
  // A clip with no title of its own is named after where it came from; a note with
  // neither gets a dated name rather than an empty one.
  const slug = (input.slug?.trim() ? slugify(input.slug) : slugify(title || sourceTitle || ''))
    || `note-${Date.now()}`
  return {
    title,
    slug,
    date: input.date ?? new Date().toISOString(),
    status: input.status === 'published' ? 'published' : 'draft',
    sourceUrl: cleanUrl(input.sourceUrl),
    sourceTitle,
    quote: (input.quote ?? '').trim() || undefined,
    content,
  }
}

function toMeta(note: NoteWithContent): Note {
  const { content: _content, ...meta } = note
  void _content
  return meta
}

/** Create or overwrite a note. A rename leaves a permanent redirect behind, like a post. */
export async function saveNote(input: Partial<NoteWithContent>, previousSlug?: string): Promise<Note> {
  const note = normalize(input)
  // Two names the notebook's own routes answer first: the receiving door, and a feed.
  if (NOTE_RESERVED.has(note.slug)) throw new SlugConflictError(note.slug)
  // Its own namespace: only another live-or-trashed note can hold the name already.
  const holder = one<{ slug: string }>(`select slug from notes where slug = ?`, note.slug)
  if (holder && !(previousSlug === note.slug || (previousSlug && holder.slug === previousSlug))) {
    throw new SlugConflictError(note.slug)
  }
  const now = nowMs()
  const existing = one<{ created_at: number }>(
    `select created_at from notes where slug = ?`, previousSlug ?? note.slug,
  )
  run(
    `insert into notes (slug, title, date, status, content, source_url, source_title, quote, created_at, updated_at)
     values ($slug, $title, $date, $status, $content, $sourceUrl, $sourceTitle, $quote, $createdAt, $now)
     on conflict(slug) do update set
       title        = excluded.title,
       date         = excluded.date,
       status       = excluded.status,
       content      = excluded.content,
       source_url   = excluded.source_url,
       source_title = excluded.source_title,
       quote        = excluded.quote,
       updated_at   = excluded.updated_at`,
    {
      slug: note.slug,
      title: note.title,
      date: fromIso(note.date),
      status: note.status,
      content: collapseBlob(note.content),
      sourceUrl: note.sourceUrl ?? null,
      sourceTitle: note.sourceTitle ?? null,
      quote: note.quote ?? null,
      createdAt: existing?.created_at ?? now,
      now,
    },
  )
  if (previousSlug && previousSlug !== note.slug && existing) {
    run(`delete from notes where slug = ?`, previousSlug)
    await saveRedirect({ source: `/notes/${previousSlug}`, destination: `/notes/${note.slug}`, permanent: true })
  }
  clearAutosave('note', note.slug)
  await clearRedirectForPath(`/notes/${note.slug}`)
  return toMeta(note)
}

export async function deleteNote(slug: string): Promise<void> {
  run(`update notes set deleted_at = ? where slug = ?`, nowMs(), slug)
}

export async function restoreNote(slug: string): Promise<void> {
  run(`update notes set deleted_at = null where slug = ?`, slug)
  await clearRedirectForPath(`/notes/${slug}`)
}

export async function purgeNote(slug: string): Promise<void> {
  run(`delete from notes where slug = ?`, slug)
}

export async function getTrashedNotes(): Promise<Note[]> {
  try {
    const rows = all<NoteRow & { deleted_at: number }>(
      `select ${META_COLS}, deleted_at from notes where deleted_at is not null order by deleted_at desc`,
    )
    return rows.map((row) => ({ ...rowToMeta(row), deletedAt: toIso(row.deleted_at) }))
  } catch (error) {
    console.error(`[ERROR] notes.getTrashedNotes: ${(error as Error).message}`)
    return []
  }
}

export async function emptyNotesTrash(): Promise<number> {
  const trashed = await getTrashedNotes()
  await Promise.all(trashed.map((n) => purgeNote(n.slug)))
  return trashed.length
}
