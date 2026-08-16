// Editor screen: left = TipTap editor, right = settings, bottom = action bar.
// Handles auto-save, manual save (draft/publish) and the media picker modal.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { PostWithContent, PostRevision, ApiResponse } from '@/types'
import { useToast } from '@/admin/ui/Toast'
import { slugify, formatTime, isScheduled } from '@/utils'
import { uploadImages } from '@/admin/upload-client'
import { Editor, type EditorApi } from './Editor'
import { type Draft } from './PostSettings'
import { PublishPanel } from './PublishPanel'
import { EditorActions } from './EditorActions'
import { LocalDraftNotice } from './LocalDraftNotice'
import { MediaLibrary } from './MediaLibrary'
import { TimeMachine } from './TimeMachine'
import { saveStatusLine, useLocalAutosave, useLocalDraft, useStickyOffset, useUnsavedGuard } from './useLocalDraft'
import { useAdminT } from './I18nProvider'
import { READING } from './kit'

type Props = {
  initial?: PostWithContent
  allCategories: string[]
  allTags: string[]
  allSeries: string[]
  contentWidth: number
  typewriterEffects: boolean
  autosaveSeconds: number
}

type PickTarget = 'editor' | 'gallery' | 'featured' | 'cover'

// ISO -> value for <input type="datetime-local"> in local time.
function isoToLocal(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function toDraft(initial?: PostWithContent): Draft {
  return {
    title: initial?.title ?? '',
    slug: initial?.slug ?? '',
    date: isoToLocal(initial?.date ?? new Date().toISOString()),
    status: initial?.status ?? 'draft',
    categories: initial?.categories ?? [],
    tags: initial?.tags ?? [],
    series: initial?.series ?? '',
    seriesOrder: initial?.seriesOrder ?? 0,
    featuredImage: initial?.featuredImage ?? '',
    coverImage: initial?.coverImage ?? '',
    metaTitle: initial?.metaTitle ?? '',
    metaDescription: initial?.metaDescription ?? '',
    excerpt: initial?.excerpt ?? '',
    content: initial?.content ?? '',
  }
}

export function PostForm({ initial, allCategories, allTags, allSeries, contentWidth, typewriterEffects, autosaveSeconds }: Props) {
  const t = useAdminT()
  const { notify } = useToast()
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial))
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [picker, setPicker] = useState<PickTarget | null>(null)
  const [timeMachine, setTimeMachine] = useState(false)
  // CLOSED by default, and `asking` is true from the first Publish press until it publishes,
  // which is what turns the attributes into the publish sheet. They used to be open on every
  // load, asking about the slug, the date, the terms and two images while the writer was
  // mid-sentence, in 340px of the width (ADR 0024, step 5).
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [asking, setAsking] = useState(false)
  const actionHeaderRef = useRef<HTMLDivElement>(null)
  const toolbarTop = useStickyOffset(actionHeaderRef)
  // Unsaved-changes flag: drives button states, autosave and the exit warning.
  const [dirty, setDirty] = useState(false)
  const [savedSlug, setSavedSlug] = useState<string | null>(initial?.slug ?? null)
  // Local (offline) autosave — keyed per post so drafts don't clobber each other.
  const {
    recovered: localRecovered,
    save: saveLocal,
    clear: clearLocal,
    dismiss: dismissLocal,
  } = useLocalDraft<Draft>(`quire:draft:post:${initial?.slug ?? 'new'}`)

  const slugTouched = useRef(Boolean(initial?.slug))
  const currentSlug = useRef<string | null>(initial?.slug ?? null)
  const editorApi = useRef<EditorApi | null>(null)
  // Live editor content lives here (not in React state) so typing never
  // re-renders the form. Saves read editorApi.getMarkdown() for the latest text.
  const contentRef = useRef<string>(initial?.content ?? '')
  const draftRef = useRef(draft)
  const dirtyRef = useRef(dirty)
  useEffect(() => {
    draftRef.current = draft
  }, [draft])
  useEffect(() => {
    dirtyRef.current = dirty
  }, [dirty])

  const update = useCallback((partial: Partial<Draft>) => {
    setDirty(true)
    setDraft((prev) => {
      const next = { ...prev, ...partial }
      if ('slug' in partial) slugTouched.current = true
      if ('title' in partial && !slugTouched.current) next.slug = slugify(partial.title ?? '')
      return next
    })
  }, [])

  // Keep the formatting toolbar joined exactly to the sticky action header.
  // The header height changes with translations and responsive wrapping, so a
  // guessed Tailwind top offset leaves either a gap or an overlap.
  // One save at a time: every save runs after the previous finishes (chained),
  // so autosave and manual save never race or double-create a post.
  const saveChain = useRef<Promise<unknown>>(Promise.resolve())

  const doPersist = useCallback(
    async (statusOverride?: Draft['status']): Promise<boolean> => {
      const d = draftRef.current
      const content = editorApi.current?.getMarkdown() ?? contentRef.current
      if (!d.title.trim() && !content.trim()) return false
      setSaving(true)
      const payload: Partial<PostWithContent> = {
        title: d.title,
        // Always have a slug so the API never rejects a content-only draft.
        slug: d.slug || slugify(d.title) || `post-${Date.now()}`,
        date: d.date ? new Date(d.date).toISOString() : new Date().toISOString(),
        status: statusOverride ?? d.status,
        categories: d.categories,
        tags: d.tags,
        series: d.series.trim() || undefined,
        seriesOrder: d.series.trim() ? d.seriesOrder : undefined,
        featuredImage: d.featuredImage || undefined,
        coverImage: d.coverImage || undefined,
        metaTitle: d.metaTitle.trim() || undefined,
        metaDescription: d.metaDescription.trim() || undefined,
        excerpt: d.excerpt,
        content,
      }
      try {
        const editing = currentSlug.current
        const res = await fetch(editing ? `/api/posts/${editing}` : '/api/posts', {
          method: editing ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const json = (await res.json()) as ApiResponse<{ slug: string }>
        if (!json.success || !json.data) {
          notify(json.error === 'slug_taken' ? t.slugTaken : t.saveFailed, 'error')
          return false
        }
        currentSlug.current = json.data.slug
        setSavedSlug(json.data.slug)
        setSavedAt(new Date().toISOString())
        setDirty(false)
        clearLocal() // the server now has it — drop the local recovery copy
        // THE ADDRESS BAR IS SYNCED HERE, AND THE ROUTER IS DELIBERATELY NOT.
        //
        // `router.replace()` would put the new slug in the router's state, which is what
        // `pages/PostEditor.tsx` builds its fetch from and what this form is `key`ed on — so a
        // rename would refetch and REMOUNT the editor, losing cursor, selection and the whole
        // undo stack on the click that saved the work. Hence the raw history call.
        //
        // ⚠️ NOTHING MAY CALL `router.refresh()` AFTER IT. One did, carried over from the
        // Next.js port to "drop the client Router Cache (no stale RSC)" — neither of which
        // exists here, and `Route()` in `App.tsx` renders a different component per path, so
        // every navigation already refetches on mount. It bought nothing and cost this:
        // `refresh()` bumps the epoch, `useView` re-runs off the router's path, and that path
        // is still the OLD slug. 404, and the shell swaps the editor for a red "Not found"
        // while the post sits saved on disk. Reported 2026-08-15; `PageForm` had it too.
        window.history.replaceState(null, '', `/admin/editor/${json.data.slug}`)
        return true
      } catch {
        notify(t.saveFailed, 'error')
        return false
      } finally {
        setSaving(false)
      }
    },
    [notify, t, clearLocal],
  )

  // Queue a save behind any in-flight save and return its result.
  const enqueueSave = useCallback(
    (statusOverride?: Draft['status']): Promise<boolean> => {
      const run = () => doPersist(statusOverride)
      const result = saveChain.current.then(run, run)
      saveChain.current = result.catch(() => {})
      return result
    },
    [doPersist],
  )

  // Local (offline) autosave: stash unsaved edits in localStorage on a timer AND whenever the
  // page is hidden or left. It NEVER writes to the server, so editing a published post cannot
  // push half-finished text live; only Save/Publish does that. The hook carries the reasoning.
  const keptAt = useLocalAutosave(
    () => dirtyRef.current,
    () => ({ ...draftRef.current, content: editorApi.current?.getMarkdown() ?? contentRef.current }),
    saveLocal,
    autosaveSeconds * 1000,
  )
  useUnsavedGuard(() => dirtyRef.current)

  async function handleSave(status: Draft['status'], successMsg: string) {
    if (status === 'published' && !draftRef.current.title.trim()) {
      notify(t.needTitle, 'error')
      return
    }
    update({ status })
    const okSaved = await enqueueSave(status)
    if (okSaved) notify(successMsg)
  }

  // Single pick (image / featured). Gallery uses multi-select -> onPickedMany.
  function onPicked(url: string) {
    if (picker === 'featured') update({ featuredImage: url })
    else if (picker === 'cover') update({ coverImage: url })
    else editorApi.current?.insertImage(url)
    setPicker(null)
  }

  // Gallery: insert every chosen image as a #grid item (they group into a grid).
  function onPickedMany(urls: string[]) {
    editorApi.current?.insertGalleryMany(urls)
    setPicker(null)
  }

  // Pull a recovered local snapshot back into the form (slug/date stay current).
  function restoreLocal() {
    if (!localRecovered) return
    const d = localRecovered.data
    setDraft(d)
    draftRef.current = d
    editorApi.current?.setMarkdown(d.content)
    contentRef.current = d.content
    setDirty(true)
    clearLocal()
    notify(t.revisionLoaded)
  }

  // Load an overwritten version back into the editor (slug + date stay current).
  function restoreRevision(rev: PostRevision) {
    update({
      title: rev.title,
      excerpt: rev.excerpt ?? '',
      featuredImage: rev.featuredImage ?? '',
      categories: rev.categories,
      tags: rev.tags,
      status: rev.status,
    })
    editorApi.current?.setMarkdown(rev.content)
    contentRef.current = rev.content
    setTimeMachine(false)
    notify(t.revisionLoaded)
  }

  // Open the tokened draft preview in a new tab. Saves any pending edits FIRST so
  // the preview reflects the latest content (autosave is local-only, never server),
  // then points the tab at /preview/{slug}?key=. The tab is opened synchronously
  // (before the await) or the popup blocker kills a post-await window.open.
  async function openPreview() {
    const tab = window.open('', '_blank')
    if (dirtyRef.current) {
      const saved = await enqueueSave()
      if (!saved) {
        tab?.close()
        return // enqueueSave already surfaced the error
      }
    }
    const slug = currentSlug.current
    if (!slug) {
      tab?.close()
      return
    }
    try {
      const res = await fetch(`/api/preview-link?slug=${encodeURIComponent(slug)}`)
      const json = (await res.json()) as ApiResponse<{ token: string }>
      if (!json.success || !json.data) throw new Error()
      const url = `${window.location.origin}/preview/${slug}?key=${json.data.token}`
      if (tab) tab.location.href = url
      else window.open(url, '_blank') // popup was blocked — best-effort second try
    } catch {
      tab?.close()
      notify(t.saveFailed, 'error')
    }
  }

  async function uploadInline(file: File): Promise<string | null> {
    try {
      const [item] = await uploadImages([file])
      return item?.url ?? null
    } catch (err) {
      const unsupported = err instanceof Error && err.message === 'unsupported_type'
      notify(unsupported ? t.unsupportedType : t.imageUploadFailed, 'error')
      return null
    }
  }

  // Published but the date is still in the future → queued, not live yet.
  const scheduled = isScheduled(draft.status, draft.date)

  return (
    <div>
      <EditorActions
        barRef={actionHeaderRef}
        status={saveStatusLine(t, saving, savedAt, dirty, keptAt, formatTime)}
        saving={saving}
        dirty={dirty}
        settingsOpen={settingsOpen}
        onToggleSettings={() => setSettingsOpen((v) => !v)}
        savedSlug={savedSlug}
        onPreview={openPreview}
        onSaveDraft={() => void handleSave('draft', t.savedDraft)}
        // The FIRST publish opens the attributes instead of publishing: they are the
        // publish-time questions, and they all already carry an answer (ADR 0024, step 5).
        onPublish={() => {
          if (draft.status !== 'published' && !asking) {
            setAsking(true)
            setSettingsOpen(true)
            return
          }
          void handleSave('published', scheduled ? t.scheduled : t.published)
        }}
        publishLabel={scheduled ? t.schedule : t.publish}
        published={draft.status === 'published'}
      />

      {localRecovered && (
        <LocalDraftNotice at={localRecovered.at} onRestore={restoreLocal} onDiscard={dismissLocal} />
      )}

      <div className={`grid items-start gap-6 ${settingsOpen ? 'xl:grid-cols-[minmax(0,1fr)_340px]' : ''}`}>
        <div className="min-w-0">
          <div className="mx-auto mb-3 w-full" style={{ maxWidth: contentWidth }}>
            {/* The title is part of the WRITING SURFACE, not part of the form: it is the
                post's headline, set in the reading face and aligned to the reading column,
                and it was coming out in the chrome font directly above a body in Literata.
                No `tracking-tight` on it either — that was the sans's -0.025em on a serif
                that publishes at -0.01em. */}
            <textarea
              value={draft.title}
              onChange={(e) => update({ title: e.target.value })}
              placeholder={t.titlePlaceholder}
              rows={1}
              className={`${READING} write-surface min-h-12 w-full resize-none overflow-hidden bg-transparent text-3xl font-bold leading-tight [field-sizing:content] placeholder:text-neutral-300 dark:placeholder:text-neutral-600`}
            />
          </div>
          <Editor initialContent={draft.content} onChange={(md) => { contentRef.current = md }} onDirty={() => setDirty(true)} onPickImage={() => setPicker('editor')} onPickGallery={() => setPicker('gallery')} onUploadFile={uploadInline} apiRef={editorApi} contentWidth={contentWidth} toolbarTop={toolbarTop} typewriterEffects={typewriterEffects} />
        </div>
        {settingsOpen && (
          <PublishPanel
            draft={draft}
            update={update}
            allCategories={allCategories}
            allTags={allTags}
            allSeries={allSeries}
            onPickFeatured={() => setPicker('featured')}
            onPickCover={() => setPicker('cover')}
            asking={asking}
            saving={saving}
            scheduled={scheduled}
            onPublish={() => void handleSave('published', scheduled ? t.scheduled : t.published)}
            links={
              <>
                {savedSlug && <button type="button" onClick={() => setTimeMachine(true)} className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white">{t.history}</button>}
                {draft.status === 'published' && savedSlug && !scheduled && <a href={`/${savedSlug}`} target="_blank" rel="noopener" className="text-neutral-500 hover:text-neutral-900">{t.viewPost}</a>}
              </>
            }
          />
        )}
      </div>

      {picker && (
        <MediaLibrary
          mode="picker"
          multi={picker === 'gallery'}
          onSelect={onPicked}
          onSelectMany={onPickedMany}
          onClose={() => setPicker(null)}
        />
      )}

      {timeMachine && savedSlug && (
        <TimeMachine slug={savedSlug} onRestore={restoreRevision} onClose={() => setTimeMachine(false)} />
      )}
    </div>
  )
}