// The right-hand sheet: a scrim, a fixed panel, a titled header, a footer for the
// buttons that end it (the Writing Desk mock's `pubsheet`).
//
// One component, because the post editor and the page editor both hang their attributes on
// it and the sheet chrome is exactly the kind of thing that drifts when each screen carries
// its own copy — see "One of each" in docs/admin-design.md.
import type { ReactNode } from 'react'

export function SlideOver({
  label,
  intro,
  headerRight,
  footer,
  onClose,
  children,
}: {
  label: string
  intro?: string
  headerRight?: ReactNode
  footer: ReactNode
  onClose: () => void
  children: ReactNode
}) {
  return (
    <>
      {/* A click anywhere off the sheet is "not now". */}
      <button type="button" aria-label={label} onClick={onClose} className="fixed inset-0 z-40 bg-black/20" />
      <aside
        role="dialog"
        aria-label={label}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-900"
      >
        <div className="border-b border-neutral-100 px-6 py-5 dark:border-neutral-800">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">{label}</h2>
            {headerRight && <div className="flex gap-3 text-xs">{headerRight}</div>}
          </div>
          {intro && <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">{intro}</p>}
        </div>
        <div className="scroll-fade min-h-0 flex-1 overflow-y-auto px-6 py-5 pb-8">{children}</div>
        <div className="flex items-center justify-end gap-2 border-t border-neutral-100 px-6 py-4 dark:border-neutral-800">
          {footer}
        </div>
      </aside>
    </>
  )
}
