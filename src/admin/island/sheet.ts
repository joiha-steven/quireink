// THE WRITING SHEET'S BEHAVIOUR — ADR 0054's last screen.
//
// The page arrives finished: the action line, the title, the paper's frame, every field of the
// attributes panel, the time machine's dialog. What this adds is the part a server cannot draw
// — a ProseMirror editor, a draft that changes under the hand, two autosaves, and one save
// chain that everything else queues behind.
//
// ⚠️ ONE SAVE AT A TIME. Every save runs after the previous one finishes, so an autosave and a
// Publish can never race or double-create a piece. It is the single most important line in this
// file: without it the first save of a new post can run twice and leave two rows.
//
// The write column beside the paper is the SAME island the list screen uses, and importing it
// BOOTS it: the column wires itself at module scope. One module for both writing screens, and
// no second copy of that behaviour.
import { redrawColumn } from './content'
import type { PostRevision } from '@/types'
import {
  draftKey, emptyDraft, LIVE_PATH, SHEET_PATH,
  type SheetData, type SheetDraft, type SheetWords,
} from '@/admin-shared/sheet-wire'
import { saveStatusLine } from '@/admin-shared/draft-keep'
import { formatDateTimeShort, formatTime } from '@/admin-shared/when'
import { formatWallClock } from '@/i18n/format'
import { isScheduled, slugify } from '@/utils'
import { withLiveIdentity } from '@/admin/components/restore-identity'
import { askForLink } from './lib/ask-link'
import { say } from './lib/media-bridge'
import { readSnapshot } from './lib/sheet-keep'
import { nameEnough, payloadOf, savePiece, worthSaving } from './lib/sheet-save'
import { mountPaper } from './lib/sheet-paper'
import { wireBar } from './lib/sheet-bar'
import { wireFields, askForPicture } from './lib/sheet-fields'
import { wirePanel } from './lib/sheet-open'
import { wireSafety, type Snapshot } from './lib/sheet-safety'
import { wireHistory } from './lib/sheet-history'
import { moveToTrash, openPreview, uploadInline } from './lib/sheet-errands'

type Payload = SheetData & { words: SheetWords }

const host = document.querySelector<HTMLElement>('[data-sheet]')
const said = host?.querySelector<HTMLScriptElement>('[data-sheet-data]')?.textContent
if (host && said) boot(host, JSON.parse(said) as Payload)

