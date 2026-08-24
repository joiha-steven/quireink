// Page editor screen: the same sheet as the post editor — one quiet action line, the title
// on the paper, the attributes on a slide-over. Same flow as PostForm (auto-save +
// serialized manual save) but hits /api/pages and has no taxonomy or date.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { PageWithContent, ApiResponse } from '@/types'
import type { KeySound } from './key-sound'
import { Button } from '@/admin/ui/Button'
import { useToast } from '@/admin/ui/Toast'
import { slugify, formatTime, formatDateTimeShort } from '@/utils'
import { uploadImages } from '@/admin/upload-client'
import { Editor, type EditorApi } from './Editor'
import { EditorActions } from './EditorActions'
import { PageSettings, type PageDraft } from './PageSettings'
import { MediaLibrary } from './MediaLibrary'
import { SlideOver } from './SlideOver'
import { SheetTitle } from './SheetTitle'
import { saveStatusLine, useLocalAutosave, useLocalDraft, useStickyOffset, useUnsavedGuard } from './useLocalDraft'
import { useAdminT } from './I18nProvider'

type Props = { initial?: PageWithContent; contentWidth: number; keySound: KeySound; autosaveSeconds: number }
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

export function PageForm({ initial, contentWidth, keySound, autosaveSeconds }: Props) {
  const t = useAdminT()
  const { notify } = useToast()
  const [draft, setDraft] = useState<PageDraft>(() => toDraft(initial))
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [picker, setPicker] = useState<PickTarget | null>(null)
  const [dirty, setDirty] = useState(false)
  const [savedSlug, setSavedSlug] = useState<string | null>(initial?.slug ?? null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [asking, setAsking] = useState(false)
  // Mirrors the editor raw/markdown view so the MD switch shows state.
  const [mdView, setMdView] = useState(false)
  const actionHeaderRef = useRef<HTMLDivElement>(null)
  const toolbarTop = useStickyOffset(actionHeaderRef)
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
        // THE ADDRESS BAR IS SYNCED HERE, AND THE ROUTER IS DELIBERATELY NOT.
        //
        // `router.replace()` would put the new slug into the router's own state, which is
        // what ``pages/PageEditor.tsx`` reads to build its fetch — and what the form below is `key`ed on.
        // A rename would therefore refetch and REMOUNT the editor: cursor, selection and the
        // whole undo stack gone, on the click that saved the work. So the raw history call.
        //
        // ⚠️ AND NOTHING MAY CALL `router.refresh()` AFTER IT. There used to be one here,
        // carried over from the Next.js port with the comment "drop the client Router Cache
        // so admin lists show this save (no stale RSC)". There is no Router Cache and no RSC
        // in this admin, and `Route()` in `App.tsx` renders a different component per path —
        // so every navigation unmounts the page and `useView` refetches on mount anyway. The
        // call bought nothing, and it cost this: `refresh()` bumps the epoch, `useView` re-runs
        // with the router's path, and the router's path is the OLD slug. The server answers
        // 404, the shell swaps the editor for a red "Not found", and the post is on disk the
        // whole time. Reported 2026-08-15 as "sửa link bài nháp rồi đăng là bị Not found" —
        // twice, because `PageForm` had the identical two lines.
        window.history.replaceState(null, '', `/admin/page-editor/${json.data.slug}`)
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
  function onPicked(url: string, alt?: string) {
    if (picker === 'featured') update({ featuredImage: url })
    else editorApi.current?.insertImage(url, alt)
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

  // The line under the title: what this piece is, and when it was last touched.
  const touched = savedAt ?? initial?.updatedAt
  const metaLine = [
    `${t.kindPage} · ${draft.status === 'published' ? t.statusPublished : t.statusDraft}`,
    touched ? formatDateTimeShort(touched) : null,
  ].filter(Boolean).join(' · ')

  return (
    <div>


      <Editor
        actions={
          <EditorActions
            barRef={actionHeaderRef}
            status={saveStatusLine(t, saving, savedAt, dirty, keptAt, formatTime)}
            saving={saving}
            dirty={dirty}
            settingsOpen={settingsOpen}
            onToggleSettings={() => setSettingsOpen((v) => !v)}
            savedSlug={null}
            mdView={mdView}
            onToggleMd={() => editorApi.current?.toggleRaw()}
            recovered={localRecovered ? { at: localRecovered.at, onRestore: restoreLocal, onDiscard: dismissLocal } : null}
            getText={() => `${draftRef.current.title} ${editorApi.current?.getMarkdown() ?? contentRef.current}`}
            onPreview={() => undefined}
            onSaveDraft={() => void handleSave('draft', t.savedDraft)}
            // Same publish contract as a post (ADR 0024, step 5): the first Publish on a page
            // never published opens its attributes — the slug is a question worth one look.
            onPublish={() => {
              if (draft.status !== 'published' && !asking) {
                setAsking(true)
                setSettingsOpen(true)
                return
              }
              void handleSave('published', t.published)
            }}
            publishLabel={t.publish}
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
        <SlideOver
          label={asking ? t.pubTitle : t.attributes}
          intro={asking ? t.publishReview : undefined}
          headerRight={
            draft.status === 'published' && savedSlug ? (
              <a href={`/${savedSlug}`} target="_blank" rel="noopener" className="text-neutral-500 hover:text-neutral-900">{t.viewPost}</a>
            ) : undefined
          }
          onClose={() => { setSettingsOpen(false); setAsking(false) }}
          footer={
            <>
              <Button variant="secondary" type="button" onClick={() => { setSettingsOpen(false); setAsking(false) }}>
                {asking ? t.pubLater : t.hideAttributes}
              </Button>
              {asking && (
                <Button onClick={() => void handleSave('published', t.published)} disabled={saving}>
                  {t.publish}
                </Button>
              )}
            </>
          }
        >
          <PageSettings draft={draft} update={update} onPickFeatured={() => setPicker('featured')} />
        </SlideOver>
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
    </div>
  )
}