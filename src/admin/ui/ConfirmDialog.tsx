// The admin's own way of asking before something is lost, and the replacement for
// `window.confirm`.
//
// Twenty native prompts were counted in `src/admin` on 2026-09-07 — sixteen `confirm()` and
// four `prompt()` — and every one of them cost the same three things. The browser draws them,
// so a dialog that decides whether a post is destroyed forever wears none of this product's
// grammar. They name nothing: `confirm()` takes one string, so "Delete this?" is the whole
// question, with the title of the thing being deleted left to the row the pointer was over.
// And they BLOCK the main thread, which in a React tree means the page behind them is frozen
// mid-render for as long as the reader thinks about it.
//
// The shape is an ASK, not a component: `const ask = useConfirm()` and then
// `if (!await ask({ ... })) return`. That is deliberately the same shape as the call it
// replaces, so a screen swapping one for the other changes one line and keeps its control
// flow. A declarative `<ConfirmDialog open={...}>` would have made each of those twenty sites
// invent a piece of state, and a hook that hands back a promise is the only way to keep the
// answer where the question was asked.
//
// It carries a THIRD answer as well as yes and no, because leaving a screen with unsaved work
// is a three-way question — save, discard, stay — and a two-button dialog answers it by
// throwing one of the three away.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { Button } from './Button'
import { OVERLAY } from '@/admin/components/sheet'
import { SECTION } from '@/admin/components/scale'

/** What the reader chose. `alt` is the third button, and it is absent unless one was asked for. */
export type ConfirmAnswer = 'confirm' | 'alt' | 'cancel'

export type ConfirmRequest = {
  /** Names the OBJECT, not the action: "Delete 'Notes on a printing glossary' forever?" */
  title: string
  /** What happens, in one sentence. Rendered under the title; optional but almost always wanted. */
  body?: ReactNode
  /** The label on the button that answers yes. */
  confirmLabel: string
  /** The label on the button that backs out. */
  cancelLabel: string
  /** A third answer, between the two — "Save" beside "Discard" and "Stay". */
  altLabel?: string
  /** Whether the yes button is the red ballpoint. True whenever the answer destroys something. */
  danger?: boolean
}

type Ask = (req: ConfirmRequest) => Promise<ConfirmAnswer>

const ConfirmContext = createContext<Ask | null>(null)

type Pending = { req: ConfirmRequest; settle: (a: ConfirmAnswer) => void }

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null)

  const ask = useCallback<Ask>(
    (req) =>
      new Promise<ConfirmAnswer>((settle) => {
        setPending((prev) => {
          // A second question while one is open answers the first with "no" rather than
          // dropping its promise on the floor. An abandoned promise never settles, and the
          // caller sitting on `await` never runs its `finally`.
          if (prev) prev.settle('cancel')
          return { req, settle }
        })
      }),
    [],
  )

  const answer = useCallback((a: ConfirmAnswer) => {
    setPending((prev) => {
      if (prev) prev.settle(a)
      return null
    })
  }, [])

  useEffect(() => {
    if (!pending) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); answer('cancel') }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [pending, answer])

  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      {pending && (
        <>
          {/* A click off the sheet is "not now" — the same reading `SlideOver` gives it. */}
          <button
            type="button"
            aria-label={pending.req.cancelLabel}
            onClick={() => answer('cancel')}
            className="fixed inset-0 z-50 bg-black/25"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={pending.req.title}
            // `role='dialog'` is what admin.css's @starting-style keys the entrance off, so
            // this arrives on the same curve as the palette and the slide-over rather than
            // appearing. Centred and capped, not stretched: a question is short.
            className={`fixed left-1/2 top-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 p-5 ${OVERLAY}`}
          >
            <h2 className={SECTION}>{pending.req.title}</h2>
            {pending.req.body && (
              <div className="mt-2 text-sm leading-[1.55] text-neutral-600 dark:text-neutral-400">
                {pending.req.body}
              </div>
            )}
            {/* The safe answer is on the LEFT and the committing one on the right, which is the
                order every other footer in this admin uses. `flex-wrap` so three buttons in a
                long language stack rather than overflow the sheet. */}
            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              {/* Focus opens on the SAFE answer, never on the destructive one: a dialog that
                  opens with Delete focused turns a stray Return — the key somebody was already
                  pressing to submit the form behind it — into a deletion. */}
              <Button autoFocus variant="ghost" size="sm" onClick={() => answer('cancel')}>
                {pending.req.cancelLabel}
              </Button>
              {pending.req.altLabel && (
                <Button variant="secondary" size="sm" onClick={() => answer('alt')}>
                  {pending.req.altLabel}
                </Button>
              )}
              <Button
                variant={pending.req.danger ? 'danger' : 'primary'}
                size="sm"
                onClick={() => answer('confirm')}
              >
                {pending.req.confirmLabel}
              </Button>
            </div>
          </div>
        </>
      )}
    </ConfirmContext.Provider>
  )
}

/**
 * Ask, and await the answer.
 *
 * Returns the three-way answer. Most callers want the yes/no reading and can compare against
 * `'confirm'`; the ones offering a third button switch on all three.
 */
export function useConfirm(): Ask {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider')
  return ctx
}
