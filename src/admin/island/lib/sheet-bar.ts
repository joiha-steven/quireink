// THE ACTION LINE, wired.
//
// Every state of this bar is already drawn (`screens/sheet-actions.ts`): the recovered-work
// strip, the live link, Preview, the word count. Nothing here builds a control — it writes
// text, flips `hidden`, and owns the four chords that belong to the SHEET rather than to the
// selection.
//
// ⚠️ `Mod-s` IS THE ONE THAT MATTERED. The editor's autosave writes a snapshot and never the
// piece — deliberately, so editing a published post cannot push half a sentence live. A writer
// whose hands pressed Cmd+S therefore got the browser's "Save page as…" dialog and a reasonable
// belief that the work was saved. `preventDefault` takes the key back; saving a draft is what
// it should always have done.
//
// ⚠️ AND A HELD KEY REPEATS. Every one of these chords is a command, not a character: holding
// the save chord for a second fired a save a frame, which is one PUT and one toast per repeat,
// and holding the focus chord flickered the chrome in and out.
import type { SheetWords } from '@/admin-shared/sheet-wire'
import type { Offer } from '@/admin-shared/draft-keep'
import { countWords, readMinutes } from '@/admin-shared/word-count'
import { plural } from '@/i18n/plural'
import type { SiteLang } from '@/types'
import { formatTime } from '@/admin-shared/when'
import { matchesChord, printChord, SHORTCUTS } from '@/admin/components/editorKeys'
import { focusOn, onFocusChange, setFocus } from './focus-mode'

/** Four seconds is the same number to a human, and it is not a re-count per keystroke. */
const COUNT_EVERY = 4000

export type BarHooks = {
  t: SheetWords
  /** For the count's plural: "1 word", and the three Russian forms. */
  lang: SiteLang
  /** The title and the body, for the word count. Read on the tick, never held. */
  getText: () => string
  onSaveDraft: () => void
  onPublish: () => void
  onPreview: () => void
  onToggleMd: () => void
  onToggleAttrs: () => void
  onRestore: () => void
  onDiscard: () => void
}

export type Bar = {
  /** The assembled save line (`draft-keep.ts`), and whether a save is in flight. */
  setStatus: (line: string, saving: boolean) => void
  setDirty: (dirty: boolean) => void
  /** Published, and whether its date is still ahead: the Publish key's two words. */
  setState: (published: boolean, scheduled: boolean) => void
  /** Where the piece can be read as a reader sees it, or null while there is nothing to read. */
  setLive: (href: string | null) => void
  /** A piece with a row can be previewed; one that has never been saved cannot. */
  setPreviewable: (yes: boolean) => void
  setMd: (on: boolean) => void
  setAttrs: (open: boolean) => void
  setOffer: (offer: Offer) => void
  destroy: () => void
}

/** Every control that answers to one hook, because two of each are drawn: phone and desktop. */
const all = (root: HTMLElement, hook: string): HTMLElement[] =>
  [...root.querySelectorAll<HTMLElement>(`[${hook}]`)]

