// The find-and-replace bar: one strip at the top of the sheet, under the action line.
//
// IN THE SHEET'S OWN STACK rather than floating over the paper. The editor's contract already
// settled that question once for the toolbar (`docs/admin-editor.md`): a band hovering over a
// crack of page was rejected, and the reason applies twice over here, because a floating find
// box covers the very text the writer is looking at. This one pushes the writing down while it
// is open and takes the room back when it closes.
//
// IT KNOWS NOTHING ABOUT THE DOCUMENT. The two views underneath it have nothing in common —
// one is a ProseMirror document with positions, the other a textarea with a string — so this
// takes a TARGET: how many hits there are, which one is current, and four things to do. Both
// views can then be searched by the same strip with the same keys, which is the whole reason a
// writer can press the chord without first noticing which view they are in.
import { useEffect, useRef, useState } from 'react'
import { CONTROL_CHROME } from './kit'
import { Button } from '@/admin/ui/Button'
import { IconChevronLeft, IconChevronRight, IconClose } from './navIcons'
import { ICONS } from '@/icons'
import { useAdminT } from './I18nProvider'

export type FindTarget = {
  /** How many hits the current query has. */
  count: number
  /** Which hit is current, 0-based. Meaningless when `count` is 0. */
  index: number
  onQuery: (query: string, caseSensitive: boolean) => void
  onStep: (by: 1 | -1) => void
  onReplace: (replacement: string) => void
  onReplaceAll: (replacement: string) => void
  /** Put the caret back where the writer was. Called when the strip closes. */
  onClose: () => void
}

// ONE BOX FOR EVERY CONTROL IN THE ROW, 32 square, and the count wears it too.
//
// It did not, and the row read as crooked: `Aa` was the row's inherited 14px against a 12px
// count, the count sat in a 64px slot with its text ranged left so the space before the
// arrows was twice the space after them, and three different heights met at `items-center`
// with nothing to line up on. Same box, same type size, one gap — then the eye has a single
// rhythm to follow instead of five things each centred on their own.
const ICON_BTN =
  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-neutral-600 transition '
  + 'hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40 '
  + 'dark:text-neutral-300 dark:hover:bg-neutral-800'

