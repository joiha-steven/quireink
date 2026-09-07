// Editor screen: a sheet of paper (title, meta, writing), one quiet action line above it,
// and the attributes on a slide-over when they are asked for.
// Handles auto-save, manual save (draft/publish) and the media picker modal.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { PostWithContent, PostRevision, ApiResponse } from '@/types'
import type { KeySound } from './key-sound'
import { useToast } from '@/admin/ui/Toast'
import { slugify, formatTime, formatDateTimeShort, isScheduled } from '@/utils'
import { uploadImages } from '@/admin/upload-client'
import { Editor, type EditorApi } from './Editor'
import { type Draft } from './PostSettings'
import { toDraft, toPayload } from './post-draft'
import { PublishPanel } from './PublishPanel'
import { EditorActions } from './EditorActions'
import { MediaLibrary } from './MediaLibrary'
import { TimeMachine } from './TimeMachine'
import { TrashLink } from './TrashLink'
import { EditorLinks } from './EditorLinks'
import { SheetTitle } from './SheetTitle'
import { readSnapshot, saveStatusLine, useReopenedNotice, useStickyOffset, useUnsavedGuard } from './useLocalDraft'
import { useDraftSafety } from './serverDraft'
import { useAdminT } from './I18nProvider'
import { forgetView } from '@/admin/useView'

type Props = {
  initial?: PostWithContent
  allCategories: string[]
  allTags: string[]
  allSeries: string[]
  contentWidth: number
  keySound: KeySound
  autosaveSeconds: number
  /** `autosave_at` on the row, in ms: a snapshot waiting from another session or machine. */
  autosaveAt: number | null
  /** The blog's own clock, for the schedule field. Empty means the machine's. */
  timezone: string
}

type PickTarget = 'editor' | 'gallery' | 'featured' | 'cover'

