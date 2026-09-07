// The first five minutes: what is set up, what is not, and the way to each.
//
// ⚠️ IT USED TO HOLD NO STATE AT ALL. Five links and a paragraph, identical on a blog set up
// an hour ago and one running for a year, and the only thing it knew was whether somebody had
// pressed "Got it" — a dismissal, not progress. So it kept offering "Write the first post" to
// a blog with forty of them, and the owner had to read five steps to find the one they had not
// done. What was missing is the only thing an onboarding band is for: telling you where you
// are in it.
//
// Every step now reads the INSTALL (`views-home.ts` computes the five flags): the site has a
// name of its own, a post is published, a look has been chosen, mail can send, somebody has
// subscribed. Done steps are ticked and stop shouting; the band names the count.
//
// AT 5 OF 5 IT TAKES ITSELF OFF THE SCREEN, which is the dismissal nobody has to remember to
// perform. The steps stay on the Help page, so nothing becomes unreachable — and that is the
// half most onboarding gets wrong: a tour you can never re-open is a tour you have to
// remember, and the whole reason it exists is that nobody does.
//
// Dismissing early still writes ONE setting and leaves the link on the dashboard permanently.
// Re-opening is local state and writes nothing: looking at the steps again is not
// un-finishing setup.
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
  '/admin/settings?tab=people',
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

/**
 * The list itself, so the dashboard card and the Help page render one thing.
 *
 * `done` is optional because the Help page renders the same five as REFERENCE — a path to
 * read, not a checklist to finish — and ticking them there would answer a question nobody
 * opened the page to ask.
 */
export function FirstRunSteps({ done }: { done?: boolean[] }) {
  const t = useAdminT()
  return (
    <ol className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
      {firstRunSteps(t).map((s, i) => (
        <li key={s.href} className="flex gap-3">
          {/* `tabular-nums` on the counter: five numbers in a column that do not line up
              read as five unrelated things rather than one path. A DONE step trades its
              number for a tick and takes the pen — the number was the thing to do next, and
              a finished step is no longer one. */}
          {done?.[i] ? (
            <span
              aria-hidden
              data-step-done
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--pen)] text-xs font-bold text-neutral-950"
            >
              ✓
            </span>
          ) : (
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-neutral-300 text-xs font-medium tabular-nums text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
            {i + 1}
          </span>
          )}
          {/* A `div` and a `p`, not two spans. Two reasons and they agree: a paragraph is
              not phrasing content and may not sit inside a span, and the admin's reading
              face is applied to `p` — as a span the body rendered in the chrome font while
              the intro one line above it rendered in the reading one, in the same card. */}
          <div className="min-w-0">
            {/* A DONE step goes quiet rather than away: it is still the way to the screen
                that holds it, and removing it would renumber the four that are left every
                time one is finished. */}
            <Link
              href={s.href}
              className={`text-sm font-medium underline-offset-2 hover:underline ${
                done?.[i]
                  ? 'text-neutral-500 dark:text-neutral-400'
                  : 'text-neutral-900 dark:text-neutral-100'
              }`}
            >
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

/** The five flags, in the order the steps are printed. `views-home.ts` computes them. */
export type SetupState = {
  named: boolean
  published: boolean
  styled: boolean
  mail: boolean
  readers: boolean
}

export function FirstRun({ done, onDone, setup }: {
  /** Whether the owner has already dismissed it. */
  done: boolean
  /** Persist the dismissal. Called once; re-opening never calls it. */
  onDone: () => void
  /** What is actually set up. */
  setup: SetupState
}) {
  const t = useAdminT()
  const steps = [setup.named, setup.published, setup.styled, setup.mail, setup.readers]
  const finished = steps.filter(Boolean).length
  const [open, setOpen] = useState(!done)

  // FINISHED IS FINISHED. Nothing is drawn — not even the re-open link, which on a set-up
  // blog is a permanent invitation to read instructions for work already done. The five
  // survive on the Help page, which is where a reference belongs.
  if (finished === steps.length) return null

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
    // `data-first-run-progress` is the STATE as a fact something can read. The count is
    // printed in eleven languages and the ticks are styling; a guard that has to parse either
    // is a guard that breaks on a translation. Same reason `NotFound` carries `data-admin-404`.
    <div data-first-run-progress={`${finished}/${steps.length}`}>
      <Card
        title={t.firstRunTitle}
        // THE COUNT IS THE HEADLINE, on the card's own title row where a state belongs. It
        // is what turns five links into a path with a position on it.
        actions={
          <span className="flex items-center gap-2.5">
            <span className="text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
              {t.firstRunProgress.replace('{done}', String(finished)).replace('{total}', String(steps.length))}
            </span>
            {/* The bar carries no number of its own — it is the same fact in a shape the eye
                reads without counting. `aria-hidden`, because the sentence beside it is
                already the accessible answer and a second one would be read twice. */}
            <span aria-hidden className="h-1.5 w-16 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
              <span
                className="block h-full rounded-full bg-[var(--pen-edge)] transition-[width] duration-300"
                style={{ width: `${(finished / steps.length) * 100}%` }}
              />
            </span>
          </span>
        }
      >
        <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-300">{t.firstRunIntro}</p>
        <FirstRunSteps done={steps} />
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