export function FindBar(
  { target, onHeight, withReplace }: {
    target: FindTarget
    /**
     * Whether the replace row starts open.
     *
     * TWO CHORDS, one strip: `Mod-f` is looking for something and `Mod-Shift-f` is changing
     * it, and most of the time it is the first. A replace field that is always there is a
     * field that is usually in the way — and, worse, a second empty box under the cursor
     * while somebody is only reading is an invitation to type into the wrong one.
     */
    withReplace: boolean
    /**
     * How tall the strip is, so the toolbar under it can stick BELOW rather than behind.
     *
     * Reported rather than assumed: this strip wraps to three rows in the locales with the
     * longest labels and on a phone, and the toolbar's sticky offset is already a measured
     * number for exactly that reason (`useStickyOffset`, which measures the action line
     * because it wraps). A constant here would be right on English at 1440 and wrong
     * everywhere else.
     */
    onHeight: (px: number) => void
  },
) {
  const t = useAdminT()
  const [query, setQuery] = useState('')
  const [replacement, setReplacement] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  // Opened by the chord, and by the chevron for a hand that came in through `Mod-f` and then
  // changed its mind. It never closes itself: a writer who opened it is mid-task.
  const [replacing, setReplacing] = useState(withReplace)
  useEffect(() => { if (withReplace) setReplacing(true) }, [withReplace])
  const findRef = useRef<HTMLInputElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  // Reported on mount, on every resize, and as 0 on the way out, so the toolbar takes its
  // room back the moment the strip is gone.
  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const observer = new ResizeObserver(() => onHeight(Math.ceil(box.getBoundingClientRect().height)))
    observer.observe(box)
    onHeight(Math.ceil(box.getBoundingClientRect().height))
    return () => { observer.disconnect(); onHeight(0) }
  }, [onHeight])

  // The strip is mounted by the chord, so the field it opens for is the field the chord is
  // asking for. `select()` rather than plain focus: reopening the strip with a query already
  // in it should let the next thing typed replace it, which is what every find box does.
  useEffect(() => {
    findRef.current?.focus()
    findRef.current?.select()
  }, [])

  // The document is searched from HERE rather than from an effect on `query`, so a keystroke
  // and its search are one event. An effect would run a frame later and, on a long piece,
  // makes typing feel like it is being transcribed rather than typed.
  const ask = (next: string, sensitive: boolean): void => {
    setQuery(next)
    setCaseSensitive(sensitive)
    target.onQuery(next, sensitive)
  }

  const counted = target.count === 0
    ? (query ? t.findNoMatch : '')
    : t.findCount.replace('{n}', String(target.index + 1)).replace('{total}', String(target.count))

  const onFindKey = (e: React.KeyboardEvent): void => {
    // Enter walks the hits, which is the one key every find box in existence answers to.
    if (e.key === 'Enter') { e.preventDefault(); target.onStep(e.shiftKey ? -1 : 1) }
    if (e.key === 'Escape') { e.preventDefault(); target.onClose() }
  }

  return (
    <div
      ref={boxRef}
      role="search"
      aria-label={t.findFind}
      data-find-bar
      /* A GRID, not two flex rows, and the reason is the one thing a reader notices first:
         two stacked fields have to be the same width. Laid out as rows they are not — the
         controls after them differ in width, so each input takes whatever is left and the two
         right edges land 18px apart (measured at 1440). Three columns — the disclosure, the
         field, the controls — make both fields exactly as wide as each other and both control
         groups start on the same line. One column below `sm`, where there is no room. */
      className="grid grid-cols-1 items-center gap-x-2 gap-y-1.5 border-b border-neutral-200/70 bg-neutral-50/80 px-4 py-2 backdrop-blur-xl sm:grid-cols-[auto_1fr_auto] dark:border-neutral-800 dark:bg-neutral-950/60"
    >
      {/* At the HEAD of the strip, which is where this control lives in every editor that
          has one, and where it reads as "there is more of this" rather than as an action. */}
      <button
        type="button"
        aria-expanded={replacing}
        title={t.findReplace}
        aria-label={t.findReplace}
        onClick={() => setReplacing(!replacing)}
        className={`${ICON_BTN} justify-self-start`}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8}
          strokeLinecap="round" strokeLinejoin="round" aria-hidden
          style={{ transform: replacing ? 'rotate(90deg)' : 'none', transition: 'transform 140ms' }}
          dangerouslySetInnerHTML={{ __html: ICONS.next }}
        />
      </button>
      <input
        ref={findRef}
        value={query}
        onChange={(e) => ask(e.target.value, caseSensitive)}
        onKeyDown={onFindKey}
        aria-label={t.findFind}
        placeholder={t.findFind}
        className={`${CONTROL_CHROME} h-8 w-full min-w-0 px-2.5 py-1 text-sm`}
      />
      <div className="flex items-center justify-end gap-1">
      {/* `aria-pressed` rather than a checkbox: it is a switch on a toolbar, and a checkbox
          here would want a label beside it and take the row to two lines on a phone. */}
      <button
        type="button"
        aria-pressed={caseSensitive}
        title={t.findMatchCase}
        aria-label={t.findMatchCase}
        onClick={() => ask(query, !caseSensitive)}
        className={`${ICON_BTN} text-xs font-semibold ${caseSensitive ? 'bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100' : ''}`}
      >
        Aa
      </button>
      {/* `aria-live`, because the count is the only answer a screen reader gets to the
          question that was just typed. `tabular-nums` so "9 of 12" does not shuffle its own
          width into "10 of 12" while the writer steps through. */}
      <span aria-live="polite"
        className="inline-flex h-8 min-w-20 shrink-0 items-center justify-center px-1 text-xs tabular-nums whitespace-nowrap text-neutral-500 dark:text-neutral-400">
        {counted}
      </span>
      <button type="button" className={ICON_BTN} disabled={target.count === 0}
        title={t.findPrevious} aria-label={t.findPrevious} onClick={() => target.onStep(-1)}>
        <IconChevronLeft />
      </button>
      <button type="button" className={ICON_BTN} disabled={target.count === 0}
        title={t.findNext} aria-label={t.findNext} onClick={() => target.onStep(1)}>
        <IconChevronRight />
      </button>
      {/* On the FIRST row, because the second one is optional and the way out must not be. */}
      <button type="button" className={ICON_BTN} title={t.close} aria-label={t.close}
        onClick={target.onClose}>
        <IconClose />
      </button>
      </div>

      {/* The replace half, when it was asked for. */}
      {replacing && (
        <>
        {/* An empty cell under the disclosure, so the replace field starts in the same
            column as the find field above it. */}
        <span aria-hidden className="hidden sm:block" />
        <input
          value={replacement}
          onChange={(e) => setReplacement(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); target.onReplace(replacement) }
            if (e.key === 'Escape') { e.preventDefault(); target.onClose() }
          }}
          aria-label={t.findReplaceWith}
          placeholder={t.findReplaceWith}
          className={`${CONTROL_CHROME} h-8 w-full min-w-0 px-2.5 py-1 text-sm`}
        />
        <div className="flex items-center justify-end gap-1">
        <Button type="button" variant="ghost" size="sm" disabled={target.count === 0}
          onClick={() => target.onReplace(replacement)}>{t.findReplace}</Button>
        <Button type="button" variant="ghost" size="sm" disabled={target.count === 0}
          onClick={() => target.onReplaceAll(replacement)}>{t.findReplaceAll}</Button>
        </div>
        </>
      )}
    </div>
  )
}
