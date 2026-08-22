// The first five minutes: shown once, then reachable forever from a link.
//
// The owner's shape, in his words: *"onboarding hiện lần đầu, rồi nó nằm ở dạng link ở đâu
// đó, mốt cần coi lại được"* — appears the first time, then lives as a link so it can be
// looked at again later. That second half is the part most onboarding gets wrong: a tour you
// can never re-open is a tour you have to remember, and the whole reason it exists is that
// nobody remembers.
//
// So dismissing writes ONE setting and the link stays on the dashboard permanently. Re-opening
// is local state and writes nothing: looking at the steps again is not un-finishing setup.
//
// The steps are LOCALIZED, and that is a departure from `HelpGuide`'s "content is English by
// design". The reference material stays canonical English; the first-run path does not,
// because an onboarding somebody cannot read is worse than no onboarding, and this owner runs
// the admin in Vietnamese. `HelpGuide` renders the same five from the same keys, so the two
// can never drift.

// The two buttons carry `data-first-run-*` for the tour. Finding them by their POSITION
// worked once and then stopped meaning anything the moment the card gained a paragraph;
// finding them by their WORDS breaks in five of the six languages. Same reason
// `NotFound.tsx` carries `data-admin-404`.
import { useState } from 'react'
import Link from '@/admin/router'
import { Card, TAP } from './kit'
import { useAdminT } from './I18nProvider'
import type { AdminStrings } from '@/locales/types'

/** Where each step goes. The words are in `t`; only the destinations live here. */
const HREFS = [
  '/admin/settings',
  '/admin/editor',
  '/admin/settings?tab=appearance',
  '/admin/settings?tab=connections',
  '/admin/newsletter',
] as const

/** The five, read out of the dictionary so every language gets the same path. */
export function firstRunSteps(t: AdminStrings): { href: string; label: string; body: string }[] {
  return HREFS.map((href, i) => ({
    href,
    label: t[`firstRun${i + 1}Label` as keyof AdminStrings] as string,
    body: t[`firstRun${i + 1}Body` as keyof AdminStrings] as string,
  }))
}

/** The list itself, so the dashboard card and the Help page render one thing. */
export function FirstRunSteps() {
  const t = useAdminT()
  return (
    <ol className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
      {firstRunSteps(t).map((s, i) => (
        <li key={s.href} className="flex gap-3">
          {/* `tabular-nums` on the counter: five numbers in a column that do not line up
              read as five unrelated things rather than one path. */}
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-neutral-300 text-xs font-medium tabular-nums text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
            {i + 1}
          </span>
          {/* A `div` and a `p`, not two spans. Two reasons and they agree: a paragraph is
              not phrasing content and may not sit inside a span, and the admin's reading
              face is applied to `p` — as a span the body rendered in the chrome font while
              the intro one line above it rendered in the reading one, in the same card. */}
          <div className="min-w-0">
            <Link href={s.href} className="text-sm font-medium text-neutral-900 underline-offset-2 hover:underline dark:text-neutral-100">
              {s.label}
            </Link>
            {/* The step's NAME is a label (it names a screen you go to); the body under it
                is a sentence explaining it, so the two take the two faces — the same split
                as a setting's label and its note. */}
            <p className="mt-0.5 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">{s.body}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

export function FirstRun({ done, onDone }: {
  /** Whether the owner has already dismissed it. */
  done: boolean
  /** Persist the dismissal. Called once; re-opening never calls it. */
  onDone: () => void
}) {
  const t = useAdminT()
  const [open, setOpen] = useState(!done)

  if (!open) {
    return (
      <p className="mb-5">
        <button
          type="button"
          data-first-run-reopen
          onClick={() => setOpen(true)}
          className="text-sm text-neutral-500 underline-offset-2 hover:text-neutral-900 hover:underline dark:text-neutral-400 dark:hover:text-white"
        >
          {t.firstRunReopen}
        </button>
      </p>
    )
  }

  // No margin of its own. This band sits in the Overview's `SECTION_GAP` stack, and a `mb-5`
  // here made the gap under it 20px against 40px above — which is the asymmetry the owner
  // circled on 2026-08-15. Same trap as `NOTE_TEXT`'s `mt-1`: a primitive that carries its own
  // spacing cannot be stacked by its parent.
  return (
    <div>
      <Card title={t.firstRunTitle}>
        <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-300">{t.firstRunIntro}</p>
        <FirstRunSteps />
        <div className="mt-5">
          <button
            type="button"
            data-first-run-dismiss
            onClick={() => { setOpen(false); if (!done) onDone() }}
            className={`${TAP} text-sm font-medium text-neutral-500 underline-offset-2 hover:text-neutral-900 hover:underline dark:text-neutral-400 dark:hover:text-white`}
          >
            {t.firstRunDismiss}
          </button>
        </div>
      </Card>
    </div>
  )
}
