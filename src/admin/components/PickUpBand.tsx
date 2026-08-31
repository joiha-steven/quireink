// "Pick up where you left off" — the unfinished writing, handed back (ADR 0024 step 6).
//
// The home screen already carried a DRAFTS COUNT, and a count is a different fact: it says
// three exist, not which three, and it leads to a list where they have to be found again.
// These are the pieces themselves, newest first, each one click from the cursor.
//
// It is the first thing under the header on purpose. The screen a writing tool opens on
// should offer the writing before it offers the numbers about it.
import Link from '@/admin/router'
import { formatDateTimeShort } from '@/utils'
import { buttonClass } from '@/admin/ui/Button'
import { Card } from './kit'
import { useAdminT } from './I18nProvider'

/**
 * Chips, not rows: at most four short things that flow across a full-width band.
 *
 * They are KEYS, though, and for a while they were not. Drawn by hand they were stadium
 * pills that only changed colour — `transition-colors` and nothing else — which made them
 * the only pressable surfaces in the whole admin with no answer to being pressed: measured
 * across every screen on 2026-09-01, three elements carried a border or a fill, took a
 * click, and had no `active:` state, and all three were these. They were also the only
 * fully-round pressable shape in a product whose keys are 6px, which is the tell the tab
 * strip's own tray was taken out for.
 *
 * So they take the secondary key whole rather than a copy of it: the raised lip, the 1px of
 * contact under it, the press that lands at once. Written as `buttonClass` and not as a
 * class list for the reason `check:admin-kit` exists — a hand-copy of a primitive is what
 * drifted here in the first place.
 */
const CHIP = buttonClass('secondary', 'md', 'max-w-full font-normal text-neutral-700 dark:text-neutral-200')

export function PickUpBand({ items, total }: { items: { title: string; href: string; touched: string }[]; total: number }) {
  const t = useAdminT()
  // Nothing unfinished is a real state and a good one. The band is absent rather than empty:
  // a card saying "no drafts" is a row of furniture that reports the absence of work.
  if (items.length === 0) return null
  return (
    <Card
      title={t.dashPickUp}
      // Four chips are enough to choose from and not enough to be a list. When there are more
      // than four, the band SAYS there are more, by way of the door to all of them — a cap
      // nobody is told about reads as "this is all of it".
      actions={
        total > items.length ? (
          <Link href="/admin/content" className="text-xs text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">
            {t.recentViewAll}
          </Link>
        ) : undefined
      }
    >
      <div className="flex flex-wrap gap-2">
        {items.map((it) => (
          <Link key={it.href} href={it.href} className={CHIP}>
            {/* The mock's chip dot: the pen's edge on everything unfinished. */}
            <span aria-hidden className="h-[5px] w-[5px] shrink-0 rounded-full bg-[var(--pen-edge)]" />
            {/* `truncate` on the TITLE only, so a long headline shortens and the timestamp
                beside it never gets pushed out of the chip. */}
            <span className="truncate">{it.title || t.untitled}</span>
            {it.touched && (
              <span className="shrink-0 text-xs text-neutral-500 dark:text-neutral-400">
                {formatDateTimeShort(it.touched)}
              </span>
            )}
          </Link>
        ))}
      </div>
    </Card>
  )
}
