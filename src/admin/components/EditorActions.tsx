// The sheet's top line: where you came from, whether the work is saved, how much of it
// there is — and the two buttons that end a writing session (the Writing Desk mock's
// `sheettop`, 2026-08-17).
//
// Split out of `PostForm` when it passed its 400-line cap. The seam is deliberate: this is
// the only chrome on a screen that is otherwise a sheet of paper, and the decision it
// carries — that the FIRST publish opens the attributes rather than publishing — belongs
// next to the button that makes it (ADR 0024, step 5).
//
// It is the SHEET'S top row, not a floating band: the mock's sheettop sits inside the
// sheet, over a hairline, and the toolbar strip attaches directly under it. The floating
// version put two light bands a crack apart and the owner's word for it was "kì kì".
// Quiet text controls on the left with the status; the session-ending buttons right.
import { useEffect, useRef, useState, type RefObject } from 'react'
import Link from '@/admin/router'
import { Button } from '@/admin/ui/Button'
import { formatTime } from '@/utils'
import { useAdminT } from './I18nProvider'
import { useFocusMode } from './useFocusMode'
import { SHORTCUTS, matchesChord, tip } from './editorKeys'

/** Quiet text control, shared by everything on the bar that is not Preview/Publish. */
const QUIET =
  'px-2 py-1.5 text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'

// ~220 words a minute; the public reading-time line uses the same order of magnitude.
const WORDS_PER_MINUTE = 220

/**
 * Word count + reading time, polled every few seconds.
 *
 * Polled, because the form deliberately does NOT re-render on keystrokes (typing goes to
 * refs). A live-per-keystroke count would undo that for a number nobody reads mid-word;
 * a count that is at most four seconds stale is the same number to a human.
 */