export function PostForm({ initial, allCategories, allTags, allSeries, contentWidth, keySound, autosaveSeconds, autosaveAt , timezone}: Props) {
  const t = useAdminT()
  const { notify } = useToast()
  // The slug the server holds, and the key the snapshot is filed under: both follow the
  // piece rather than the screen. The key was fixed at mount, so everything typed AFTER a
  // new post's first save went on being filed under `new` — where the editor that reopens
  // that post never looks, and where the next blank sheet reopens it as a piece of its own.
  const [savedSlug, setSavedSlug] = useState<string | null>(initial?.slug ?? null)
  const storageKey = `quire:draft:post:${savedSlug ?? 'new'}`
  // A piece with no row is REOPENED from its snapshot (see `readSnapshot`), read here so
  // the editor mounts with the work already in it.
  const reopened = useRef(initial ? null : readSnapshot<Draft>(storageKey)).current
  const [draft, setDraft] = useState<Draft>(() => reopened?.data ?? toDraft(initial, timezone))
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
  // Mirrors the editor raw/markdown view so the MD switch shows state.
  const [mdView, setMdView] = useState(false)
  const actionHeaderRef = useRef<HTMLDivElement>(null)
  const toolbarTop = useStickyOffset(actionHeaderRef)
  // Unsaved-changes flag: drives button states, autosave and the exit warning. A reopened
  // draft starts dirty, because it is: nothing has ever been saved.
  const [dirty, setDirty] = useState(reopened !== null)

  const slugTouched = useRef(Boolean(initial?.slug))
  const currentSlug = useRef<string | null>(initial?.slug ?? null)
  const editorApi = useRef<EditorApi | null>(null)
  // Live editor content lives here (not in React state) so typing never
  // re-renders the form. Saves read editorApi.getMarkdown() for the latest text.
  const contentRef = useRef<string>(reopened?.data.content ?? initial?.content ?? '')
  const draftRef = useRef(draft)
  const dirtyRef = useRef(dirty)
  useEffect(() => {
    draftRef.current = draft
  }, [draft])
  useEffect(() => {
    dirtyRef.current = dirty
  }, [dirty])

  // Both autosaves on one timer: localStorage here, `autosave_json` on the server. Neither
  // touches the published body, so editing a live post cannot push half a sentence to a
  // reader — only Save/Publish moves it. Reasoning in `serverDraft.ts`.
  const safety = useDraftSafety<Draft>({
    kind: 'post',
    slug: savedSlug,
    storageKey,
    serverAt: autosaveAt,
    rowSavedAt: initial?.updatedAt ? Date.parse(initial.updatedAt) : null,
    isDirty: () => dirtyRef.current,
    snapshot: () => ({ ...draftRef.current, content: editorApi.current?.getMarkdown() ?? contentRef.current }),
    intervalMs: autosaveSeconds * 1000,
  })
  useUnsavedGuard(() => dirtyRef.current)

  useReopenedNotice(reopened !== null, safety.recovered !== null, safety.dismiss, () => notify(t.localDraftFound))

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
      const payload = toPayload(d, content, timezone, statusOverride)
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
        // The cached view of this piece now predates this save (`forgetView`).
        for (const was of [json.data.slug, editing]) forgetView('editor', was ? `?slug=${encodeURIComponent(was)}` : '')
        currentSlug.current = json.data.slug
        setSavedSlug(json.data.slug)
        setSavedAt(new Date().toISOString())
        // ONLY IF NOTHING MOVED WHILE THE REQUEST WAS IN THE AIR. `content` was read before
        // the fetch, so marking the form clean over a sentence typed during it turned off
        // the exit warning and dropped the recovery copies for exactly that sentence.
        if ((editorApi.current?.getMarkdown() ?? contentRef.current) === content) {
          setDirty(false)
          safety.clear() // the server now has it — drop both recovery copies
        }
        // Nothing set this after the first save, so every later title edit renamed a post
        // that had already been shared.
        slugTouched.current = true
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
    [notify, t, safety],
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

  async function handleSave(status: Draft['status'], successMsg: string) {
    if (status === 'published' && !draftRef.current.title.trim()) {
      notify(t.needTitle, 'error')
      return
    }
    // The STATUS follows the save. Set first, a refused save left the sheet saying Published
    // for a post the server still had as a draft. Written straight into the draft rather
    // than through `update`, which would mark the form dirty over a status just accepted.
    const okSaved = await enqueueSave(status)
    if (!okSaved) return
    setDraft((prev) => ({ ...prev, status }))
    draftRef.current = { ...draftRef.current, status }
    notify(successMsg)
  }

  // Single pick (image / featured). Gallery uses multi-select -> onPickedMany.
  function onPicked(url: string, alt?: string) {
    if (picker === 'featured') update({ featuredImage: url })
    else if (picker === 'cover') update({ coverImage: url })
    else editorApi.current?.insertImage(url, alt)
    setPicker(null)
  }

  // Gallery: insert every chosen image as a #grid item (they group into a grid).
  function onPickedMany(urls: string[]) {
    editorApi.current?.insertGalleryMany(urls)
    setPicker(null)
  }

  // Pull the recovered snapshot back — device or server, whichever was newer. The slug and
  // the date STAY on a piece that has a row, which this comment claimed and the code did
  // not do: a whole-object `setDraft` carried the snapshot's slug over the live one, so a
  // restore renamed a published post's URL.
  async function restoreDraft() {
    const d = await safety.restore()
    if (!d) return
    if (initial) {
      d.slug = draftRef.current.slug
      d.date = draftRef.current.date
    }
    setDraft(d)
    draftRef.current = d
    editorApi.current?.setMarkdown(d.content)
    contentRef.current = d.content
    setDirty(true)
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

  const touched = savedAt ?? initial?.updatedAt // feeds the mock's line under the title
  const metaLine = [
    scheduled ? t.scheduled : draft.status === 'published' ? t.statusPublished : t.statusDraft,
    touched ? formatDateTimeShort(touched) : null,
  ].filter(Boolean).join(' · ')

  return (
    <div>

      {/* One column, always: the attributes live on a slide-over now, so opening them no
          longer squeezes the writing into a narrower measure (the mock's sheet). */}
      <Editor
        actions={
          <EditorActions
            barRef={actionHeaderRef}
            status={saveStatusLine(t, saving, savedAt, dirty, safety.keptAt, formatTime, safety.sentAt)}
            saving={saving}
            dirty={dirty}
            settingsOpen={settingsOpen}
            onToggleSettings={() => setSettingsOpen((v) => !v)}
            savedSlug={savedSlug}
            mdView={mdView}
            onToggleMd={() => editorApi.current?.toggleRaw()}
            recovered={safety.recovered ? { ...safety.recovered, onRestore: () => void restoreDraft(), onDiscard: safety.dismiss } : null}
            getText={() => `${draftRef.current.title} ${editorApi.current?.getMarkdown() ?? contentRef.current}`}
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
        }
        initialContent={draft.content}
        onChange={(md) => { contentRef.current = md }}
        onDirty={() => setDirty(true)}
        onPickImage={() => setPicker('editor')}
        onPickGallery={() => setPicker('gallery')}
        onUploadFile={uploadInline}
        apiRef={editorApi}
        contentWidth={contentWidth}
        toolbarTop={toolbarTop}
        keySound={keySound}
        onRawChange={setMdView}
        header={<SheetTitle value={draft.title} onChange={(title) => update({ title })} placeholder={t.titlePlaceholder} metaLine={metaLine} />}
      />
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
          onClose={() => { setSettingsOpen(false); setAsking(false) }}
          links={<EditorLinks slug={savedSlug} published={draft.status === 'published'}
            scheduled={scheduled} onHistory={() => setTimeMachine(true)} />}
          bottom={savedSlug ? <TrashLink kind="post" slug={savedSlug} /> : undefined}
        />
      )}

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