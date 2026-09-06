// Minimal toast system: a provider + useToast() hook.
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type ToastKind = 'success' | 'error'
/**
 * A toast may carry ONE action, and it exists for exactly one thing: undo.
 *
 * Trashing a post no longer asks first (2026-09-07). A question before a REVERSIBLE act is
 * a toll on the ninety-nine times somebody meant it, paid to save the one time they did not
 * — and it does not even save that one, because a dialog answered by reflex is not read. The
 * honest trade is to act at once and put the way back where the eye already is.
 */
type ToastAction = { label: string; run: () => void }
type ToastItem = { id: number; message: string; kind: ToastKind; action?: ToastAction }

type ToastContextValue = {
  notify: (message: string, kind?: ToastKind, action?: ToastAction) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const notify = useCallback((message: string, kind: ToastKind = 'success', action?: ToastAction) => {
    const id = Date.now() + Math.random()
    setItems((prev) => [...prev, { id, message, kind, action }])
    // A toast with something to press waits LONGER, because three seconds is not enough time
    // to notice a sentence, read it, decide it was a mistake and reach the word.
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), action ? 6000 : 3000)
  }, [])

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {items.map((t) => (
          // An announced region, because a toast is the ONLY confirmation the admin gives
          // that a save worked: without this every save and every upload was silent to a
          // screen reader. `alert` for a failure, so it interrupts; `status` for a success,
          // so it waits for a pause in whatever is being read.
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className="admin-toast flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-900 shadow-lg dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          >
            {/* ONE neutral sheet, told apart by a pilot lamp AND a glyph. The two kinds were
                inverted black and white — a difference that vanished for anyone who did not
                already know which way round it was. The lamp wears the hues the version dot
                established: green is good and done, amber is something that needs you. The
                glyph stays because a dot alone asks colour to carry the whole message. */}
            <span
              aria-hidden="true"
              className={`h-2 w-2 shrink-0 rounded-full ${t.kind === 'error' ? 'bg-amber-500' : 'bg-emerald-600 dark:bg-emerald-500'}`}
            />
            <span aria-hidden="true">{t.kind === 'error' ? '!' : '✓'}</span>
            {t.message}
            {t.action && (
              <button
                type="button"
                onClick={() => { t.action?.run(); setItems((prev) => prev.filter((x) => x.id !== t.id)) }}
                className="ml-1 shrink-0 font-semibold underline underline-offset-2 hover:no-underline"
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
