// The sheet's top line: where you came from, whether the work is saved, how much of it
// there is — and the two buttons that end a writing session (the Writing Desk mock's
// `sheettop`, 2026-08-17).
//
// Split out of `PostForm` when it passed its 400-line cap. The seam is deliberate: this is
// the only chrome on a screen that is otherwise a sheet of paper, and the decision it
// carries — that the FIRST publish opens the attributes rather than publishing — belongs
// next to the button that makes it (ADR 0024, step 5).
//
// It is a LINE, not a card: the old version was a rounded, bordered, shadowed bar, which
// made the one piece of chrome on the page the most decorated thing on it. The mock draws
// a flat row over a hairline. Quiet text controls on the left with the status; the two
// bordered/solid buttons that END the session on the right, and nothing else raised.
import { useEffect, useState, type RefObject } from 'react'
import Link from '@/admin/router'
import { Button } from '@/admin/ui/Button'
import { useAdminT } from './I18nProvider'

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
  onPreview: () => void
  onSaveDraft: () => void
  onPublish: () => void
  publishLabel: string
  published: boolean
}) {
  const t = useAdminT()
  const { words, minutes } = useWordStats(getText)
  return (
    <div
      ref={barRef}
      className="z-20 mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200/70 bg-neutral-50/95 px-1 py-2.5 backdrop-blur-xl lg:sticky lg:top-0 dark:border-neutral-800 dark:bg-neutral-950/95"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <Link href="/admin/content" className={QUIET}>← {t.navWrite}</Link>
        <span className="hidden h-4 w-px bg-neutral-200 sm:block dark:bg-neutral-800" />
        {/* The mock's saved line: state · size · time to read. One string of small print. */}
        <span className="text-xs text-neutral-400 dark:text-neutral-500">
          {/* Joined, not concatenated: on a fresh load the save status is empty, and a line
              that begins with a separator reads as a missing word. */}
          {status}
          {words > 0 && (
            <span className="hidden sm:inline">
              {status ? ' · ' : ''}{t.edWords.replace('{n}', String(words))}
              {' · '}{t.edReadMinutes.replace('{n}', String(minutes))}
            </span>
          )}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        {/* Quiet, and BEFORE the session-ending pair: it changes what you look AT, not what
            happens to the piece. (The MD toggle lives in the toolbar, where the owner put it.) */}
        <button type="button" onClick={onToggleSettings} className={QUIET}>
          {settingsOpen ? t.hideAttributes : t.attributes}
        </button>
        {savedSlug && (
          <Button variant="secondary" type="button" onClick={onPreview}>
            {t.previewDraft}
          </Button>
        )}
        <Button variant="secondary" onClick={onSaveDraft} disabled={saving || !dirty}>
          {t.saveDraft}
        </Button>
        <Button onClick={onPublish} disabled={saving || (!dirty && published)}>
          {publishLabel}
        </Button>
      </div>
    </div>
  )
}