export function wireBar(root: HTMLElement, hooks: BarHooks): Bar {
  const { t, lang } = hooks
  const one = (hook: string): HTMLElement | null => root.querySelector<HTMLElement>(`[${hook}]`)

  const dot = one('data-say-dot')
  const status = one('data-say-status')
  const size = one('data-say-size')
  const found = one('data-sheet-found')
  const sayFound = one('data-say-found')
  const save = one('data-sheet-save') as HTMLButtonElement | null
  const publish = one('data-sheet-publish') as HTMLButtonElement | null
  const previewWrap = one('data-sheet-preview-wrap')
  const liveWrap = one('data-sheet-live-wrap')

  let dirty = false
  let saving = false
  let published = false
  let statusLine = ''
  let words = 0

  /**
   * THE CHORDS, SPELLED FOR THIS MACHINE. The server cannot print them: it has no platform to
   * ask, and `Ctrl` shown to somebody on a Mac makes the whole table useless to them. Each
   * control carries the shortcut's id and this writes the spelling.
   */
  for (const key of all(root, 'data-chord-for')) {
    const id = key.dataset.chordFor ?? ''
    const chord = SHORTCUTS.find((s) => s.id === id)?.chord
    if (!chord || !key.title) continue
    key.title = `${key.title} (${printChord(chord)})`
  }

  /** The small print: state, size, time to read. One string, and the dot only with it. */
  const sayLine = (): void => {
    if (status) status.textContent = statusLine
    if (dot) dot.hidden = statusLine === ''
    if (!size) return
    // Written whole rather than hidden: the class on this span is `hidden sm:inline`, so a
    // `hidden` attribute on it would be answering a question the breakpoint already answers.
    size.textContent = words > 0
      ? `${statusLine ? ' · ' : ''}${plural(t.edWords, words, lang)}`
        + ` · ${t.edReadMinutes.replace('{n}', String(readMinutes(words)))}`
      : ''
  }

  const sayKeys = (): void => {
    if (save) save.disabled = saving || !dirty
    if (publish) publish.disabled = saving || (!dirty && published)
  }

  // ---- the controls -------------------------------------------------------------------

  for (const key of all(root, 'data-sheet-md')) key.addEventListener('click', hooks.onToggleMd)
  for (const key of all(root, 'data-sheet-attrs')) key.addEventListener('click', hooks.onToggleAttrs)
  for (const key of all(root, 'data-sheet-focus')) {
    key.addEventListener('click', () => setFocus(!focusOn()))
  }
  for (const key of all(root, 'data-sheet-preview')) key.addEventListener('click', hooks.onPreview)
  save?.addEventListener('click', hooks.onSaveDraft)
  publish?.addEventListener('click', hooks.onPublish)
  one('data-sheet-restore')?.addEventListener('click', hooks.onRestore)
  one('data-sheet-discard')?.addEventListener('click', hooks.onDiscard)

  const onKey = (e: KeyboardEvent): void => {
    if (e.repeat) return
    const hit = SHORTCUTS.find((s) => matchesChord(e, s.chord))
    if (!hit) return
    // `find` and `replace` are in the same table and belong to the strip, which listens for
    // them itself (`sheet-find.ts`). Matching no branch here is correct.
    if (hit.id === 'focus') { e.preventDefault(); setFocus(!focusOn()) }
    else if (hit.id === 'save') { e.preventDefault(); hooks.onSaveDraft() }
    else if (hit.id === 'markdown') { e.preventDefault(); hooks.onToggleMd() }
    else if (hit.id === 'attributes') { e.preventDefault(); hooks.onToggleAttrs() }
  }
  window.addEventListener('keydown', onKey)

  /**
   * The count is POLLED, and that is deliberate: it is read off the document, which means
   * serializing it, and nobody reads a word count mid-word. A number that is at most four
   * seconds stale is the same number to a human.
   */
  const counting = setInterval(() => {
    const next = countWords(hooks.getText())
    if (next === words) return
    words = next
    sayLine()
  }, COUNT_EVERY)
  words = countWords(hooks.getText())
  sayLine()
  sayKeys()

  const pressed = (hook: string, on: boolean): void => {
    for (const key of all(root, hook)) key.setAttribute('aria-pressed', String(on))
  }

  // Focus mode is a fact in storage that the write column beside this reads too, so the switch
  // shows what the STORAGE says rather than what this bar last did to it.
  const sayFocus = (): void => pressed('data-sheet-focus', focusOn())
  const stopFocus = onFocusChange(sayFocus)
  sayFocus()

  return {
    setStatus: (line, inFlight) => { statusLine = line; saving = inFlight; sayLine(); sayKeys() },
    setDirty: (next) => { dirty = next; sayKeys() },
    setState: (isPublished, scheduled) => {
      published = isPublished
      if (publish) {
        const say = scheduled ? publish.dataset.saySchedule : publish.dataset.sayPublish
        publish.textContent = say ?? publish.textContent
      }
      sayKeys()
    },
    setLive: (href) => {
      for (const link of all(root, 'data-sheet-live')) {
        if (href) (link as HTMLAnchorElement).href = href
        // The phone's menu item is a link of its own, outside the desktop wrapper.
        if (!link.closest('[data-sheet-live-wrap]')) link.hidden = !href
      }
      if (liveWrap) liveWrap.hidden = !href
    },
    setPreviewable: (yes) => {
      for (const key of all(root, 'data-sheet-preview')) {
        if (!key.closest('[data-sheet-preview-wrap]')) key.hidden = !yes
      }
      if (previewWrap) previewWrap.hidden = !yes
    },
    setMd: (on) => pressed('data-sheet-md', on),
    setAttrs: (open) => {
      for (const key of all(root, 'data-sheet-attrs')) {
        const say = open ? key.dataset.sayShut : key.dataset.sayOpen
        if (say) key.textContent = say
      }
    },
    setOffer: (offer) => {
      if (found) found.hidden = offer === null
      if (offer && sayFound) {
        const what = offer.from === 'server' ? t.serverDraftFound : t.localDraftFound
        sayFound.textContent = `${what} · ${formatTime(new Date(offer.at).toISOString())}`
      }
    },
    destroy: () => {
      clearInterval(counting)
      window.removeEventListener('keydown', onKey)
      stopFocus()
    },
  }
}
