// Page editor screen: left = TipTap editor, right = settings, bottom = action bar.
// Same flow as PostForm (auto-save + serialized manual save) but hits /api/pages
// and has no taxonomy or date.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from '@/admin/router'
import type { PageWithContent, ApiResponse } from '@/types'
import { Button } from '@/admin/ui/Button'
import { useToast } from '@/admin/ui/Toast'
import { slugify, formatTime } from '@/utils'
import { uploadImages } from '@/admin/upload-client'
import { Editor, type EditorApi } from './Editor'
import { PageSettings, type PageDraft } from './PageSettings'
import { MediaLibrary } from './MediaLibrary'
import { saveStatusLine, useLocalAutosave, useLocalDraft, useUnsavedGuard } from './useLocalDraft'
import { useAdminT } from './I18nProvider'
import { CARD, NOTICE, READING } from './kit'

type Props = { initial?: PageWithContent; contentWidth: number; typewriterEffects: boolean; autosaveSeconds: number }
type PickTarget = 'editor' | 'gallery' | 'featured'

function toDraft(initial?: PageWithContent): PageDraft {
  return {
    title: initial?.title ?? '',
    slug: initial?.slug ?? '',
    status: initial?.status ?? 'draft',
    featuredImage: initial?.featuredImage ?? '',
    content: initial?.content ?? '',
  }
}

export function PageForm({ initial, contentWidth, typewriterEffects, autosaveSeconds }: Props) {
  const t = useAdminT()
  const router = useRouter()
  const { notify } = useToast()
  const [draft, setDraft] = useState<PageDraft>(() => toDraft(initial))
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [picker, setPicker] = useState<PickTarget | null>(null)
  const [dirty, setDirty] = useState(false)
  const [savedSlug, setSavedSlug] = useState<string | null>(initial?.slug ?? null)
  // Local (offline) autosave — keyed per page so drafts don't clobber each other.
  const {
    recovered: localRecovered,
    save: saveLocal,
    clear: clearLocal,
    dismiss: dismissLocal,
  } = useLocalDraft<PageDraft>(`quire:draft:page:${initial?.slug ?? 'new'}`)

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

  const update = useCallback((partial: Partial<PageDraft>) => {
    setDirty(true)
    setDraft((prev) => {
      const next = { ...prev, ...partial }
      if ('slug' in partial) slugTouched.current = true
      if ('title' in partial && !slugTouched.current) next.slug = slugify(partial.title ?? '')
      return next
    })
  }, [])

  // One save at a time: every save runs after the previous finishes (chained).
  const saveChain = useRef<Promise<unknown>>(Promise.resolve())

  const doPersist = useCallback(
    async (statusOverride?: PageDraft['status']): Promise<boolean> => {
      const d = draftRef.current
      const content = editorApi.current?.getMarkdown() ?? contentRef.current
      if (!d.title.trim() && !content.trim()) return false
      setSaving(true)
      const payload: Partial<PageWithContent> = {
        title: d.title,
        slug: d.slug || slugify(d.title) || `page-${Date.now()}`,
        status: statusOverride ?? d.status,
        featuredImage: d.featuredImage || undefined,
        content,
      }
      try {
        const editing = currentSlug.current
        const res = await fetch(editing ? `/api/pages/${editing}` : '/api/pages', {
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
        window.history.replaceState(null, '', `/admin/page-editor/${json.data.slug}`)
        // Drop the client Router Cache so the save shows on the next navigation.
        router.refresh()
        return true
      } catch {
        notify(t.saveFailed, 'error')
        return false
      } finally {
        setSaving(false)
      }
    },
    [notify, t, router, clearLocal],
  )

  const enqueueSave = useCallback(
    (statusOverride?: PageDraft['status']): Promise<boolean> => {
      const run = () => doPersist(statusOverride)
      const result = saveChain.current.then(run, run)
      saveChain.current = result.catch(() => {})
      return result
    },
    [doPersist],
  )

  // Local (offline) autosave, same contract as the post editor: localStorage only, never the
  // server, so editing a published page cannot push half-finished text live.
  const keptAt = useLocalAutosave(
    () => dirtyRef.current,
    () => ({ ...draftRef.current, content: editorApi.current?.getMarkdown() ?? contentRef.current }),
    saveLocal,
    autosaveSeconds * 1000,
  )
  useUnsavedGuard(() => dirtyRef.current)

  async function handleSave(status: PageDraft['status'], successMsg: string) {
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
    else editorApi.current?.insertImage(url)
    setPicker(null)
  }

  // Gallery: insert every chosen image as a #grid item (they group into a grid).
  function onPickedMany(urls: string[]) {
    editorApi.current?.insertGalleryMany(urls)
    setPicker(null)
  }

  // Pull a recovered local snapshot back into the form (slug stays current).
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

  return (
    <div className="pb-24">
      {/* The page's title, in the face it will be published in — see PostForm for why it
          also carries `data-specimen`. */}
      <input
        value={draft.title}
        onChange={(e) => update({ title: e.target.value })}
        placeholder={t.titlePlaceholder}
        data-specimen
        className={`${READING} mb-6 w-full bg-transparent text-3xl font-bold outline-none placeholder:text-neutral-300 dark:placeholder:text-neutral-600`}
      />

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

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Editor
          initialContent={draft.content}
          onChange={(md) => { contentRef.current = md }}
          onDirty={() => setDirty(true)}
          onPickImage={() => setPicker('editor')}
          onPickGallery={() => setPicker('gallery')}
          onUploadFile={uploadInline}
          apiRef={editorApi}
          contentWidth={contentWidth}
          typewriterEffects={typewriterEffects}
        />
        <div className={`p-5 lg:sticky lg:top-6 ${CARD}`}>
          <PageSettings draft={draft} update={update} onPickFeatured={() => setPicker('featured')} />
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200/80 bg-white/90 shadow-[0_-8px_24px_rgba(0,0,0,0.04)] backdrop-blur-xl md:left-[var(--admin-nav-w,13rem)] dark:border-neutral-800 dark:bg-neutral-900/90">
        <div className="mx-auto flex w-full max-w-[1480px] items-center justify-between px-4 py-3 sm:px-7 lg:px-10 xl:px-12">
          <span className="text-sm text-neutral-400 dark:text-neutral-500">
            {saveStatusLine(t, saving, savedAt, dirty, keptAt, formatTime)}
          </span>
          <div className="flex items-center gap-2">
            {draft.status === 'published' && savedSlug && (
              <a href={`/${savedSlug}`} target="_blank" rel="noopener" className="px-3 py-1.5 text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white">
                {t.viewPost}
              </a>
            )}
            <Button variant="secondary" onClick={() => handleSave('draft', t.savedDraft)} disabled={saving || !dirty}> {t.saveDraft} </Button>
            <Button onClick={() => handleSave('published', t.published)} disabled={saving || (!dirty && draft.status === 'published')}> {t.publish} </Button>
          </div>
        </div>
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
    </div>
  )
}