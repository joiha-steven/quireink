// The admin's only running commentary: what just happened, in the corner, for a few seconds.
//
// It was three lines of state and a `setTimeout`, and every one of the things below was
// missing on 2026-09-07:
//
//   · A FAILURE LEFT AT THE SAME SPEED AS A SUCCESS. Three seconds is enough for "Saved" and
//     nowhere near enough for a sentence naming what went wrong — which is the one message a
//     person has to finish reading, and the one they were least likely to be looking at.
//     A failure now stays until it is dismissed.
//   · NOTHING COULD DISMISS ONE. No close button, so a stack of them sat over the corner of
//     the screen until they aged out.
//   · THE CLOCK RAN WHILE YOU READ. Pointing at a toast — which is what you do when you are
//     reading it, or reaching for the undo inside it — did not stop it from leaving.
//   · THEY STACKED WITHOUT LIMIT. Ten uploads printed ten toasts up the side of the window.
//     Three at a time now, oldest first out.
//   · THEY VANISHED. Arriving on the `@starting-style` curve and then disappearing on a frame
//     reads as a glitch rather than as an exit.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { motionOn } from '@/admin/motion'
import { useAdminT } from '@/admin/components/I18nProvider'

type ToastKind = 'success' | 'error'

/**
 * A toast may carry ONE action, and it exists for exactly one thing: undo.
 *
 * Trashing a post no longer asks first (2026-09-07). A question before a REVERSIBLE act is a
 * toll on the ninety-nine times somebody meant it, paid to save the one time they did not —
 * and it does not even save that one, because a dialog answered by reflex is not read. The
 * honest trade is to act at once and put the way back where the eye already is.
 */
type ToastAction = { label: string; run: () => void }
type ToastItem = { id: number; message: string; kind: ToastKind; action?: ToastAction; leaving?: boolean }

type ToastContextValue = {
  notify: (message: string, kind?: ToastKind, action?: ToastAction) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

/**
 * How long each kind stays, and the numbers are the argument.
 *
 * A success is a receipt: it confirms what the hand just did, and the eye has already moved
 * on. An action needs long enough to notice a sentence, read it, decide it was a mistake and
 * reach the word — six seconds is a slow count of six, not a guess. A failure has no timer at
 * all, because the only person who can decide it has been read is the one reading it.
 */
const LIFE = { plain: 3200, action: 6000 } as const
/** Long enough for the exit to finish, short enough that it is never noticed as a delay. */
const EXIT_MS = 150
/** Three. A fourth pushes the first off the top rather than growing the stack up the window. */
const MAX = 3

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  /**
   * THE ANNOUNCEMENT IS NOT THE TOAST.
   *
   * A live region has to be in the document BEFORE the text lands in it: a screen reader
   * watches regions it already knows about, and one that arrives carrying its message is a
   * new element, not a change to an old one. Every toast was created with its own
   * `role=status` and its own words at the same instant, so the save it confirmed was
   * announced only by luck. These two regions are mounted for the life of the admin and
   * empty until there is something to say; the visible toast is then only a picture of it.
   */
  const [said, setSaid] = useState<{ polite: string; urgent: string }>({ polite: '', urgent: '' })
  // The pending departures, so a hover can cancel one and a leave can restart it. Keyed by
  // id: a Map rather than a field on the item, because a timer is not state — re-rendering
  // because a countdown exists would re-run every effect in the tree three times a save.
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const drop = useCallback((id: number) => {
    clearTimeout(timers.current.get(id))
    timers.current.delete(id)
    // Marked LEAVING first, then removed a frame later: the CSS transition needs the element
    // to still exist to animate out of. With motion off there is nothing to wait for.
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)))
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), motionOn() ? EXIT_MS : 0)
  }, [])

  const arm = useCallback((id: number, ms: number) => {
    clearTimeout(timers.current.get(id))
    timers.current.set(id, setTimeout(() => drop(id), ms))
  }, [drop])

  const notify = useCallback((message: string, kind: ToastKind = 'success', action?: ToastAction) => {
    const id = Date.now() + Math.random()
    setItems((prev) => {
      const next = [...prev, { id, message, kind, action }]
      // Over the cap, the OLDEST goes — it has been read, or it never will be.
      for (const gone of next.slice(0, Math.max(0, next.length - MAX))) {
        clearTimeout(timers.current.get(gone.id))
        timers.current.delete(gone.id)
      }
      return next.slice(-MAX)
    })
    setSaid((was) => (kind === 'error' ? { ...was, urgent: message } : { ...was, polite: message }))
    // ⚠️ A FAILURE IS NEVER ARMED. It leaves when somebody closes it, and not before.
    if (kind !== 'error') arm(id, action ? LIFE.action : LIFE.plain)
  }, [arm])

  useEffect(() => {
    const pending = timers.current
    return () => { for (const timer of pending.values()) clearTimeout(timer) }
  }, [])

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div role="status" aria-live="polite" className="sr-only">{said.polite}</div>
      <div role="alert" aria-live="assertive" className="sr-only">{said.urgent}</div>
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {items.map((t) => (
          <Toast key={t.id} item={t} onClose={() => drop(t.id)} onHold={() => {
            clearTimeout(timers.current.get(t.id))
            timers.current.delete(t.id)
          }} onRelease={() => {
            if (t.kind !== 'error' && !t.leaving) arm(t.id, t.action ? LIFE.action : LIFE.plain)
          }} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function Toast({ item, onClose, onHold, onRelease }: {
  item: ToastItem
  onClose: () => void
  onHold: () => void
  onRelease: () => void
}) {
  const t = useAdminT()
  return (
    // No role: the words were already read out of the standing live regions in the provider,
    // and a second announcement from the picture of them would say everything twice.
    <div
      // Pointing at a toast is what you do while reading it, or while reaching for the undo
      // inside it. Either way the clock has no business running.
      onPointerEnter={onHold}
      onPointerLeave={onRelease}
      onFocusCapture={onHold}
      onBlurCapture={onRelease}
      data-leaving={item.leaving ? '' : undefined}
      className="admin-toast flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-900 shadow-lg dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
    >
      {/* ONE neutral sheet, told apart by a pilot lamp AND a glyph. The two kinds were
          inverted black and white — a difference that vanished for anyone who did not
          already know which way round it was. The lamp wears the hues the version dot
          established: green is good and done, amber is something that needs you. The glyph
          stays because a dot alone asks colour to carry the whole message. */}
      <span
        aria-hidden="true"
        className={`h-2 w-2 shrink-0 rounded-full ${item.kind === 'error' ? 'bg-amber-500' : 'bg-emerald-600 dark:bg-emerald-500'}`}
      />
      <span aria-hidden="true">{item.kind === 'error' ? '!' : '✓'}</span>
      {item.message}
      {item.action && (
        <button
          type="button"
          onClick={() => { item.action?.run(); onClose() }}
          className="ml-1 shrink-0 font-semibold underline underline-offset-2 hover:no-underline"
        >
          {item.action.label}
        </button>
      )}
      <button
        type="button"
        onClick={onClose}
        aria-label={t.close}
        className="-mr-1.5 ml-1 shrink-0 rounded px-1 text-neutral-400 transition hover:text-neutral-900 dark:hover:text-neutral-100"
      >
        ✕
      </button>
    </div>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
