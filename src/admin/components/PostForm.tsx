// Editor screen: left = TipTap editor, right = settings, bottom = action bar.
// Handles auto-save, manual save (draft/publish) and the media picker modal.
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from '@/admin/router'
import type { PostWithContent, PostRevision, ApiResponse } from '@/types'
import { Button } from '@/admin/ui/Button'
import { useToast } from '@/admin/ui/Toast'
import { slugify, formatTime, isScheduled } from '@/utils'
import { uploadImages } from '@/admin/upload-client'
import { Editor, type EditorApi } from './Editor'
import { PostSettings, type Draft } from './PostSettings'
import { MediaLibrary } from './MediaLibrary'
import { TimeMachine } from './TimeMachine'
import { saveStatusLine, useLocalAutosave, useLocalDraft, useUnsavedGuard } from './useLocalDraft'
import { useAdminT } from './I18nProvider'
import { CARD, NOTICE, READING } from './kit'

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
  const [settingsOpen, setSettingsOpen] = useState(true)
  const [toolbarTop, setToolbarTop] = useState(0)
  const actionHeaderRef = useRef<HTMLDivElement>(null)
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
  useEffect(() => {
    const header = actionHeaderRef.current
    if (!header) return
    const desktop = window.matchMedia('(min-width: 1024px)')
    const sync = () => setToolbarTop(desktop.matches ? Math.ceil(header.getBoundingClientRect().height + 16) : 0)
    const observer = new ResizeObserver(sync)
    observer.observe(header)
    desktop.addEventListener('change', sync)
    sync()
    return () => {
      observer.disconnect()
      desktop.removeEventListener('change', sync)
    }
  }, [])

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
      <div ref={actionHeaderRef} className="z-20 mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur-xl lg:sticky lg:top-4 dark:border-neutral-800 dark:bg-neutral-900/95">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/admin/content" className="text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">← {t.navDashboard}</Link>
          <span className="hidden h-4 w-px bg-neutral-200 sm:block dark:bg-neutral-800" />
          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            {saveStatusLine(t, saving, savedAt, dirty, keptAt, formatTime)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* `<Button variant="secondary">`, not a fifth copy of it. This was the whole class
              list re-typed — one border shade off, its own hover, and a `shadow-sm` in an
              admin that draws none. */}
          <Button variant="secondary" type="button" onClick={() => setSettingsOpen((v) => !v)}>
            {settingsOpen ? t.hideAttributes : t.attributes}
          </Button>
          {savedSlug && <button type="button" onClick={openPreview} className="px-3 py-1.5 text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white">{t.previewDraft}</button>}
          <Button variant="secondary" onClick={() => handleSave('draft', t.savedDraft)} disabled={saving || !dirty}>{t.saveDraft}</Button>
          <Button onClick={() => handleSave('published', scheduled ? t.scheduled : t.published)} disabled={saving || (!dirty && draft.status === 'published')}>{scheduled ? t.schedule : t.publish}</Button>
        </div>
      </div>

      {localRecovered && (
        <div className={`mb-4 ${NOTICE}`}>
          <span className="text-neutral-800 dark:text-neutral-200">
            {t.localDraftFound} · {formatTime(localRecovered.at)}
          </span>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={restoreLocal}>
              {t.localDraftRestore}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={dismissLocal}>
              {t.localDraftDiscard}
            </Button>
          </div>
        </div>
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
          <aside className={`p-5 xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto ${CARD}`}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">{t.attributes}</h2>
              <div className="flex gap-3 text-xs">
                {savedSlug && <button type="button" onClick={() => setTimeMachine(true)} className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white">{t.history}</button>}
                {draft.status === 'published' && savedSlug && !scheduled && <a href={`/${savedSlug}`} target="_blank" rel="noopener" className="text-neutral-500 hover:text-neutral-900">{t.viewPost}</a>}
              </div>
            </div>
            <PostSettings draft={draft} update={update} allCategories={allCategories} allTags={allTags} allSeries={allSeries} onPickFeatured={() => setPicker('featured')} onPickCover={() => setPicker('cover')} />
          </aside>
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