function useWordStats(getText: () => string): { words: number; minutes: number } {
  const [words, setWords] = useState(() => countWords(getText()))
  useEffect(() => {
    const timer = setInterval(() => setWords(countWords(getText())), 4000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getText reads a ref; stable
  }, [])
  return { words, minutes: Math.max(1, Math.round(words / WORDS_PER_MINUTE)) }
}

function countWords(markdown: string): number {
  const text = markdown
    .replace(/```[\s\S]*?```/g, ' ') // fenced code counts as writing, not per token
    .replace(/[#>*_`~[\]()!-]/g, ' ')
  const matched = text.match(/\S+/g)
  return matched ? matched.length : 0
}

export function EditorActions({
  barRef,
  status,
  saving,
  dirty,
  settingsOpen,
  onToggleSettings,
  savedSlug,
  getText,
  recovered,
  mdView,
  onToggleMd,
  onPreview,
  onSaveDraft,
  onPublish,
  publishLabel,
  published,
}: {
  barRef: RefObject<HTMLDivElement | null>
  /** The "saved 12:04" / "unsaved" line, already assembled by `saveStatusLine`. */
  status: string
  saving: boolean
  dirty: boolean
  settingsOpen: boolean
  onToggleSettings: () => void
  savedSlug: string | null
  /** Live markdown, read from the form's ref — see useWordStats for why it is polled. */
  getText: () => string
  /** A newer local snapshot than the server's copy — shown as the bar's second line. */
  recovered?: { at: string; from: 'device' | 'server'; onRestore: () => void; onDiscard: () => void } | null
  mdView: boolean
  onToggleMd: () => void
  onPreview: () => void
  onSaveDraft: () => void
  onPublish: () => void
  publishLabel: string
  published: boolean
}) {
  const t = useAdminT()
  const { words, minutes } = useWordStats(getText)
  const [focus, setFocus] = useFocusMode()

  // The listener below is registered once, so it must not close over a stale flag.
  const focusRef = useRef(focus)
  useEffect(() => { focusRef.current = focus }, [focus])

  // The three chords that belong to the SHEET rather than to the selection, on the window
  // rather than on the editor: `Mod-s` has to work with the cursor in the title field too,
  // and `Mod-Shift-m` leaves the writing surface, which cannot be the thing listening.
  // The marks' own chords live in their extensions; the whole table is in `editorKeys.ts`.
  //
  // ⚠️ `Mod-s` IS THE ONE THAT MATTERED. The editor's autosave writes to localStorage and
  // NEVER to the server — deliberately, so editing a published post cannot push half a
  // sentence live. So a writer whose hands press Cmd+S got the browser's "Save page as…"
  // dialog and a reasonable belief that the work was saved. `preventDefault` takes the key
  // back from the browser; saving a draft is what it should always have done.
  const saveRef = useRef(onSaveDraft)
  const mdRef = useRef(onToggleMd)
  const attrRef = useRef(onToggleSettings)
  useEffect(() => {
    saveRef.current = onSaveDraft
    mdRef.current = onToggleMd
    attrRef.current = onToggleSettings
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const hit = SHORTCUTS.find((s) => matchesChord(e, s.chord))
      if (!hit) return
      if (hit.id === 'focus') { e.preventDefault(); setFocus(!focusRef.current) }
      else if (hit.id === 'save') { e.preventDefault(); saveRef.current() }
      else if (hit.id === 'markdown') { e.preventDefault(); mdRef.current() }
      else if (hit.id === 'attributes') { e.preventDefault(); attrRef.current() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setFocus])
  return (
    <div
      ref={barRef}
      className="z-20 rounded-t-[10px] border-b border-neutral-200/70 bg-white/95 backdrop-blur-xl lg:sticky lg:top-0 dark:border-neutral-800 dark:bg-neutral-900/95"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <Link href="/admin/content" className={QUIET}>← {t.navWrite}</Link>
        <span className="hidden h-4 w-px bg-neutral-200 sm:block dark:bg-neutral-800" />
        {/* The mock's saved line: state · size · time to read. One string of small print. */}
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          {/* Joined, not concatenated: on a fresh load the save status is empty, and a line
              that begins with a separator reads as a missing word. The dot before it is the
              mock's: the pen's edge, the small light that means "work in progress". */}
          {status && (
            <span aria-hidden className="mr-1.5 inline-block h-[5px] w-[5px] rounded-full bg-[var(--pen-edge)] align-middle" />
          )}
          {status}
          {words > 0 && (
            <span className="hidden sm:inline">
              {status ? ' · ' : ''}{t.edWords.replace('{n}', String(words))}
              {' · '}{t.edReadMinutes.replace('{n}', String(minutes))}
            </span>
          )}
        </span>
      </div>
      {/* flex-wrap, and it is load-bearing rather than tidy. The BAR wraps, so this group
          drops onto a line of its own on a narrow screen — and then sits there as one
          551px row inside a 390px phone, with Save draft and Publish off the right-hand
          edge and the whole admin scrolling sideways to reach them. Measured 2026-08-27:
          584px of scroll width on a 390px viewport, editing an existing post. justify-end
          keeps the pair that ENDS the session on the reading edge whether it wraps or not. */}
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {/* Quiet, and BEFORE the session-ending pair: these two change what you look AT,
            not what happens to the piece. Beside Attributes at the owner's instruction, and
            SPELLED OUT in the same voice — a bold mono "MD" next to a plain-text word read
            as a control from a different product, and the owner flagged the tonal drift.
            While it is on, the editor shows no toolbar. */}
        <button type="button" title={tip(t.tbMarkdown, 'markdown')} onClick={onToggleMd} aria-pressed={mdView} className={`${QUIET} ${mdView ? 'font-medium text-neutral-900 dark:text-white' : ''}`}>
          {t.tbMarkdown}
        </button>
        <button type="button" title={tip(t.attributes, 'attributes')} onClick={onToggleSettings} className={QUIET}>
          {settingsOpen ? t.hideAttributes : t.attributes}
        </button>
        {/* The third of the look-at-it group. It takes the button row and the write pane
            off the screen and leaves the paper; the bubble bar and "/" keep every command
            the row held. The shortcut is in the title because a switch nobody can find
            twice is a switch that gets used once. */}
        <button
          type="button"
          onClick={() => setFocus(!focus)}
          aria-pressed={focus}
          title={tip(t.edFocus, 'focus')}
          className={`${QUIET} ${focus ? 'font-medium text-neutral-900 dark:text-white' : ''}`}
        >
          {t.edFocus}
        </button>
        {savedSlug && (
          <Button variant="secondary" type="button" title={t.previewDraft} onClick={onPreview}>
            {t.previewDraft}
          </Button>
        )}
        <Button variant="secondary" title={tip(t.saveDraft, 'save')} onClick={onSaveDraft} disabled={saving || !dirty}>
          {t.saveDraft}
        </Button>
        <Button onClick={onPublish} disabled={saving || (!dirty && published)}>
          {publishLabel}
        </Button>
      </div>
      </div>
      {/* The recovered-work line, on a STRIP of its own under the controls. Folded into the
          control row it was a `basis-full` child of the left group, so the moment it
          appeared the one-row bar broke into three — the owner watched his buttons drop a
          line because a notice arrived. It stays inside this one sticky band (a banner above
          the sheet was already tried and rejected as a third piece of chrome), wears the
          amber that means "needs you" with the lamp dot beside it, and the two verbs stay
          text links — Restore darker, because it is the one that rescues somebody's words. */}
      {recovered && (
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 border-t border-amber-200/70 bg-amber-50/60 px-4 py-1.5 text-xs text-neutral-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-neutral-300">
          <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
          <span>
            {recovered.from === 'server' ? t.serverDraftFound : t.localDraftFound} · {formatTime(recovered.at)}
            {' · '}
            <button type="button" onClick={recovered.onRestore} className="font-medium text-neutral-900 underline underline-offset-2 hover:no-underline dark:text-white">
              {t.localDraftRestore}
            </button>
            {' · '}
            <button type="button" onClick={recovered.onDiscard} className="underline underline-offset-2 hover:text-neutral-900 hover:no-underline dark:hover:text-white">
              {t.localDraftDiscard}
            </button>
          </span>
        </div>
      )}
    </div>
  )
}
