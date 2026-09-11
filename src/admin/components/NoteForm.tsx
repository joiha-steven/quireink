// Note editor screen (ADR 0044): the page editor's sheet with a date and, for a clip, where
// the passage came from. Same flow as PageForm (auto-save + serialized manual save) but
// hits /api/notes, keeps its draft under the note kind, and links out to /notes/{slug}.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { NoteWithContent, ApiResponse } from '@/types'
import type { KeySound } from './key-sound'
import { Button } from '@/admin/ui/Button'
import { useToast } from '@/admin/ui/Toast'
import { slugify, formatTime, formatDateTimeShort, isoToZonedInput, zonedInputToIso } from '@/utils'
import { uploadImages } from '@/admin/upload-client'
import { Editor, type EditorApi } from './Editor'
import { EditorActions } from './EditorActions'
import { NoteSettings, type NoteDraft } from './NoteSettings'
import { TrashLink } from './TrashLink'
import { MediaLibrary } from './MediaLibrary'
import { SlideOver } from './SlideOver'
import { SheetTitle } from './SheetTitle'
import { readSnapshot, saveStatusLine, useReopenedNotice, useStickyOffset, useUnsavedGuard } from './useLocalDraft'
import { useDraftSafety } from './serverDraft'
import { useAdminT } from './I18nProvider'
import { forgetView } from '@/admin/useView'
import { useListedRow } from './listed'

type Props = {
  initial?: NoteWithContent
  contentWidth: number
  keySound: KeySound
  autosaveSeconds: number
  /** `autosave_at` on the row, in ms — a snapshot waiting from another session or machine. */
  autosaveAt: number | null
  /** The site's clock: the date field is a wall clock on it, not on this machine. */
  timezone: string
}
type PickTarget = 'editor' | 'gallery'

function toDraft(initial: NoteWithContent | undefined, tz: string): NoteDraft {
  return {
    title: initial?.title ?? '',
    slug: initial?.slug ?? '',
    date: isoToZonedInput(initial?.date ?? new Date().toISOString(), tz),
    status: initial?.status ?? 'draft',
    sourceUrl: initial?.sourceUrl ?? '',
    sourceTitle: initial?.sourceTitle ?? '',
    quote: initial?.quote ?? '',
    content: initial?.content ?? '',
  }
}