function boot(root: HTMLElement, data: Payload): void {
  const t = data.words
  const { kind, lang, timezone } = data
  const draft: SheetDraft = { ...emptyDraft(), ...data.draft }
  let content = data.content
  let slug = data.slug
  let dirty = false
  let saving = false
  let savedAt: string | null = null
  let asking = false
  // What the server printed AFTER the state, so a sheet that has not been saved this session
  // keeps the row's own time rather than blanking it on the first repaint. A piece that has
  // never been touched has no second part, and taking the last one regardless would print its
  // state twice.
  const saidParts = (root.querySelector('[data-sheet-meta]')?.textContent ?? '').split(' · ')
  const touchedAt = saidParts.length > 1 ? saidParts[saidParts.length - 1] ?? '' : ''
  // The slug follows the title until somebody types one. It counts as typed from the first
  // save onwards: nothing set this after that save, so every later title edit renamed a post
  // that had already been shared.
  let slugTyped = Boolean(draft.slug)

  /**
   * A NEW PIECE REOPENS FROM ITS SNAPSHOT.
   *
   * There is no row and so no server copy; the only record of a crash mid-draft is on this
   * device, and a blank sheet over the top of it is the work gone. Read before the editor is
   * built, so it opens with the words already in it rather than putting them in afterwards.
   */
  const reopened = slug ? null : readSnapshot<Snapshot>(draftKey(kind, ''))
  if (reopened) {
    Object.assign(draft, reopened.data)
    content = reopened.data.content
    dirty = true
  }

  // ---- the parts the server drew ------------------------------------------------------

  const at = <T extends HTMLElement>(hook: string): T | null => root.querySelector<T>(hook)
  const bar = at('[data-sheet-actions]')
  const titleBox = at<HTMLTextAreaElement>('[data-sheet-title]')
  const slugBox = at<HTMLInputElement>('[data-k="slug"]')
  const dateNote = at('[data-date-note]')
  const metaLine = at('[data-sheet-meta]')
  // The three doors a piece only has once it HAS a row: its past, its figures, and the bin.
  const trashBlock = at('[data-trash-block]')
  const past = at('[data-sheet-history]')
  const stats = at<HTMLAnchorElement>('[data-piece-stats]')
  if (!bar) return

  // ---- the paper ----------------------------------------------------------------------

  const paper = mountPaper({
    bar,
    toolbarSlot: at('[data-toolbar-slot]')!,
    findSlot: at('[data-find-slot]')!,
    sourceSlot: at('[data-source-slot]')!,
    paperSlot: at('[data-paper-slot]')!,
    hint: at('[data-sheet-hint]'),
  }, {
    t,
    content,
    keySound: data.keySound,
    askLink: askForLink(t),
    onDirty: () => markDirty(),
    onText: (md) => { content = md },
    pickImage: () => void choose('editor'),
    pickGallery: () => void choose('gallery'),
    uploadFile: (file) => uploadInline(t, file),
  })

  const body = (): string => paper.getMarkdown()

  // ---- what the sheet says about itself -------------------------------------------------

  // A page has no date at all, so it is never scheduled — `isScheduled` says so on its own.
  const scheduled = (): boolean => isScheduled(draft.status, draft.date)

  function sayState(): void {
    sheetBar.setStatus(
      saveStatusLine(t, saving, savedAt, dirty, safety.keptAt, formatTime, safety.sentAt),
      saving,
    )
    sheetBar.setDirty(dirty)
    sheetBar.setState(draft.status === 'published', scheduled())
    const live = draft.status === 'published' && slug !== '' && !scheduled()
    sheetBar.setLive(live ? LIVE_PATH[kind](slug) : null)
    sheetBar.setPreviewable(kind === 'post' && slug !== '')
    if (trashBlock) trashBlock.hidden = slug === ''
    if (past) past.hidden = slug === ''
    if (stats) {
      stats.hidden = !live
      if (live) stats.href = `/admin/analytics?path=${encodeURIComponent(`/${slug}`)}`
    }
    if (dateNote) {
      dateNote.textContent = scheduled()
        ? `${t.scheduledForPrefix} ${formatWallClock(draft.date, lang)}`
        : ''
      dateNote.hidden = !scheduled()
    }
    // The line under the title: what this is, what state it is in, when it was last touched.
    // It is REWRITTEN rather than left as drawn, because a Publish that left it reading "Draft"
    // is the screen disagreeing with itself about the thing the writer just did.
    if (metaLine) {
      const state = scheduled()
        ? t.scheduled
        : draft.status === 'published' ? t.statusPublished : t.statusDraft
      const head = kind === 'post' ? state : `${kind === 'page' ? t.kindPage : t.kindNote} · ${state}`
      metaLine.textContent = [head, savedAt ? formatDateTimeShort(savedAt) : touchedAt]
        .filter(Boolean).join(' · ')
    }
  }

  /**
   * ⚠️ TYPING ONLY FLIPS A FLAG. This runs on every keystroke in the body, and `sayState` writes
   * about a dozen places on the sheet — a status line, two keys' disabled state, the live link,
   * Preview, the scheduled note, the meta line. None of them changes because a letter was typed,
   * and the whole reason the editor stopped serializing on a debounce was that work per
   * keystroke lands in the pause between two sentences.
   */
  function markDirty(): void {
    if (dirty) return
    dirty = true
    sayState()
  }

  /** One change to the draft, from any field. The slug follows the title until it is typed. */
  function edit(patch: Partial<SheetDraft>): void {
    Object.assign(draft, patch)
    if ('slug' in patch) slugTyped = true
    if ('title' in patch && !slugTyped) {
      draft.slug = slugify(patch.title ?? '')
      if (slugBox) slugBox.value = draft.slug
    }
    markDirty()
    // A FIELD changed, so the sheet may have to say something different: the Publish key's word,
    // the scheduled line, the live link. The body changing says nothing new, which is the whole
    // point of the split above.
    sayState()
  }

  // ---- the panel, its fields, and the safety net ----------------------------------------

  const panel = wirePanel(root, () => { asking = false; sheetBar.setAttrs(false) })
  const fields = wireFields(root, t, lang, draft, edit)

  /**
   * ⚠️ THE BAR IS BUILT BEFORE THE SAFETY NET, and the order is load-bearing rather than
   * tidy: `wireSafety` reports whatever snapshot it finds the moment it is wired, and the
   * report goes to this bar.
   */
  const sheetBar = wireBar(root, {
    t,
    getText: () => `${draft.title} ${body()}`,
    onSaveDraft: () => void saveAs('draft', t.savedDraft),
    onPublish: () => {
      // THE FIRST PUBLISH OPENS THE ATTRIBUTES instead of publishing: they are the publish-time
      // questions — the slug, the date, the terms, both pictures — and they all already carry
      // an answer (ADR 0024, step 5).
      if (draft.status !== 'published' && !asking) {
        asking = true
        panel.show(true)
        sheetBar.setAttrs(true)
        return
      }
      void saveAs('published', scheduled() ? t.scheduled : t.published)
    },
    onPreview: () => void openPreview(t, () => (dirty ? enqueue() : Promise.resolve(true)), () => slug),
    onToggleMd: () => { paper.toggleRaw(); sheetBar.setMd(paper.raw) },
    onToggleAttrs: () => { panel.toggle(); sheetBar.setAttrs(panel.open) },
    onRestore: () => void restoreSnapshot(),
    onDiscard: () => safety.dismiss(),
  })

  const safety = wireSafety({
    kind,
    slug,
    serverAt: data.autosaveAt,
    rowSavedAt: data.rowSavedAt,
    dirty: () => dirty,
    take: (): Snapshot => ({ ...draft, content: body() }),
    intervalMs: data.autosaveSeconds * 1000,
    onOffer: (offer) => sheetBar.setOffer(offer),
    onKept: () => sayState(),
  })

  // `timeMachine`, not `history`: the other `history` on this page is the browser's, and the
  // save below calls it.
  const timeMachine = wireHistory(root, {
    t,
    slug: () => slug,
    onRestore: (rev: PostRevision) => loadRevision(rev),
  })

  // ---- saving ---------------------------------------------------------------------------

  /** What the write column's row shows of this piece. A save that changes it redraws it. */
  let listed = JSON.stringify([slug, draft.title, draft.status, draft.excerpt])

  let chain: Promise<unknown> = Promise.resolve()

  async function persist(status?: SheetDraft['status']): Promise<boolean> {
    const text = body()
    if (!worthSaving(kind, draft, text)) return false
    saving = true
    sayState()
    try {
      const res = await savePiece(kind, slug, payloadOf(kind, draft, text, timezone, status))
      if (!res.ok) {
        // The one refusal worth its own word: two pieces cannot share an address, and "could
        // not save" sends somebody looking for a network fault.
        say(res.reason === 'slug_taken' ? t.slugTaken : t.saveFailed, 'error')
        return false
      }
      slug = res.slug
      safety.retarget(res.slug)
      savedAt = new Date().toISOString()
      slugTyped = true
      // ⚠️ ONLY IF NOTHING MOVED WHILE THE REQUEST WAS IN THE AIR. `text` was read before the
      // fetch, so marking the sheet clean over a sentence typed during it turned off the exit
      // warning and dropped both recovery copies for exactly that sentence.
      if (body() === text) {
        dirty = false
        safety.clear()
      }
      // THE ADDRESS BAR IS SYNCED AND THE PAGE IS NOT RELOADED. A reload would cost the caret,
      // the selection and the whole undo stack on the click that saved the work.
      window.history.replaceState(null, '', `${SHEET_PATH[kind]}/${encodeURIComponent(res.slug)}`)
      const now = JSON.stringify([slug, draft.title, status ?? draft.status, draft.excerpt])
      if (now !== listed) { listed = now; void redrawColumn() }
      return true
    } catch {
      say(t.saveFailed, 'error')
      return false
    } finally {
      saving = false
      sayState()
    }
  }

  /** Queue a save behind any in-flight save and hand back its answer. */
  function enqueue(status?: SheetDraft['status']): Promise<boolean> {
    const run = (): Promise<boolean> => persist(status)
    const result = chain.then(run, run)
    chain = result.catch(() => {})
    return result
  }

  async function saveAs(status: SheetDraft['status'], done: string): Promise<boolean> {
    if (status === 'published' && !nameEnough(kind, draft)) {
      say(t.needTitle, 'error')
      return false
    }
    // The STATUS FOLLOWS THE SAVE. Set first, a refused save left the sheet saying Published
    // for a piece the server still had as a draft.
    if (!(await enqueue(status))) return false
    draft.status = status
    sayState()
    say(done)
    return true
  }

  at('[data-panel-publish]')?.addEventListener('click', () => {
    // ⚠️ THE PANEL STAYS OPEN ON A REFUSAL. Closing it regardless would take the writer away
    // from the one screen carrying the field that was refused — a taken slug is answered here.
    void saveAs('published', scheduled() ? t.scheduled : t.published).then((went) => {
      if (!went) return
      asking = false
      panel.hide()
    })
  })
  at('[data-sheet-history]')?.addEventListener('click', () => timeMachine.open())
  const trashKey = at<HTMLButtonElement>('[data-sheet-trash]')
  trashKey?.addEventListener('click', () => {
    trashKey.disabled = true
    void moveToTrash(t, kind, slug, () => { dirty = false; safety.clear() })
      .then(() => { trashKey.disabled = false })
  })

  // ---- the title, which is part of the writing rather than of the form --------------------

  titleBox?.addEventListener('input', () => edit({ title: titleBox.value }))

  // ---- pictures ---------------------------------------------------------------------------

  /**
   * ASK FOR A PICTURE, then do with it whatever this control was for. One function, because the
   * ask is the same every time and only the answer's destination differs.
   */
  async function choose(what: 'editor' | 'gallery'): Promise<void> {
    const got = await askForPicture(t, what === 'gallery')
    if (!got) return
    if ('urls' in got) paper.insertGalleryMany(got.urls)
    else paper.insertImage(got.url, got.alt)
  }

  // ---- putting work back -------------------------------------------------------------------

  /** A whole draft back into the sheet: every field, the body, and the title above it. */
  function load(next: SheetDraft, text: string): void {
    Object.assign(draft, next)
    fields.apply(draft)
    if (titleBox) titleBox.value = draft.title
    if (slugBox) slugBox.value = draft.slug
    paper.setMarkdown(text)
    content = text
    dirty = true
    sayState()
    sheetBar.setMd(paper.raw)
  }

  async function restoreSnapshot(): Promise<void> {
    const snap = await safety.restore()
    if (!snap) return
    // ⚠️ THE SLUG AND THE DATE STAY on a piece that has a row. A snapshot is the writer's WORDS,
    // saved without being asked for; it is not the piece's identity, and restoring one taken
    // before a rename would rename a published post as the price of getting a paragraph back.
    const kept = withLiveIdentity(snap, { ...draft, content: body() }, slug !== '')
    load(kept, kept.content)
    say(t.revisionLoaded)
  }

  /** An overwritten version back into the editor. The slug and the date stay current. */
  function loadRevision(rev: PostRevision): void {
    load({
      ...draft,
      title: rev.title,
      excerpt: rev.excerpt ?? '',
      featuredImage: rev.featuredImage ?? '',
      categories: rev.categories,
      tags: rev.tags,
      status: rev.status,
    }, rev.content)
    say(t.revisionLoaded)
  }

  // ---- and the first paint -----------------------------------------------------------------

  sayState()
  sheetBar.setMd(paper.raw)
  /**
   * A piece REOPENED from its own snapshot has no offer to make: the work is already on screen.
   * Saying so once is the honest report — the alternative was an editor that opened with the
   * words in it AND a strip underneath offering to put them there.
   */
  if (reopened) {
    safety.dismiss()
    say(t.draftRestored)
  }
}