export function NoteForm({ initial, contentWidth, keySound, autosaveSeconds, autosaveAt, timezone }: Props) {
  const t = useAdminT()
  const { notify } = useToast()
  // The slug the server holds, and the key the snapshot is filed under: both follow the
  // piece rather than the screen. The key was fixed at mount, so everything typed AFTER a
  // new page's first save went on being filed under `new` — where the editor that reopens
  // that note never looks, and where the next blank sheet reopens it as a piece of its own.
  const [savedSlug, setSavedSlug] = useState<string | null>(initial?.slug ?? null)
  const storageKey = `quire:draft:note:${savedSlug ?? 'new'}`
  // A note that has never been saved is reopened rather than offered back. The reasoning,
  // and the measurement, are on `PostForm`.
  const reopened = useRef(initial ? null : readSnapshot<NoteDraft>(storageKey)).current
  const [draft, setDraft] = useState<NoteDraft>(() => reopened?.data ?? toDraft(initial, timezone))
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [picker, setPicker] = useState<PickTarget | null>(null)
  const [dirty, setDirty] = useState(reopened !== null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [asking, setAsking] = useState(false)
  // Mirrors the editor raw/markdown view so the MD switch shows state.
  const [mdView, setMdView] = useState(false)
  const actionHeaderRef = useRef<HTMLDivElement>(null)
  const toolbarTop = useStickyOffset(actionHeaderRef)
  // Both autosaves on one timer — this device and the server — with the same contract as the
  // post editor: neither ever touches the published body. See `serverDraft.ts`.
  const safety = useDraftSafety<NoteDraft>({
    kind: 'note',
    slug: savedSlug,
    storageKey,
    serverAt: autosaveAt,
    rowSavedAt: initial?.updatedAt ? Date.parse(initial.updatedAt) : null,
    isDirty: () => dirtyRef.current,
    snapshot: () => ({ ...draftRef.current, content: editorApi.current?.getMarkdown() ?? contentRef.current }),
    intervalMs: autosaveSeconds * 1000,
  })

  const slugTouched = useRef(Boolean(initial?.slug))
  const currentSlug = useRef<string | null>(initial?.slug ?? null)
  const listed = useListedRow(initial ? [initial.slug, initial.title, initial.status, initial.sourceTitle, initial.quote] : null)
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

  const update = useCallback((partial: Partial<NoteDraft>) => {
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
    async (statusOverride?: NoteDraft['status']): Promise<boolean> => {
      const d = draftRef.current
      const content = editorApi.current?.getMarkdown() ?? contentRef.current
      if (!d.title.trim() && !d.sourceTitle.trim() && !content.trim()) return false
      setSaving(true)
      const payload: Partial<NoteWithContent> = {
        title: d.title,
        slug: d.slug || slugify(d.title || d.sourceTitle) || `note-${Date.now()}`,
        date: d.date ? zonedInputToIso(d.date, timezone) : new Date().toISOString(),
        status: statusOverride ?? d.status,
        sourceUrl: d.sourceUrl.trim() || undefined,
        sourceTitle: d.sourceTitle.trim() || undefined,
        quote: d.quote.trim() || undefined,
        content,
      }
      try {
        const editing = currentSlug.current
        const res = await fetch(editing ? `/api/notes/${editing}` : '/api/notes', {
          method: editing ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const json = (await res.json()) as ApiResponse<{ slug: string }>
        if (!json.success || !json.data) {
          notify(json.error === 'slug_taken' ? t.slugTaken : t.saveFailed, 'error')
          return false
        }
        // The cached copy of this piece is now the version before this save. Dropping it is
        // what stops the next open seeding the editor from it (`forgetView`).
        forgetView('note-editor', `?slug=${encodeURIComponent(json.data.slug)}`)
        forgetView('note-editor', editing ? `?slug=${encodeURIComponent(editing)}` : '')
        currentSlug.current = json.data.slug
        setSavedSlug(json.data.slug)
        setSavedAt(new Date().toISOString())
        listed([json.data.slug, d.title, statusOverride ?? d.status, d.sourceTitle.trim() || undefined, d.quote.trim() || undefined])
        // Only if nothing moved while the request was in the air, and the slug stops being
        // derived from the title once there is a row. Both reasons are on `PostForm`.
        if ((editorApi.current?.getMarkdown() ?? contentRef.current) === content) {
          setDirty(false)
          safety.clear() // the server now has it — drop both recovery copies
        }
        slugTouched.current = true
        // THE ADDRESS BAR IS SYNCED HERE, AND THE ROUTER IS DELIBERATELY NOT.
        //
        // `router.replace()` would put the new slug into the router's own state, which is
        // what ``pages/NoteEditor.tsx`` reads to build its fetch — and what the form below is `key`ed on.
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
        // whole time: editing a draft's link and then publishing landed on "Not found".
        // twice, because `PageForm` had the identical two lines.
        window.history.replaceState(null, '', `/admin/note-editor/${json.data.slug}`)
        return true
      } catch {
        notify(t.saveFailed, 'error')
        return false
      } finally {
        setSaving(false)
      }
    },
    [notify, t, safety, timezone],
  )

  const enqueueSave = useCallback(
    (statusOverride?: NoteDraft['status']): Promise<boolean> => {
      const run = () => doPersist(statusOverride)
      const result = saveChain.current.then(run, run)
      saveChain.current = result.catch(() => {})
      return result
    },
    [doPersist],
  )

  useUnsavedGuard(() => dirtyRef.current)

  useReopenedNotice(reopened !== null, safety.recovered !== null, safety.dismiss, () => notify(t.localDraftFound))

  async function handleSave(status: NoteDraft['status'], successMsg: string) {
    if (status === 'published' && !draftRef.current.title.trim() && !draftRef.current.sourceTitle.trim()) {
      notify(t.needTitle, 'error')
      return
    }
    // The status follows the save, and is written straight into the draft. Setting it first
    // left the sheet claiming Published for a page the server had refused; going through
    // `update` would mark the form dirty over a status the server has just accepted. Same
    // reasoning as `PostForm`.
    const okSaved = await enqueueSave(status)
    if (!okSaved) return
    setDraft((prev) => ({ ...prev, status }))
    draftRef.current = { ...draftRef.current, status }
    notify(successMsg)
  }

  // Single pick (image). Gallery uses multi-select -> onPickedMany.
  function onPicked(url: string, alt?: string) {
    editorApi.current?.insertImage(url, alt)
    setPicker(null)
  }

  // Gallery: insert every chosen image as a #grid item (they group into a grid).
  function onPickedMany(urls: string[]) {
    editorApi.current?.insertGalleryMany(urls)
    setPicker(null)
  }

  // Pull the recovered snapshot back — device or server, whichever was newer.
  //
  // The slug STAYS, which the comment has claimed since this was written and the code did
  // not do: a whole-object `setDraft` carried the snapshot's slug over the live one, so
  // restoring into a saved note renamed its URL.
  async function restoreDraft() {
    const d = await safety.restore()
    if (!d) return
    if (initial) d.slug = draftRef.current.slug
    setDraft(d)
    draftRef.current = d
    editorApi.current?.setMarkdown(d.content)
    contentRef.current = d.content
    setDirty(true)
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
    `${t.kindNote} · ${draft.status === 'published' ? t.statusPublished : t.statusDraft}`,
    touched ? formatDateTimeShort(touched) : null,
  ].filter(Boolean).join(' · ')

  return (
    <div>


      <Editor
        actions={
          <EditorActions
            barRef={actionHeaderRef}
            status={saveStatusLine(t, saving, savedAt, dirty, safety.keptAt, formatTime, safety.sentAt)}
            saving={saving}
            dirty={dirty}
            settingsOpen={settingsOpen}
            onToggleSettings={() => setSettingsOpen((v) => !v)}
            savedSlug={null}
            mdView={mdView}
            onToggleMd={() => editorApi.current?.toggleRaw()}
            recovered={safety.recovered ? { ...safety.recovered, onRestore: () => void restoreDraft(), onDiscard: safety.dismiss } : null}
            getText={() => `${draftRef.current.title} ${editorApi.current?.getMarkdown() ?? contentRef.current}`}
            onPreview={() => undefined}
            // A note has no schedule either, and it is read under /notes/.
            live={draft.status === 'published' && savedSlug ? { href: `/notes/${savedSlug}`, label: t.viewNote } : null}
            onSaveDraft={() => void handleSave('draft', t.savedDraft)}
            // Same publish contract as a post (ADR 0024, step 5): the first Publish on a note
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
          <NoteSettings draft={draft} update={update} />
          {/* Saved only: an unsaved note has no slug the server has ever seen. */}
          {savedSlug && <TrashLink kind="note" slug={savedSlug} />}
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